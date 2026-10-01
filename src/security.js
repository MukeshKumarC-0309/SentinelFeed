/**
 * Access control and abuse limits.
 *
 * The site is meant to be reachable from your own devices - a phone on the
 * LAN, another laptop over Tailscale - which means it is no longer only
 * addressable by processes already on this machine. Reads stay open because
 * the content is public reporting; anything that *changes* state needs a token.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';
import { readJsonFile } from './atomic.js';

const secretPath = () => path.resolve(process.cwd(), config.dataDir, 'secret.json');

let cachedToken = null;

/**
 * The API token, in order of preference:
 *   1. SENTINEL_TOKEN from the environment
 *   2. a token generated on first boot and stored 0600 next to the data
 */
export async function getToken() {
  if (cachedToken) return cachedToken;

  if (process.env.SENTINEL_TOKEN) {
    cachedToken = { value: process.env.SENTINEL_TOKEN, source: 'environment' };
    return cachedToken;
  }

  // Only a missing file means "mint one": an unreadable token file must not
  // be silently replaced, or every client holding the old token breaks.
  const stored = await readJsonFile(secretPath(), null);
  if (stored?.token) {
    cachedToken = { value: stored.token, source: 'data/secret.json' };
    return cachedToken;
  }

  const token = randomBytes(24).toString('base64url');
  await fs.mkdir(path.dirname(secretPath()), { recursive: true });
  await fs.writeFile(secretPath(), JSON.stringify({ token, createdAt: new Date().toISOString() }, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
  await fs.chmod(secretPath(), 0o600).catch(() => {});
  cachedToken = { value: token, source: 'generated' };
  return cachedToken;
}

/** Constant-time compare that does not leak length through early exit. */
function sameToken(a, b) {
  const left = Buffer.from(String(a ?? ''));
  const right = Buffer.from(String(b ?? ''));
  if (left.length !== right.length) {
    // Still spend the comparison so timing does not reveal the length.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

/** Read a bearer token from the standard places a client might put it. */
export function presentedToken(req, url) {
  const header = req.headers.authorization || '';
  const bearer = /^Bearer\s+(.+)$/i.exec(header);
  if (bearer) return bearer[1].trim();
  if (req.headers['x-sentinel-token']) return String(req.headers['x-sentinel-token']).trim();
  // Query parameter is accepted so a webhook or curl one-liner stays simple.
  return url.searchParams.get('token') || '';
}

export async function isAuthorised(req, url) {
  const token = await getToken();
  return sameToken(presentedToken(req, url), token.value);
}

/**
 * Fixed-window rate limiter, per client address and bucket.
 *
 * Deliberately simple: this guards a personal service against a misbehaving
 * script or a refresh button held down, not against a distributed attacker.
 */
export class RateLimiter {
  constructor() {
    this.buckets = new Map();
    const timer = setInterval(() => this.sweep(), 60000);
    timer.unref?.();
  }

  sweep() {
    const now = Date.now();
    for (const [key, entry] of this.buckets) {
      if (entry.resetAt <= now) this.buckets.delete(key);
    }
  }

  /** Returns { allowed, remaining, retryAfter } without throwing. */
  take(key, limit, windowMs) {
    const now = Date.now();
    const entry = this.buckets.get(key);

    if (!entry || entry.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1, retryAfter: 0 };
    }

    entry.count += 1;
    if (entry.count > limit) {
      return { allowed: false, remaining: 0, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
    }
    return { allowed: true, remaining: limit - entry.count, retryAfter: 0 };
  }
}

/** Client address, honouring a proxy header only when explicitly trusted. */
export function clientAddress(req) {
  if (config.trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return String(forwarded).split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

/** True for addresses that are on this machine. */
export function isLoopback(address) {
  const value = String(address || '');
  return value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1';
}
