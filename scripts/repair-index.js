/**
 * Bring the archive index back in line with the editions on disk:
 *   - editions that were published empty are removed, and
 *   - edition files the index has lost track of are listed again.
 * The index then points at the most recent edition that has stories.
 *
 *   node scripts/repair-index.js
 *
 * Stop the server first, so it cannot write the index at the same time.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';
import { readIndex, writeIndex, readEdition, summarise } from '../src/store.js';

const editionsDir = path.resolve(process.cwd(), config.dataDir, 'editions');
const index = await readIndex();

const onDisk = (await fs.readdir(editionsDir))
  .filter((f) => /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{4}Z\.json$/.test(f))
  .map((f) => f.slice(0, -5));
const ids = new Set([...index.editions.map((e) => e.id), ...onDisk]);

const empties = [];
const keep = [];
let adopted = 0;
for (const id of ids) {
  const edition = await readEdition(id);
  if (!edition || edition.stories.length === 0) {
    empties.push(id);
    continue;
  }
  const listed = index.editions.find((e) => e.id === id);
  if (!listed) adopted += 1;
  keep.push(listed || summarise(edition));
}

if (!empties.length && !adopted) {
  console.log('Index matches the editions on disk; nothing to repair.');
  process.exit(0);
}

for (const id of empties) await fs.rm(path.join(editionsDir, `${id}.json`), { force: true });

index.editions = keep.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
const newest = index.editions[0];
index.state.lastEditionId = newest ? newest.id : null;
index.state.lastRefreshAt = newest ? newest.createdAt : null;

const restored = newest ? await readEdition(newest.id) : null;
if (restored) index.state.lastRun = restored.meta;

await writeIndex(index);
if (empties.length) console.log(`Removed ${empties.length} empty edition(s): ${empties.join(', ')}`);
if (adopted) console.log(`Re-listed ${adopted} edition(s) the index had lost.`);
console.log(`${index.editions.length} editions on record; current is ${index.state.lastEditionId} (${restored?.stories.length ?? 0} stories).`);
console.log('If editions were re-listed, run: node scripts/rebuild-aggregates.js');
