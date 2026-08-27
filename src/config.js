/**
 * Central tunables. Everything here can be overridden with environment
 * variables so the app can be redeployed without editing code.
 */
const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Like `num`, but 0 is a meaningful value (e.g. "disable enrichment"). */
const count = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export const config = {
  port: num(process.env.PORT, 4173),
  host: process.env.HOST || '127.0.0.1',

  /** Refresh cadence. 12 hours is the product requirement. */
  refreshHours: num(process.env.REFRESH_HOURS, 12),

  /** How often the scheduler wakes to check whether an edition is due. */
  tickSeconds: num(process.env.TICK_SECONDS, 60),

  /** Network behaviour when pulling feeds and articles. */
  fetchTimeoutMs: num(process.env.FETCH_TIMEOUT_MS, 15000),
  /** Feeds get longer than article fetches: losing one costs a whole source. */
  feedTimeoutMs: num(process.env.FEED_TIMEOUT_MS, 25000),
  retryDelayMs: num(process.env.RETRY_DELAY_MS, 1500),
  feedConcurrency: num(process.env.FEED_CONCURRENCY, 12),
  articleConcurrency: num(process.env.ARTICLE_CONCURRENCY, 4),
  perHostDelayMs: num(process.env.PER_HOST_DELAY_MS, 400),
  userAgent:
    process.env.USER_AGENT ||
    'SentinelFeed/1.0 (cybersecurity news aggregator; +http://localhost)',

  /**
   * Cap on items taken from any single feed. Some publishers return their
   * entire history (1000+ entries); without this, one feed could dominate the
   * corpus and slow every refresh.
   */
  maxItemsPerSource: num(process.env.MAX_ITEMS_PER_SOURCE, 60),

  /** Only stories published within this window are eligible for an edition. */
  maxStoryAgeHours: num(process.env.MAX_STORY_AGE_HOURS, 72),

  /** Size of the front-page briefing. */
  briefingSize: num(process.env.BRIEFING_SIZE, 60),

  /** A summary shorter than this triggers a fetch of the article itself. */
  minSummaryChars: num(process.env.MIN_SUMMARY_CHARS, 340),
  targetSummaryChars: num(process.env.TARGET_SUMMARY_CHARS, 560),
  maxSummaryChars: num(process.env.MAX_SUMMARY_CHARS, 760),

  /**
   * Refresh safety floor. A cycle that reaches almost nothing - the machine was
   * asleep, the network was down - must not replace a good edition with an
   * empty one, so the run is abandoned instead of published.
   */
  minSourcesOkRatio: Number(process.env.MIN_SOURCES_OK_RATIO ?? 0.25),
  /** How soon to try again after a run was abandoned, in minutes. */
  retryAfterFailureMinutes: num(process.env.RETRY_AFTER_FAILURE_MINUTES, 30),

  /** A clipping below this length is held back from the front page. */
  minPublishableChars: num(process.env.MIN_PUBLISHABLE_CHARS, 150),

  /** Cap on article page fetches per refresh, to stay a polite consumer. */
  maxEnrichments: count(process.env.MAX_ENRICHMENTS, 60),

  /** Editions older than this are pruned from the archive. 0 = keep forever. */
  archiveRetentionDays: count(process.env.ARCHIVE_RETENTION_DAYS, 365),

  dataDir: process.env.DATA_DIR || 'data',

  // ---- Serving -----------------------------------------------------------
  /** Public base URL, used in the RSS feed and outbound notifications. */
  siteUrl: (process.env.SITE_URL || `http://${process.env.HOST || '127.0.0.1'}:${num(process.env.PORT, 4173)}`).replace(/\/+$/, ''),

  /** Honour X-Forwarded-For. Only enable behind a proxy you control. */
  trustProxy: process.env.TRUST_PROXY === '1',

  /** Require a token for read endpoints too, not just mutating ones. */
  requireAuthForReads: process.env.REQUIRE_AUTH_FOR_READS === '1',

  readRateLimit: num(process.env.READ_RATE_LIMIT, 300),
  readRateWindowMs: num(process.env.READ_RATE_WINDOW_MS, 60000),
  writeRateLimit: num(process.env.WRITE_RATE_LIMIT, 6),
  /** Reading-state writes are frequent and cheap, so they get their own budget. */
  profileRateLimit: num(process.env.PROFILE_RATE_LIMIT, 240),
  writeRateWindowMs: num(process.env.WRITE_RATE_WINDOW_MS, 3600000),

  /** Compress responses above this size when the client accepts gzip. */
  gzipThreshold: num(process.env.GZIP_THRESHOLD, 1024),

  searchPageSize: num(process.env.SEARCH_PAGE_SIZE, 60),

  // ---- Delivery ----------------------------------------------------------
  webhookUrl: process.env.WEBHOOK_URL || '',
  webhookUrgentOnly: process.env.WEBHOOK_URGENT_ONLY === '1',

  emailProvider: (process.env.EMAIL_PROVIDER || '').toLowerCase(),
  emailApiKey: process.env.EMAIL_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || '',
  emailTo: process.env.EMAIL_TO || '',
  emailStoryLimit: num(process.env.EMAIL_STORY_LIMIT, 12),
  mailgunDomain: process.env.MAILGUN_DOMAIN || '',
};
