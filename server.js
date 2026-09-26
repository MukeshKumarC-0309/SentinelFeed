import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config } from './src/config.js';
import { SOURCES } from './src/sources.js';
import { THEMES, SKILLS } from './src/taxonomy.js';
import { Scheduler } from './src/scheduler.js';
import { readIndex, readEdition, readLatestEdition } from './src/store.js';
import {
  readTrends,
  readSearchStore,
  themeTrends,
  entityLeaderboard,
  entityDetail,
  searchClippings,
  skillTrends,
  weeklyReview,
} from './src/aggregate.js';
import { renderRss } from './src/syndicate.js';
import { qrSvg } from './src/qr.js';
import { GLOSSARY } from './src/glossary.js';
import { reachableUrls } from './src/network.js';
import {
  readProfile,
  registerVisit,
  markRead,
  markAllRead,
  clearRead,
  toggleWatch,
  publicView,
  watchActivity,
} from './src/profile.js';
import { getToken, isAuthorised, RateLimiter, clientAddress, isLoopback } from './src/security.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

const scheduler = new Scheduler();
const limiter = new RateLimiter();

/**
 * Read-through cache for derived responses.
 *
 * Trends, search and entity views all read the same two aggregate files. With
 * several devices polling, re-reading and re-deriving them per request is
 * wasteful, so results are memoised until the next edition invalidates them.
 */
const cache = {
  editionId: null,
  entries: new Map(),
  async get(key, produce) {
    const current = (await readIndex()).state.lastEditionId;
    if (current !== this.editionId) {
      this.entries.clear();
      this.editionId = current;
    }
    if (!this.entries.has(key)) this.entries.set(key, await produce());
    return this.entries.get(key);
  },
  invalidate() {
    this.entries.clear();
    this.editionId = null;
  },
};

const etagOf = (payload) => `W/"${createHash('sha1').update(payload).digest('base64url').slice(0, 27)}"`;

function send(req, res, status, body, { type, cacheSeconds = 0, extraHeaders = {} }) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const headers = {
    'content-type': type,
    'cache-control': cacheSeconds ? `public, max-age=${cacheSeconds}` : 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    ...extraHeaders,
  };

  // Conditional request: let a polling client skip the payload entirely.
  if (status === 200) {
    const etag = etagOf(buffer);
    headers.etag = etag;
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch && ifNoneMatch.split(',').some((tag) => tag.trim() === etag)) {
      res.writeHead(304, { etag, 'cache-control': headers['cache-control'] });
      return res.end();
    }
  }

  const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (acceptsGzip && buffer.length >= config.gzipThreshold) {
    const compressed = zlib.gzipSync(buffer);
    headers['content-encoding'] = 'gzip';
    headers.vary = 'Accept-Encoding';
    headers['content-length'] = compressed.length;
    res.writeHead(status, headers);
    return res.end(req.method === 'HEAD' ? undefined : compressed);
  }

  headers['content-length'] = buffer.length;
  res.writeHead(status, headers);
  return res.end(req.method === 'HEAD' ? undefined : buffer);
}

const sendJson = (req, res, status, body, options = {}) =>
  send(req, res, status, JSON.stringify(body), { type: 'application/json; charset=utf-8', ...options });

/**
 * Stamp the page's asset links with a version derived from file contents.
 *
 * Assets are cached hard so repeat visits from a phone are cheap, which means
 * a deployed change would otherwise be invisible until the cache expired.
 * Versioning the URL makes every edit cache-bust itself.
 */
async function assetVersion(file) {
  try {
    const stat = await fs.stat(path.join(publicDir, file));
    return createHash('sha1').update(`${file}:${stat.mtimeMs}:${stat.size}`).digest('hex').slice(0, 10);
  } catch {
    return 'dev';
  }
}

async function serveIndex(req, res) {
  const html = await fs.readFile(path.join(publicDir, 'index.html'), 'utf8');
  const [css, js] = await Promise.all([assetVersion('css/style.css'), assetVersion('js/app.js')]);
  const stamped = html
    .replace('/css/style.css', `/css/style.css?v=${css}`)
    .replace('/js/app.js', `/js/app.js?v=${js}`);
  return send(req, res, 200, stamped, { type: 'text/html; charset=utf-8', cacheSeconds: 0 });
}

async function serveStatic(req, res, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.join(publicDir, relative);
  if (!target.startsWith(publicDir + path.sep) && target !== path.join(publicDir, 'index.html')) {
    return send(req, res, 403, 'Forbidden', { type: 'text/plain; charset=utf-8' });
  }
  if (relative === 'index.html') return serveIndex(req, res);
  try {
    const data = await fs.readFile(target);
    const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
    // A versioned request can be cached for a long time; a bare one cannot.
    const versioned = new URL(req.url, 'http://x').searchParams.has('v');
    return send(req, res, 200, data, { type, cacheSeconds: versioned ? 86400 : 60 });
  } catch {
    return send(req, res, 404, 'Not found', { type: 'text/plain; charset=utf-8' });
  }
}

/**
 * Integer query parameter with a default.
 *
 * An absent parameter must fall back rather than coerce: `Number(null)` is 0,
 * which would silently turn a missing `limit` into "return nothing".
 */
/** Read a small JSON body. Bounded so a POST cannot exhaust memory. */
async function readJsonBody(req, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('body too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('invalid JSON body');
  }
}

const intParam = (url, name, fallback, max) => {
  const raw = url.searchParams.get(name);
  if (raw === null || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return max ? Math.min(value, max) : value;
};

async function handleApi(req, res, url) {
  const { pathname } = url;

  if (pathname === '/api/status') {
    const index = await readIndex();
    const trends = await readTrends();
    return sendJson(req, res, 200, {
      ...scheduler.status(),
      editionId: index.state.lastEditionId,
      editionCount: index.editions.length,
      trackedEditions: trends.editions.length,
      lastRun: index.state.lastRun
        ? {
            itemsFetched: index.state.lastRun.itemsFetched,
            corpusSize: index.state.lastRun.corpusSize,
            published: index.state.lastRun.published,
            sourcesOk: index.state.lastRun.sourcesOk,
            sourcesTotal: index.state.lastRun.sourcesTotal,
            durationMs: index.state.lastRun.durationMs,
            sourcesFailed: index.state.lastRun.sourcesFailed,
          }
        : null,
      sourceCount: SOURCES.length,
    });
  }

  if (pathname === '/api/briefing') {
    const edition = await readLatestEdition();
    if (!edition) {
      return sendJson(req, res, 503, {
        error: 'no-edition-yet',
        message: 'The first edition is still being built. Try again in a moment.',
        status: scheduler.status(),
      });
    }
    return sendJson(req, res, 200, {
      edition: { id: edition.id, createdAt: edition.createdAt, windowHours: edition.windowHours },
      stories: edition.stories,
      insights: edition.insights,
      meta: { ...edition.meta, reports: undefined },
      status: scheduler.status(),
    });
  }

  if (pathname === '/api/topics') {
    const edition = await readLatestEdition();
    const counts = new Map();
    for (const story of edition?.stories || []) {
      for (const theme of story.themes || []) counts.set(theme.id, (counts.get(theme.id) || 0) + 1);
    }
    return sendJson(req, res, 200, {
      topics: THEMES.map((theme) => ({
        id: theme.id,
        label: theme.label,
        count: counts.get(theme.id) || 0,
      })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    });
  }

  if (pathname === '/api/archive') {
    const index = await readIndex();
    const [current, ...archived] = index.editions;
    return sendJson(req, res, 200, {
      current: current || null,
      editions: archived,
      retentionDays: config.archiveRetentionDays,
    });
  }

  const editionMatch = /^\/api\/edition\/([^/]+)$/.exec(pathname);
  if (editionMatch) {
    const edition = await readEdition(decodeURIComponent(editionMatch[1]));
    if (!edition) return sendJson(req, res, 404, { error: 'not-found' });
    return sendJson(req, res, 200, {
      edition: { id: edition.id, createdAt: edition.createdAt, windowHours: edition.windowHours },
      stories: edition.stories,
      insights: edition.insights,
      meta: { ...edition.meta, reports: undefined },
    });
  }

  if (pathname === '/api/search') {
    const params = {
      q: (url.searchParams.get('q') || '').slice(0, 200),
      theme: (url.searchParams.get('theme') || '').slice(0, 60),
      source: (url.searchParams.get('source') || '').slice(0, 80),
      kind: (url.searchParams.get('kind') || '').slice(0, 20),
      from: (url.searchParams.get('from') || '').slice(0, 40),
      to: (url.searchParams.get('to') || '').slice(0, 40),
      limit: intParam(url, 'limit', config.searchPageSize, 200),
      offset: intParam(url, 'offset', 0, 100000),
    };
    const store = await cache.get('search-store', readSearchStore);
    const result = searchClippings(store, params);
    return sendJson(req, res, 200, {
      ...result,
      query: params,
      indexed: store.clippings.length,
    });
  }

  if (pathname === '/api/trends') {
    const payload = await cache.get(`trends:${url.searchParams.get('limit') || ''}`, async () => {
      const trends = await readTrends();
      return {
        ...themeTrends(trends, intParam(url, 'limit', 28, 200)),
        cves: entityLeaderboard(trends, 'cves', 20),
        actors: entityLeaderboard(trends, 'actors', 20),
        coverage: {
          editions: trends.editions.length,
          firstEdition: trends.editions[0]?.createdAt || null,
          lastEdition: trends.editions[trends.editions.length - 1]?.createdAt || null,
        },
      };
    });
    return sendJson(req, res, 200, payload);
  }

  if (pathname === '/api/skills') {
    const payload = await cache.get('skills', async () => skillTrends(await readTrends(), THEMES, SKILLS));
    return sendJson(req, res, 200, payload);
  }

  if (pathname === '/api/weekly') {
    const days = intParam(url, 'days', 7, 90);
    const payload = await cache.get(`weekly:${days}`, async () =>
      weeklyReview(await readTrends(), await readSearchStore(), THEMES, days),
    );
    return sendJson(req, res, 200, payload);
  }

  const entityMatch = /^\/api\/entity\/(cves|actors)\/(.+)$/.exec(pathname);
  if (entityMatch) {
    const trends = await readTrends();
    const detail = entityDetail(trends, entityMatch[1], decodeURIComponent(entityMatch[2]));
    if (!detail) return sendJson(req, res, 404, { error: 'not-found' });
    return sendJson(req, res, 200, detail);
  }

  if (pathname === '/api/glossary') {
    // Static for the life of the process; cached hard by the client.
    return sendJson(req, res, 200, { terms: GLOSSARY }, { cacheSeconds: 3600 });
  }

  if (pathname === '/api/connect') {
    const urls = await reachableUrls();
    const best = urls.find((u) => u.scope !== 'local') || urls[0];
    return sendJson(req, res, 200, {
      urls,
      best: best.url,
      anywhere: best.scope === 'tailnet',
      // A code for a loopback address would be useless on a phone.
      qr: best.host === '127.0.0.1' ? null : qrSvg(best.url, { scale: 5, quiet: 3 }),
      lanReady: best.host !== '127.0.0.1',
      port: config.port,
    });
  }

  if (pathname === '/api/sources') {
    const index = await readIndex();
    const reports = new Map((index.state.lastRun?.reports || []).map((r) => [r.id, r]));
    return sendJson(req, res, 200, {
      sources: SOURCES.map((source) => {
        const report = reports.get(source.id);
        return {
          id: source.id,
          name: source.name,
          kind: source.kind,
          weight: source.weight,
          topical: source.topical,
          url: source.url,
          site: (() => {
            try {
              return new URL(source.url).origin;
            } catch {
              return '';
            }
          })(),
          lastOk: report ? report.ok : null,
          lastCount: report ? report.count : null,
          lastError: report ? report.error : null,
        };
      }),
    });
  }

  // ---- reader profile --------------------------------------------------
  // These mutate only personal reading state - nothing they touch can start
  // network activity or change configuration - so they are not behind the
  // refresh token. They are rate limited like every other write.
  if (pathname === '/api/profile') {
    const edition = await readLatestEdition();

    if (req.method === 'POST') {
      const profile = await registerVisit(edition);
      return sendJson(req, res, 200, {
        ...publicView(profile, edition),
        watchActivity: watchActivity(profile, edition),
      });
    }

    const profile = await readProfile();
    return sendJson(req, res, 200, {
      ...publicView(profile, edition),
      watchActivity: watchActivity(profile, edition),
    });
  }

  if (pathname === '/api/profile/read' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const edition = await readLatestEdition();
    let profile;
    if (body.all === true) profile = await markAllRead(edition);
    else if (body.clear === true) profile = await clearRead();
    else profile = await markRead(body.ids || []);
    return sendJson(req, res, 200, publicView(profile, edition));
  }

  if (pathname === '/api/profile/watch' && req.method === 'POST') {
    const body = await readJsonBody(req);
    try {
      const profile = await toggleWatch(body.bucket, body.key, body.on);
      const edition = await readLatestEdition();
      return sendJson(req, res, 200, {
        watch: profile.watch,
        watchActivity: watchActivity(profile, edition),
      });
    } catch (err) {
      return sendJson(req, res, 400, { error: 'bad-request', message: err.message });
    }
  }

  if (pathname === '/api/refresh' && req.method === 'POST') {
    if (scheduler.status().refreshing) return sendJson(req, res, 409, { error: 'already-refreshing' });
    scheduler.refresh('manual').then(() => cache.invalidate()).catch(() => {});
    return sendJson(req, res, 202, { accepted: true });
  }

  return sendJson(req, res, 404, { error: 'unknown-endpoint' });
}

async function handleFeed(req, res, url) {
  const edition = await readLatestEdition();
  if (!edition) return send(req, res, 503, 'No edition yet', { type: 'text/plain; charset=utf-8' });
  const xml = renderRss(edition, {
    siteUrl: config.siteUrl,
    themeFilter: (url.searchParams.get('theme') || '').slice(0, 60),
  });
  return send(req, res, 200, xml, { type: 'application/rss+xml; charset=utf-8', cacheSeconds: 300 });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const address = clientAddress(req);

  if (!['GET', 'HEAD', 'POST'].includes(req.method)) {
    return sendJson(req, res, 405, { error: 'method-not-allowed' });
  }

  const run = (async () => {
    const mutating = req.method === 'POST';
    const personal = url.pathname.startsWith('/api/profile');

    // Rate limit before doing any work, so a flood costs almost nothing.
    const quota = personal
      ? limiter.take(`p:${address}`, config.profileRateLimit, config.readRateWindowMs)
      : mutating
        ? limiter.take(`w:${address}`, config.writeRateLimit, config.writeRateWindowMs)
        : limiter.take(`r:${address}`, config.readRateLimit, config.readRateWindowMs);
    if (!quota.allowed) {
      return sendJson(req, res, 429, { error: 'rate-limited', retryAfter: quota.retryAfter }, {
        extraHeaders: { 'retry-after': String(quota.retryAfter) },
      });
    }

    // Mutating endpoints always need the token. Reads need it only if asked,
    // and a request from this machine is always allowed through.
    const needsAuth = (mutating && !personal) || (config.requireAuthForReads && !isLoopback(address));
    if (needsAuth && !(await isAuthorised(req, url))) {
      return sendJson(req, res, 401, {
        error: 'unauthorised',
        message: 'Provide the API token via Authorization: Bearer <token>.',
      }, { extraHeaders: { 'www-authenticate': 'Bearer realm="sentinel-feed"' } });
    }

    if (url.pathname === '/feed.xml' || url.pathname === '/rss') return handleFeed(req, res, url);
    if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
    return serveStatic(req, res, url.pathname);
  })();

  run.catch((err) => {
    console.error('[server]', err);
    if (!res.headersSent) sendJson(req, res, 500, { error: 'internal', message: err.message });
    else res.end();
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[server] port ${config.port} is already in use - another copy is probably running.`);
    console.error('[server] check with: scripts/service.sh status');
  } else {
    console.error('[server] listen failed:', err.message);
  }
  process.exit(1);
});

server.listen(config.port, config.host, async () => {
  console.log(`[server] listening on http://${config.host}:${config.port}`);
  console.log(`[server] ${SOURCES.length} sources, refreshing every ${config.refreshHours}h`);

  const token = await getToken();
  if (!isLoopback(config.host) && config.host !== 'localhost') {
    console.log(`[server] reachable on the network at ${config.siteUrl}`);
    console.log(`[server] mutating endpoints require a token (source: ${token.source})`);
    if (token.source === 'generated') console.log(`[server] token: ${token.value}`);
  }

  // Icons are generated rather than committed; draw them on a fresh clone.
  try {
    await fs.access(path.join(publicDir, 'manifest.webmanifest'));
  } catch {
    console.log('[server] generating home-screen icons');
    await import('./scripts/make-icons.js').catch((err) => console.error('[server] icons:', err.message));
  }

  try {
    await scheduler.init();
    cache.invalidate();
  } catch (err) {
    console.error('[server] initial refresh failed:', err.message);
    console.error('[server] the site will serve whatever is on disk and retry on the next cycle');
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`\n[server] ${signal} - shutting down`);
    scheduler.stop();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
