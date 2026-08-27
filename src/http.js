import { config } from './config.js';

const lastHit = new Map();

/** Serialise requests per host so we never hammer a single publisher. */
async function throttle(host) {
  const now = Date.now();
  const earliest = (lastHit.get(host) || 0) + config.perHostDelayMs;
  lastHit.set(host, Math.max(now, earliest));
  if (earliest > now) await new Promise((r) => setTimeout(r, earliest - now));
}

/**
 * GET a URL as text with a timeout, redirect following and polite throttling.
 * Returns { ok, status, text, url, error }. Never throws.
 */
export async function getText(url, { accept, timeoutMs } = {}) {
  let host = '';
  try {
    host = new URL(url).host;
  } catch {
    return { ok: false, status: 0, text: '', url, error: 'invalid url' };
  }
  await throttle(host);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || config.fetchTimeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': config.userAgent,
        accept: accept || 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5',
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, url: res.url || url, error: res.ok ? null : `HTTP ${res.status}` };
  } catch (err) {
    const error = err?.name === 'AbortError' ? 'timeout' : String(err?.message || err);
    return { ok: false, status: 0, text: '', url, error };
  } finally {
    clearTimeout(timer);
  }
}

/** Run an async mapper over items with bounded concurrency, preserving order. */
export async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = new Array(Math.min(Math.max(limit, 1), items.length || 1)).fill(0).map(async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
