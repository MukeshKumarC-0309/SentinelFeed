/**
 * The reader's own state: what they have already been shown, what they opened,
 * and what they follow.
 *
 * One profile, stored server-side, because this is a personal instrument read
 * from more than one device - a phone on the sofa and a laptop at a desk should
 * agree about what is new. There are no accounts and no identity: the profile
 * belongs to whoever can reach the server, which is the same trust boundary the
 * rest of the site already has.
 *
 * Two distinct states, deliberately:
 *
 *   seen  ids the reader was shown on a previous visit. Drives "new since you
 *         last looked" - the count that makes a 12-hour cycle feel like it
 *         moved, given roughly half of each edition repeats the last one.
 *   read  ids the reader actually opened. Drives the quiet dimming of clippings
 *         they have already gone through.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const profilePath = () => path.resolve(process.cwd(), config.dataDir, 'profile.json');

const EMPTY = {
  version: 1,
  lastVisitAt: null,
  lastSeenEdition: null,
  /** id -> epoch ms, so entries can age out. */
  seen: {},
  read: {},
  /** Ids marked new at the last edition change, held stable within a cycle. */
  newIds: [],
  watch: { cves: [], actors: [], topics: [], sources: [] },
};

/** Serialise writes: several tabs marking things read must not clobber each other. */
let writeChain = Promise.resolve();

async function writeJson(file, value) {
  const temp = `${file}.${process.pid}.tmp`;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(temp, JSON.stringify(value), 'utf8');
  await fs.rename(temp, file);
}

export async function readProfile() {
  try {
    const parsed = JSON.parse(await fs.readFile(profilePath(), 'utf8'));
    return {
      ...structuredClone(EMPTY),
      ...parsed,
      seen: parsed.seen || {},
      read: parsed.read || {},
      newIds: Array.isArray(parsed.newIds) ? parsed.newIds : [],
      watch: { ...EMPTY.watch, ...(parsed.watch || {}) },
    };
  } catch {
    return structuredClone(EMPTY);
  }
}

/** Apply `mutate` to the profile and persist, one writer at a time. */
function updateProfile(mutate) {
  const next = writeChain.then(async () => {
    const profile = await readProfile();
    const result = (await mutate(profile)) ?? profile;
    prune(result);
    await writeJson(profilePath(), result);
    return result;
  });
  // Keep the chain alive even if one write fails.
  writeChain = next.catch(() => {});
  return next;
}

/** Age out ids so the profile cannot grow without bound. */
function prune(profile) {
  if (!(config.archiveRetentionDays > 0)) return;
  const cutoff = Date.now() - config.archiveRetentionDays * 86400000;
  for (const bucket of ['seen', 'read']) {
    for (const [id, at] of Object.entries(profile[bucket])) {
      if (!Number.isFinite(at) || at < cutoff) delete profile[bucket][id];
    }
  }
}

/**
 * Register a visit to an edition and work out what is new.
 *
 * The new set is computed once per edition change and then held, so revisiting
 * the same edition during a cycle does not silently empty the page of "new".
 */
export async function registerVisit(edition) {
  if (!edition?.stories?.length) return readProfile();

  return updateProfile((profile) => {
    const now = Date.now();
    profile.lastVisitAt = new Date(now).toISOString();

    if (profile.lastSeenEdition === edition.id) return profile;

    // First sight of this edition: anything not shown before is new.
    profile.newIds = edition.stories.filter((s) => !profile.seen[s.id]).map((s) => s.id);
    for (const story of edition.stories) profile.seen[story.id] = now;
    profile.lastSeenEdition = edition.id;
    return profile;
  });
}

export async function markRead(ids = []) {
  const list = (Array.isArray(ids) ? ids : [ids]).filter((id) => typeof id === 'string' && id.length <= 64).slice(0, 400);
  if (!list.length) return readProfile();
  return updateProfile((profile) => {
    const now = Date.now();
    for (const id of list) profile.read[id] = now;
    return profile;
  });
}

export async function markAllRead(edition) {
  return markRead((edition?.stories || []).map((s) => s.id));
}

export async function clearRead() {
  return updateProfile((profile) => {
    profile.read = {};
    return profile;
  });
}

const WATCH_BUCKETS = new Set(['cves', 'actors', 'topics', 'sources']);

/** Follow or unfollow one entity. Returns the updated profile. */
export async function toggleWatch(bucket, key, on) {
  if (!WATCH_BUCKETS.has(bucket)) throw new Error(`unknown watch bucket: ${bucket}`);
  const value = String(key || '').trim().slice(0, 80);
  if (!value) throw new Error('empty watch key');

  return updateProfile((profile) => {
    const list = new Set(profile.watch[bucket] || []);
    const shouldAdd = on === undefined ? !list.has(value) : Boolean(on);
    if (shouldAdd) list.add(value);
    else list.delete(value);
    // Bounded so the cover cannot fill up with follows.
    profile.watch[bucket] = [...list].slice(0, 40);
    return profile;
  });
}

/** The shape the client needs: sets as arrays, plus a couple of counts. */
export function publicView(profile, edition) {
  const storyIds = new Set((edition?.stories || []).map((s) => s.id));
  const newIds = profile.newIds.filter((id) => storyIds.has(id));
  const readInEdition = [...storyIds].filter((id) => profile.read[id]);

  return {
    lastVisitAt: profile.lastVisitAt,
    lastSeenEdition: profile.lastSeenEdition,
    newIds,
    newCount: newIds.length,
    readIds: readInEdition,
    readCount: readInEdition.length,
    watch: profile.watch,
  };
}

/**
 * What the reader's follows have done in this edition.
 *
 * Returns only entries with activity, newest first, so the cover stays silent
 * until something the reader actually asked about moves.
 */
export function watchActivity(profile, edition) {
  const stories = edition?.stories || [];
  const newIds = new Set(profile.newIds || []);
  const hits = [];

  const record = (bucket, key, label, matched) => {
    if (!matched.length) return;
    const fresh = matched.filter((s) => newIds.has(s.id));
    hits.push({
      bucket,
      key,
      label,
      total: matched.length,
      new: fresh.length,
      stories: (fresh.length ? fresh : matched).slice(0, 3).map((s) => ({
        id: s.id,
        title: s.title,
        url: s.url,
        source: s.sourceName,
      })),
    });
  };

  for (const cve of profile.watch.cves || []) {
    const needle = cve.toUpperCase();
    record('cves', cve, cve, stories.filter((s) => `${s.title} ${s.summary}`.toUpperCase().includes(needle)));
  }

  for (const actor of profile.watch.actors || []) {
    const needle = actor.toLowerCase();
    record('actors', actor, actor, stories.filter((s) => `${s.title} ${s.summary}`.toLowerCase().includes(needle)));
  }

  for (const topic of profile.watch.topics || []) {
    const matched = stories.filter((s) => (s.themes || []).some((t) => t.id === topic));
    const label = matched[0]?.themes?.find((t) => t.id === topic)?.label || topic;
    record('topics', topic, label, matched);
  }

  for (const source of profile.watch.sources || []) {
    record('sources', source, source, stories.filter((s) => s.sourceName === source));
  }

  return hits.sort((a, b) => b.new - a.new || b.total - a.total);
}
