import { createHash } from 'node:crypto';
import { config } from './config.js';
import { getText, mapLimit } from './http.js';
import { SOURCES, RELEVANCE_TERMS } from './sources.js';
import { attr, findAll, findFirst, tagText, extractEntries } from './xml.js';
import { htmlToText } from './html.js';

const TRACKING_PARAMS = /^(utm_|fbclid|gclid|mc_cid|mc_eid|ref|ref_src|source|guccounter|__twitter|igshid|spm|at_|cmp|xtor)/i;

/**
 * Clean a URL without changing where it points.
 *
 * Only campaign parameters and fragments are removed. The host is left exactly
 * as the publisher wrote it, because this value is the link the reader clicks
 * and some hosts do not serve their apex domain.
 */
export function canonicalUrl(input) {
  try {
    const url = new URL(String(input).trim());
    if (!/^https?:$/.test(url.protocol)) return '';
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return '';
  }
}

/** Aggressively normalised form used only to test whether two URLs are the same page. */
export function dedupeKey(input) {
  try {
    const url = new URL(String(input).trim());
    const host = url.host.toLowerCase().replace(/^www\./, '');
    const path = url.pathname.replace(/\/+$/, '').toLowerCase();
    return `${host}${path}`;
  } catch {
    return String(input ?? '').toLowerCase();
  }
}

const hash = (value) => createHash('sha1').update(value).digest('hex').slice(0, 16);

/** Pick the human-facing article link from an RSS item or Atom entry. */
function entryLink(entry) {
  const links = findAll(entry, 'link');
  const candidates = [];
  for (const node of links) {
    const href = attr(node.attrs, 'href');
    const rel = attr(node.attrs, 'rel').toLowerCase();
    const type = attr(node.attrs, 'type').toLowerCase();
    if (href) {
      if (rel && rel !== 'alternate') continue;
      if (type && !type.includes('html')) continue;
      candidates.push(href);
    } else if (node.inner) {
      const text = htmlToText(node.inner);
      if (/^https?:\/\//i.test(text)) candidates.push(text);
    }
  }
  if (!candidates.length) {
    const guid = tagText(entry, 'guid', 'id');
    if (/^https?:\/\//i.test(guid)) candidates.push(guid);
  }
  for (const candidate of candidates) {
    const url = canonicalUrl(candidate);
    if (url) return url;
  }
  return '';
}

function entryDate(entry) {
  const raw = tagText(entry, 'pubDate', 'published', 'updated', 'date', 'modified', 'created');
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  // Some feeds emit "2026-09-18 11:32:22" without a timezone marker.
  const relaxed = new Date(raw.replace(' ', 'T') + 'Z');
  return Number.isNaN(relaxed.getTime()) ? null : relaxed;
}

/** Richest available body text for the entry, still as raw HTML. */
function entryBody(entry) {
  const encoded = findFirst(entry, 'encoded');
  if (encoded?.inner) return encoded.inner;
  for (const name of ['content', 'summary', 'description', 'subtitle']) {
    const node = findFirst(entry, name);
    if (node?.inner && node.inner.trim()) return node.inner;
  }
  return '';
}

function entryCategories(entry) {
  const out = [];
  for (const node of findAll(entry, 'category')) {
    const value = htmlToText(node.inner) || attr(node.attrs, 'term');
    if (value && value.length < 48) out.push(value);
  }
  return [...new Set(out)].slice(0, 6);
}

/** Does an item from a general-interest outlet belong in a security briefing? */
export function isSecurityRelevant(text) {
  const haystack = String(text ?? '').toLowerCase();
  return RELEVANCE_TERMS.some((term) => haystack.includes(term));
}

function parseFeed(xml, source) {
  // Feeds are conventionally newest-first, so the cap keeps the recent end.
  const entries = extractEntries(xml).slice(0, config.maxItemsPerSource);
  const items = [];
  for (const entry of entries) {
    const title = htmlToText(tagText(entry, 'title'));
    const url = entryLink(entry);
    if (!title || !url) continue;

    const body = entryBody(entry);
    const categories = entryCategories(entry);

    if (!source.topical && !isSecurityRelevant(`${title} ${htmlToText(body).slice(0, 600)} ${categories.join(' ')}`)) {
      continue;
    }

    const published = entryDate(entry);
    const key = dedupeKey(url);
    items.push({
      id: hash(key),
      title,
      url,
      dedupeKey: key,
      rawBody: body,
      author: htmlToText(tagText(entry, 'creator', 'author', 'name')).slice(0, 80),
      categories,
      publishedAt: published ? published.toISOString() : null,
      sourceId: source.id,
      sourceName: source.name,
      sourceKind: source.kind,
      sourceWeight: source.weight,
    });
  }
  return items;
}

/**
 * Pull every source in parallel (bounded) and return the flat item list plus
 * a per-source report so the UI can be honest about what failed.
 */
export async function collectFeedItems(sources = SOURCES) {
  const results = await mapLimit(sources, config.feedConcurrency, async (source) => {
    const started = Date.now();

    // Some publishers are simply slow, and a timeout under load costs a whole
    // source for the cycle. Retry once on a transient failure - a timeout or a
    // network error - but never on an HTTP status, which will not change.
    // The first attempt fails fast so a handful of slow hosts cannot stretch
    // the whole cycle; only the retry waits the longer timeout.
    let res = await getText(source.url, { timeoutMs: config.fetchTimeoutMs });
    if (!res.ok && res.status === 0) {
      await new Promise((resolve) => setTimeout(resolve, config.retryDelayMs));
      res = await getText(source.url, { timeoutMs: config.feedTimeoutMs });
      if (res.ok) res.retried = true;
    }

    if (!res.ok) {
      return { source, items: [], report: { id: source.id, name: source.name, ok: false, count: 0, ms: Date.now() - started, error: res.error } };
    }
    let items = [];
    try {
      items = parseFeed(res.text, source);
    } catch (err) {
      return { source, items: [], report: { id: source.id, name: source.name, ok: false, count: 0, ms: Date.now() - started, error: `parse failed: ${err.message}` } };
    }
    return {
      source,
      items,
      report: { id: source.id, name: source.name, ok: true, count: items.length, ms: Date.now() - started, error: null, retried: Boolean(res.retried) },
    };
  });

  return {
    items: results.flatMap((r) => r.items),
    reports: results.map((r) => r.report),
  };
}
