import { config } from './config.js';
import { runRefresh, RefreshAbandoned } from './pipeline.js';
import { readIndex } from './store.js';

const REFRESH_MS = () => config.refreshHours * 3600000;

/**
 * Drives the 12-hour cycle.
 *
 * The due time is derived from the persisted timestamp of the last edition
 * rather than from an interval timer, so restarts, and a laptop that was
 * asleep past the deadline, both resolve correctly: the app refreshes once on
 * waking and then settles back onto the original cadence.
 */
export class Scheduler {
  constructor({ log = console.log } = {}) {
    this.log = log;
    this.timer = null;
    this.running = false;
    this.lastError = null;
    this.lastRefreshAt = null;
    this.retryAt = null;
    this.startedAt = new Date().toISOString();
  }

  async init() {
    const index = await readIndex();
    this.lastRefreshAt = index.state.lastRefreshAt;

    if (!this.lastRefreshAt) {
      this.log('[scheduler] no edition on disk - building the first one now');
      await this.refresh('initial');
    } else if (this.isDue()) {
      const ageHours = (Date.now() - Date.parse(this.lastRefreshAt)) / 3600000;
      this.log(`[scheduler] last edition is ${ageHours.toFixed(1)}h old - refreshing now`);
      await this.refresh('stale-on-start');
    } else {
      this.log(`[scheduler] next edition due ${new Date(this.nextRefreshAt()).toISOString()}`);
    }

    this.timer = setInterval(() => {
      this.tick().catch((err) => this.log(`[scheduler] tick failed: ${err.message}`));
    }, config.tickSeconds * 1000);
    this.timer.unref?.();
  }

  nextRefreshAt() {
    // An abandoned run reschedules soon: its cause is usually a sleeping
    // laptop or a dropped network, both of which clear on their own.
    if (this.retryAt) return this.retryAt;
    if (!this.lastRefreshAt) return Date.now();
    return Date.parse(this.lastRefreshAt) + REFRESH_MS();
  }

  isDue() {
    return Date.now() >= this.nextRefreshAt();
  }

  async tick() {
    if (this.running) return;
    // An edition may have been written by `npm run refresh` while the server
    // was up; trust the newer timestamp on disk over the one held in memory.
    const index = await readIndex();
    const onDisk = index.state.lastRefreshAt;
    if (onDisk && (!this.lastRefreshAt || Date.parse(onDisk) > Date.parse(this.lastRefreshAt))) {
      this.lastRefreshAt = onDisk;
    }
    if (!this.isDue()) return;
    await this.refresh('scheduled');
  }

  /** Run one refresh. Concurrent calls are ignored rather than queued. */
  async refresh(reason = 'manual') {
    if (this.running) return { skipped: true, reason: 'already running' };
    this.running = true;
    try {
      this.log(`[scheduler] refresh (${reason})`);
      const edition = await runRefresh({ log: this.log });
      this.lastRefreshAt = edition.createdAt;
      this.retryAt = null;
      this.lastError = null;
      this.log(`[scheduler] next edition due ${new Date(this.nextRefreshAt()).toISOString()}`);
      return { skipped: false, editionId: edition.id };
    } catch (err) {
      this.lastError = { message: err.message, at: new Date().toISOString() };

      if (err instanceof RefreshAbandoned) {
        this.retryAt = Date.now() + config.retryAfterFailureMinutes * 60000;
        this.log(`[scheduler] run abandoned: ${err.message}`);
        this.log(`[scheduler] previous edition kept; retrying ${new Date(this.retryAt).toISOString()}`);
        return { skipped: true, reason: 'abandoned' };
      }

      this.log(`[scheduler] refresh failed: ${err.stack || err.message}`);
      // An unexpected failure waits a cycle rather than hammering feeds.
      this.lastRefreshAt = new Date().toISOString();
      throw err;
    } finally {
      this.running = false;
    }
  }

  status() {
    return {
      refreshing: this.running,
      lastRefreshAt: this.lastRefreshAt,
      nextRefreshAt: new Date(this.nextRefreshAt()).toISOString(),
      refreshHours: config.refreshHours,
      serverStartedAt: this.startedAt,
      lastError: this.lastError,
      retryScheduled: this.retryAt ? new Date(this.retryAt).toISOString() : null,
    };
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
