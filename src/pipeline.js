import { config } from './config.js';
import { SOURCES } from './sources.js';
import { collectFeedItems } from './feeds.js';
import { buildSummary } from './summary.js';
import { fetchArticleText } from './extract.js';
import { mapLimit } from './http.js';
import { clusterDuplicates, matchThemes, scoreItem } from './analyze.js';
import { buildInsights, shareSnapshot } from './insights.js';
import { THEMES } from './taxonomy.js';
import { editionId, readIndex, saveEdition } from './store.js';
import { updateAggregates } from './aggregate.js';
import { deliver } from './notify.js';

/**
 * Raised when a cycle collected too little to be worth publishing. The caller
 * keeps the previous edition and tries again shortly, rather than replacing a
 * good front page with an empty one.
 */
export class RefreshAbandoned extends Error {
  constructor(message, detail) {
    super(message);
    this.name = 'RefreshAbandoned';
    this.detail = detail;
  }
}

const THEME_LABEL = new Map(THEMES.map((t) => [t.id, t.label]));

function withinWindow(item, now) {
  if (!item.publishedAt) return false;
  const published = Date.parse(item.publishedAt);
  if (!Number.isFinite(published)) return false;
  const ageHours = (now - published) / 3600000;
  // Allow a little clock skew on publisher timestamps.
  return ageHours <= config.maxStoryAgeHours && ageHours >= -2;
}

function toStory(item) {
  return {
    id: item.id,
    title: item.title,
    url: item.url,
    summary: item.summary,
    sourceId: item.sourceId,
    sourceName: item.sourceName,
    sourceKind: item.sourceKind,
    author: item.author || '',
    publishedAt: item.publishedAt,
    score: item.score,
    signals: item.signals || [],
    themes: (item.themes || []).slice(0, 3).map((t) => ({ id: t.id, label: THEME_LABEL.get(t.id) || t.id })),
    categories: (item.categories || []).slice(0, 4),
    alsoReportedBy: item.alsoReportedBy || [],
    enriched: Boolean(item.enriched),
  };
}

/**
 * Build one edition end to end: collect, normalise, de-duplicate, rank,
 * deepen the summaries that are too thin, derive insights, persist.
 */
export async function runRefresh({ log = console.log } = {}) {
  const startedAt = Date.now();
  const now = startedAt;
  log(`[refresh] starting - ${SOURCES.length} sources`);

  const { items: rawItems, reports } = await collectFeedItems(SOURCES);
  const fetched = rawItems.length;

  const fresh = rawItems.filter((item) => withinWindow(item, now));

  // First-pass summary and theme tagging on every in-window story: the insight
  // engine reads the whole corpus, not just the front page.
  for (const item of fresh) {
    const summary = buildSummary(item.rawBody, { title: item.title });
    item.summary = summary.text;
    item.thin = summary.needsEnrichment;
    item.themes = matchThemes(item);
  }

  const deduped = clusterDuplicates(fresh);
  for (const item of deduped) Object.assign(item, scoreItem(item, now));
  deduped.sort((a, b) => b.score - a.score);

  // Deepen thin summaries across a candidate pool slightly larger than the
  // front page, then re-rank: a story whose summary could be filled out may
  // deserve a place that its one-line blurb would have cost it.
  const pool = deduped.slice(0, config.briefingSize + 20);
  const toEnrich = pool.filter((item) => item.thin).slice(0, config.maxEnrichments);
  let enriched = 0;
  await mapLimit(toEnrich, config.articleConcurrency, async (item) => {
    const extra = await fetchArticleText(item.url);
    if (!extra) return;
    const rebuilt = buildSummary(item.rawBody, { title: item.title, extra });
    if (rebuilt.text.length > item.summary.length) {
      item.summary = rebuilt.text;
      item.enriched = true;
      item.themes = matchThemes(item);
      enriched += 1;
    }
  });

  // Second clustering pass: enrichment often reveals the CVE that proves two
  // differently-worded headlines are the same story.
  const candidates = clusterDuplicates(pool);
  for (const item of candidates) Object.assign(item, scoreItem(item, now));
  candidates.sort((a, b) => b.score - a.score);

  // The front page only carries clippings with enough context to be worth
  // reading. Thin ones are held back unless they are needed to fill the page.
  const publishable = candidates.filter((item) => (item.summary || '').length >= config.minPublishableChars);
  const briefing = (
    publishable.length >= config.briefingSize
      ? publishable
      : [...publishable, ...candidates.filter((item) => !publishable.includes(item))]
  ).slice(0, config.briefingSize);

  const index = await readIndex();
  const sourcesOk = reports.filter((r) => r.ok).length;

  const insights = buildInsights(deduped, {
    previousShares: index.state.previousShares || {},
    windowHours: config.maxStoryAgeHours,
    sourceCount: sourcesOk,
  });

  // Refuse to publish a cycle that clearly failed to reach the internet.
  const okRatio = reports.length ? sourcesOk / reports.length : 0;
  if (okRatio < config.minSourcesOkRatio || briefing.length === 0) {
    throw new RefreshAbandoned(
      `only ${sourcesOk}/${reports.length} sources responded and ${briefing.length} clippings survived - keeping the previous edition`,
      { sourcesOk, sourcesTotal: reports.length, published: briefing.length, okRatio },
    );
  }

  const createdAt = new Date();
  const edition = {
    id: editionId(createdAt),
    createdAt: createdAt.toISOString(),
    windowHours: config.refreshHours,
    stories: briefing.map(toStory),
    insights,
    meta: {
      itemsFetched: fetched,
      itemsInWindow: fresh.length,
      corpusSize: deduped.length,
      published: briefing.length,
      enriched,
      sourcesTotal: reports.length,
      sourcesOk,
      sourcesFailed: reports.filter((r) => !r.ok).map((r) => ({ name: r.name, error: r.error })),
      durationMs: Date.now() - startedAt,
      reports,
    },
  };

  await saveEdition(edition, { previousShares: shareSnapshot(insights) });
  // Cross-edition stores power trends, entity timelines and archive search.
  await updateAggregates(edition);

  log(
    `[refresh] edition ${edition.id}: ${edition.stories.length} published from ${deduped.length} unique / ${fetched} fetched, ` +
      `${sourcesOk}/${reports.length} sources ok, ${enriched} summaries deepened, ${(edition.meta.durationMs / 1000).toFixed(1)}s`,
  );
  if (edition.meta.sourcesFailed.length) {
    log(`[refresh] source failures: ${edition.meta.sourcesFailed.map((f) => `${f.name} (${f.error})`).join(', ')}`);
  }

  // Delivery is best-effort and must never fail a refresh that already landed.
  await deliver(edition, { log });

  return edition;
}
