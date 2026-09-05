/**
 * Rebuild trends.json and search.json from the editions on disk.
 * Use after changing the aggregate schema, or to backfill an existing archive.
 *
 *   node scripts/rebuild-aggregates.js
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';
import { readIndex, readEdition } from '../src/store.js';
import { updateAggregates } from '../src/aggregate.js';

const root = path.resolve(process.cwd(), config.dataDir);
await fs.rm(path.join(root, 'trends.json'), { force: true });
await fs.rm(path.join(root, 'search.json'), { force: true });

const index = await readIndex();
// Oldest first so first/last sightings and the theme series come out in order.
const ordered = [...index.editions].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

let done = 0;
for (const summary of ordered) {
  const edition = await readEdition(summary.id);
  if (!edition) continue;
  await updateAggregates(edition);
  done += 1;
  process.stdout.write(`\r  rebuilt ${done}/${ordered.length} editions`);
}
console.log(`\n\nRebuilt aggregates from ${done} editions.`);
