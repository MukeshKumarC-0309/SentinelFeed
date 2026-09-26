/**
 * Cross-edition memory.
 *
 * A single edition can only say what is happening now. These aggregates are
 * what let the site answer "is this theme rising?", "when did we first see this
 * CVE?" and "show me everything about this actor" - questions that need the
 * whole archive rather than the current briefing.
 *
 * Two stores, both written atomically after every refresh:
 *
 *   trends.json  per-edition theme shares, plus an entity ledger keyed by CVE
 *                and actor name recording first/last sighting and every
 *                edition an entity appeared in.
 *   search.json  a compact record per clipping so the whole archive can be
 *                searched without opening every edition file.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { writeJsonAtomic } from './atomic.js';

const root = () => path.resolve(process.cwd(), config.dataDir);
const trendsPath = () => path.join(root(), 'trends.json');
const searchPath = () => path.join(root(), 'search.json');

const EMPTY_TRENDS = { version: 1, editions: [], entities: { cves: {}, actors: {} } };
const EMPTY_SEARCH = { version: 1, clippings: [] };

const writeJson = (file, value) => writeJsonAtomic(file, value);

async function readJson(file, fallback) {
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

export const readTrends = () => readJson(trendsPath(), EMPTY_TRENDS);
export const readSearchStore = () => readJson(searchPath(), EMPTY_SEARCH);

/** Summary trimmed to what a search result actually shows. */
const clip = (text, max = 320) => {
  const value = String(text ?? '');
  return value.length <= max ? value : `${value.slice(0, max).replace(/\s+\S*$/, '')}…`;
};

/**
 * Fold a newly published edition into both stores.
 *
 * Entities accumulate: an entity seen again updates `last` and gains an
 * edition reference, so its ledger entry becomes a timeline.
 */
export async function updateAggregates(edition) {
  const trends = await readTrends();
  const search = await readSearchStore();

  // ---- Theme history ----------------------------------------------------
  const themeShares = {};
  for (const theme of edition.insights?.themes || []) {
    themeShares[theme.id] = { share: theme.share, count: theme.count, label: theme.label };
  }
  trends.editions = [
    ...trends.editions.filter((e) => e.id !== edition.id),
    {
      id: edition.id,
      createdAt: edition.createdAt,
      storyCount: edition.stories.length,
      corpusSize: edition.meta?.corpusSize ?? edition.stories.length,
      themes: themeShares,
    },
  ].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

  // ---- Entity ledger ----------------------------------------------------
  const note = (bucket, key, label, story) => {
    const ledger = trends.entities[bucket];
    const entry = ledger[key] || {
      key,
      label,
      first: edition.createdAt,
      last: edition.createdAt,
      mentions: 0,
      editions: [],
      stories: [],
    };
    entry.label = label || entry.label;
    entry.last = edition.createdAt;
    entry.mentions += 1;
    if (!entry.editions.includes(edition.id)) entry.editions.push(edition.id);
    if (!entry.stories.some((s) => s.url === story.url)) {
      // Newest first, and bounded so one busy entity cannot bloat the file.
      entry.stories.unshift({
        title: story.title,
        url: story.url,
        source: story.sourceName,
        publishedAt: story.publishedAt,
        editionId: edition.id,
      });
      entry.stories = entry.stories.slice(0, 40);
    }
    ledger[key] = entry;
  };

  const ACTOR_PATTERN =
    /\b(APT\d{1,3}|Lazarus|Kimsuky|Sandworm|Salt Typhoon|Volt Typhoon|Silk Typhoon|Midnight Blizzard|Scattered Spider|LockBit|ALPHV|BlackCat|Cl0p|Clop|Akira|Rhysida|Qilin|Medusa|BlackSuit|Hunters International|Play ransomware|Turla|Mustang Panda|Charming Kitten|FIN\d{1,2}|UNC\d{3,5}|TA\d{3,4}|Settra)\b/gi;
  const ACTOR_ALIASES = new Map([
    ['cl0p', 'Clop'],
    ['blackcat', 'ALPHV/BlackCat'],
    ['alphv', 'ALPHV/BlackCat'],
    ['play ransomware', 'Play'],
  ]);

  for (const story of edition.stories) {
    const text = `${story.title} ${story.summary || ''}`;

    const seenCves = new Set();
    for (const match of text.matchAll(/\bCVE-\d{4}-\d{4,7}\b/gi)) {
      const id = match[0].toUpperCase();
      if (seenCves.has(id)) continue;
      seenCves.add(id);
      note('cves', id, id, story);
    }

    const seenActors = new Set();
    for (const match of text.matchAll(ACTOR_PATTERN)) {
      const raw = match[0];
      const label = ACTOR_ALIASES.get(raw.toLowerCase()) || raw;
      const key = label.toLowerCase();
      if (seenActors.has(key)) continue;
      seenActors.add(key);
      note('actors', key, label, story);
    }

    // ---- Search store ---------------------------------------------------
    search.clippings.push({
      i: story.id,
      t: story.title,
      u: story.url,
      s: story.sourceName,
      k: story.sourceKind,
      d: story.publishedAt,
      e: edition.id,
      h: (story.themes || []).map((t) => t.id),
      x: clip(story.summary),
    });
  }

  // De-duplicate the search store on URL, keeping the earliest appearance.
  const byUrl = new Map();
  for (const entry of search.clippings) if (!byUrl.has(entry.u)) byUrl.set(entry.u, entry);
  search.clippings = [...byUrl.values()].sort((a, b) => (a.d < b.d ? 1 : -1));

  pruneAggregates(trends, search);

  await writeJson(trendsPath(), trends);
  await writeJson(searchPath(), search);
  return { trends, search };
}

/** Drop anything older than the retention window so the stores stay bounded. */
function pruneAggregates(trends, search) {
  if (!(config.archiveRetentionDays > 0)) return;
  const cutoff = Date.now() - config.archiveRetentionDays * 86400000;

  trends.editions = trends.editions.filter((e) => Date.parse(e.createdAt) >= cutoff);
  const liveEditions = new Set(trends.editions.map((e) => e.id));

  for (const bucket of ['cves', 'actors']) {
    for (const [key, entry] of Object.entries(trends.entities[bucket])) {
      if (Date.parse(entry.last) < cutoff) {
        delete trends.entities[bucket][key];
        continue;
      }
      entry.editions = entry.editions.filter((id) => liveEditions.has(id));
      entry.stories = entry.stories.filter((s) => Date.parse(s.publishedAt || entry.last) >= cutoff);
    }
  }

  search.clippings = search.clippings.filter((c) => Date.parse(c.d) >= cutoff);
}

/**
 * Theme trajectories across the last `limit` editions, with the direction of
 * travel measured over the window rather than against a single prior edition.
 */
export function themeTrends(trends, limit = 28) {
  const editions = trends.editions.slice(-limit);
  if (!editions.length) return { editions: [], themes: [] };

  const labels = new Map();
  for (const edition of editions) {
    for (const [id, value] of Object.entries(edition.themes)) labels.set(id, value.label);
  }

  const themes = [...labels.entries()].map(([id, label]) => {
    const series = editions.map((edition) => edition.themes[id]?.share ?? 0);
    const half = Math.max(1, Math.floor(series.length / 2));
    const older = series.slice(0, half);
    const newer = series.slice(-half);
    const mean = (values) => values.reduce((sum, v) => sum + v, 0) / (values.length || 1);
    const change = mean(newer) - mean(older);

    return {
      id,
      label,
      series,
      current: series[series.length - 1] || 0,
      peak: Math.max(...series),
      average: Number(mean(series).toFixed(2)),
      change: Number(change.toFixed(2)),
      direction: change > 1 ? 'rising' : change < -1 ? 'falling' : 'steady',
      editionsPresent: series.filter((v) => v > 0).length,
    };
  });

  themes.sort((a, b) => b.current - a.current || b.average - a.average);
  return {
    editions: editions.map((e) => ({ id: e.id, createdAt: e.createdAt, storyCount: e.storyCount })),
    themes,
  };
}

/** Entities ranked by how persistent they have been, not just how loud. */
export function entityLeaderboard(trends, bucket, limit = 25) {
  const ledger = trends.entities[bucket] || {};
  return Object.values(ledger)
    .map((entry) => ({
      key: entry.key,
      label: entry.label,
      mentions: entry.mentions,
      editions: entry.editions.length,
      first: entry.first,
      last: entry.last,
      stories: entry.stories.slice(0, 3),
    }))
    .sort((a, b) => b.editions - a.editions || b.mentions - a.mentions)
    .slice(0, limit);
}

export function entityDetail(trends, bucket, key) {
  const entry = (trends.entities[bucket] || {})[String(key).toLowerCase()] ||
    (trends.entities[bucket] || {})[String(key).toUpperCase()] ||
    (trends.entities[bucket] || {})[key];
  if (!entry) return null;
  return {
    bucket,
    key: entry.key,
    label: entry.label,
    mentions: entry.mentions,
    editions: entry.editions,
    first: entry.first,
    last: entry.last,
    stories: entry.stories,
  };
}

/**
 * Search the whole archive.
 *
 * Terms are ANDed; a quoted "phrase" must appear intact. Results are ordered
 * by recency, which is what an analyst scanning for a CVE actually wants.
 */
export function searchClippings(store, { q = '', theme = '', source = '', kind = '', from = '', to = '', limit = 60, offset = 0 } = {}) {
  const phrases = [];
  const terms = [];
  for (const match of String(q).matchAll(/"([^"]+)"|(\S+)/g)) {
    if (match[1]) phrases.push(match[1].toLowerCase());
    else if (match[2]) terms.push(match[2].toLowerCase());
  }

  const fromTime = from ? Date.parse(from) : null;
  const toTime = to ? Date.parse(to) : null;

  const matched = store.clippings.filter((c) => {
    if (theme && !(c.h || []).includes(theme)) return false;
    if (source && c.s !== source) return false;
    if (kind && c.k !== kind) return false;
    const when = Date.parse(c.d);
    if (fromTime && Number.isFinite(when) && when < fromTime) return false;
    if (toTime && Number.isFinite(when) && when > toTime) return false;

    if (!phrases.length && !terms.length) return true;
    const haystack = `${c.t} ${c.x} ${c.s}`.toLowerCase();
    return phrases.every((p) => haystack.includes(p)) && terms.every((t) => haystack.includes(t));
  });

  return {
    total: matched.length,
    results: matched.slice(offset, offset + limit).map((c) => ({
      id: c.i,
      title: c.t,
      url: c.u,
      sourceName: c.s,
      sourceKind: c.k,
      publishedAt: c.d,
      editionId: c.e,
      themes: c.h,
      summary: c.x,
    })),
  };
}

/**
 * Skill demand across the archive, not just this cycle.
 *
 * The per-edition skills panel re-shuffles every 12 hours, which is the wrong
 * shape for the question it answers ("what should I learn?"). Demand is derived
 * from the stored theme history rather than a new store, so it works over the
 * whole archive retroactively: a skill inherits the share of every theme that
 * calls for it, edition by edition.
 *
 * The useful distinction is not who is loudest today but who is *durable*:
 *
 *   sustained  present in most editions and steady - the safe bet
 *   rising     clearly stronger in the recent half of the window
 *   fading     clearly weaker
 *   spike      loud right now, but largely absent across the window
 */
export function skillTrends(trends, themes, skills, limit = 40) {
  const editions = trends.editions.slice(-limit);
  if (!editions.length) return { editions: 0, skills: [] };

  const themeSkills = new Map(themes.map((t) => [t.id, t.skills]));

  // One share series per skill, one entry per edition.
  const series = new Map();
  for (const [index, edition] of editions.entries()) {
    for (const [themeId, value] of Object.entries(edition.themes || {})) {
      for (const skillId of themeSkills.get(themeId) || []) {
        if (!series.has(skillId)) series.set(skillId, new Array(editions.length).fill(0));
        series.get(skillId)[index] += value.share || 0;
      }
    }
  }

  const mean = (values) => values.reduce((sum, v) => sum + v, 0) / (values.length || 1);

  const rows = [...series.entries()]
    .filter(([id]) => skills[id])
    .map(([id, values]) => {
      const half = Math.max(1, Math.floor(values.length / 2));
      const older = mean(values.slice(0, half));
      const newer = mean(values.slice(-half));
      const average = mean(values);
      const presence = values.filter((v) => v > 0).length / values.length;
      const current = values[values.length - 1] || 0;
      const change = newer - older;

      let status = 'steady';
      if (presence >= 0.7 && Math.abs(change) <= Math.max(1.5, average * 0.25)) status = 'sustained';
      else if (change > Math.max(1.5, average * 0.25)) status = 'rising';
      else if (change < -Math.max(1.5, average * 0.25)) status = 'fading';
      if (presence < 0.4 && current > average * 1.5) status = 'spike';

      return {
        id,
        label: skills[id].label,
        demandDriver: skills[id].demandDriver,
        practice: skills[id].practice,
        series: values.map((v) => Number(v.toFixed(2))),
        current: Number(current.toFixed(2)),
        average: Number(average.toFixed(2)),
        change: Number(change.toFixed(2)),
        presence: Math.round(presence * 100),
        status,
      };
    });

  // Durability first: a skill demanded in every edition outranks today's noise.
  const order = { sustained: 0, rising: 1, steady: 2, spike: 3, fading: 4 };
  rows.sort((a, b) => order[a.status] - order[b.status] || b.average - a.average);

  return { editions: editions.length, skills: rows };
}

/**
 * A week of editions condensed into what actually moved.
 *
 * Built on demand from stores that already exist, so it costs nothing until
 * someone opens it.
 */
export function weeklyReview(trends, searchStore, themes, days = 7) {
  const cutoff = Date.now() - days * 86400000;
  const editions = trends.editions.filter((e) => Date.parse(e.createdAt) >= cutoff);
  if (editions.length < 2) {
    return { ready: false, editions: editions.length, days };
  }

  const labelOf = new Map(themes.map((t) => [t.id, t.label]));
  const half = Math.max(1, Math.floor(editions.length / 2));

  // Theme behaviour over the window.
  const ids = new Set(editions.flatMap((e) => Object.keys(e.themes || {})));
  const movements = [...ids].map((id) => {
    const shares = editions.map((e) => e.themes[id]?.share ?? 0);
    const present = shares.filter((v) => v > 0).length;
    const early = shares.slice(0, half);
    const late = shares.slice(-half);
    const mean = (v) => v.reduce((a, b) => a + b, 0) / (v.length || 1);
    return {
      id,
      label: labelOf.get(id) || id,
      presence: present,
      total: shares.length,
      early: Number(mean(early).toFixed(2)),
      late: Number(mean(late).toFixed(2)),
      change: Number((mean(late) - mean(early)).toFixed(2)),
    };
  });

  const persisted = movements
    .filter((m) => m.presence >= Math.ceil(m.total * 0.75))
    .sort((a, b) => b.late - a.late)
    .slice(0, 5);
  const emerged = movements
    .filter((m) => m.early < 1 && m.late >= 2)
    .sort((a, b) => b.change - a.change)
    .slice(0, 4);
  const faded = movements
    .filter((m) => m.early >= 2 && m.late < 1)
    .sort((a, b) => a.change - b.change)
    .slice(0, 4);

  // Entities that recurred across the window rather than appearing once.
  const inWindow = (entry) => Date.parse(entry.last) >= cutoff;
  const recurring = (bucket) =>
    Object.values(trends.entities[bucket] || {})
      .filter((e) => inWindow(e) && e.editions.length > 1)
      .sort((a, b) => b.editions.length - a.editions.length || b.mentions - a.mentions)
      .slice(0, 6)
      .map((e) => ({ label: e.label, editions: e.editions.length, mentions: e.mentions, story: e.stories[0] || null }));

  const editionIds = new Set(editions.map((e) => e.id));
  const stories = searchStore.clippings
    .filter((c) => editionIds.has(c.e) && Date.parse(c.d) >= cutoff)
    .slice(0, 10)
    .map((c) => ({ title: c.t, url: c.u, source: c.s, publishedAt: c.d }));

  return {
    ready: true,
    days,
    from: editions[0].createdAt,
    to: editions[editions.length - 1].createdAt,
    editions: editions.length,
    storiesPublished: editions.reduce((sum, e) => sum + (e.storyCount || 0), 0),
    persisted,
    emerged,
    faded,
    cves: recurring('cves'),
    actors: recurring('actors'),
    stories,
  };
}
