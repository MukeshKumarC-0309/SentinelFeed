/**
 * Drop editions that were published empty and point the index back at the most
 * recent edition that actually has stories.
 *
 *   node scripts/repair-index.js
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';
import { readIndex, writeIndex, readEdition } from '../src/store.js';

const editionsDir = path.resolve(process.cwd(), config.dataDir, 'editions');
const index = await readIndex();

const empties = [];
const keep = [];
for (const summary of index.editions) {
  const edition = await readEdition(summary.id);
  if (!edition || edition.stories.length === 0) empties.push(summary.id);
  else keep.push(summary);
}

if (!empties.length) {
  console.log('No empty editions found; index is healthy.');
  process.exit(0);
}

for (const id of empties) await fs.rm(path.join(editionsDir, `${id}.json`), { force: true });

index.editions = keep;
const newest = keep[0];
index.state.lastEditionId = newest ? newest.id : null;
index.state.lastRefreshAt = newest ? newest.createdAt : null;

const restored = newest ? await readEdition(newest.id) : null;
if (restored) index.state.lastRun = restored.meta;

await writeIndex(index);
console.log(`Removed ${empties.length} empty edition(s): ${empties.join(', ')}`);
console.log(`Current edition is now ${index.state.lastEditionId} (${restored?.stories.length ?? 0} stories).`);
