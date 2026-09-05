import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const root = path.resolve(process.cwd(), config.dataDir);
const editionsDir = path.join(root, 'editions');
const indexPath = path.join(root, 'index.json');

const EMPTY_INDEX = {
  version: 1,
  state: {
    lastRefreshAt: null,
    lastEditionId: null,
    previousShares: {},
    lastRun: null,
  },
  editions: [],
};

async function ensureDirs() {
  await fs.mkdir(editionsDir, { recursive: true });
}

/** Write JSON atomically so a crash mid-write cannot corrupt the archive. */
async function writeJson(file, value) {
  const temp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(temp, file);
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export async function readIndex() {
  await ensureDirs();
  const index = await readJson(indexPath, null);
  if (!index || !Array.isArray(index.editions)) return structuredClone(EMPTY_INDEX);
  return { ...structuredClone(EMPTY_INDEX), ...index, state: { ...EMPTY_INDEX.state, ...(index.state || {}) } };
}

export async function writeIndex(index) {
  await ensureDirs();
  await writeJson(indexPath, index);
}

/** Stable, sortable, filename-safe edition id: 2026-09-20T0730Z */
export function editionId(date = new Date()) {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}Z`;
}

const editionFile = (id) => path.join(editionsDir, `${id}.json`);

export async function readEdition(id) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{4}Z$/.test(String(id))) return null;
  return readJson(editionFile(id), null);
}

/** Summary row kept in index.json so the archive list loads without reading every edition. */
function summarise(edition) {
  return {
    id: edition.id,
    createdAt: edition.createdAt,
    storyCount: edition.stories.length,
    sourceCount: edition.meta.sourcesOk,
    leadHeadline: edition.stories[0]
      ? { title: edition.stories[0].title, url: edition.stories[0].url, source: edition.stories[0].sourceName }
      : null,
    topThemes: (edition.insights?.themes || []).slice(0, 3).map((t) => ({ label: t.label, share: t.share })),
  };
}

/**
 * Persist a new edition, roll the previous one into the archive, and prune
 * anything past the retention window.
 */
export async function saveEdition(edition, { previousShares }) {
  await ensureDirs();
  await writeJson(editionFile(edition.id), edition);

  const index = await readIndex();
  index.editions = [summarise(edition), ...index.editions.filter((e) => e.id !== edition.id)].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
  index.state.lastRefreshAt = edition.createdAt;
  index.state.lastEditionId = edition.id;
  index.state.previousShares = previousShares;
  index.state.lastRun = edition.meta;

  if (config.archiveRetentionDays > 0) {
    const cutoff = Date.now() - config.archiveRetentionDays * 86400000;
    const keep = [];
    for (const summary of index.editions) {
      // The newest edition is never pruned, whatever the retention setting.
      if (summary.id === edition.id || Date.parse(summary.createdAt) >= cutoff) {
        keep.push(summary);
      } else {
        await fs.rm(editionFile(summary.id), { force: true });
      }
    }
    index.editions = keep;
  }

  await writeIndex(index);
  return index;
}

/** The current edition, or null before the first refresh completes. */
export async function readLatestEdition() {
  const index = await readIndex();
  if (!index.state.lastEditionId) return null;
  return readEdition(index.state.lastEditionId);
}

export { root as dataRoot };
