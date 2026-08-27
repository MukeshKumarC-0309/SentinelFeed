/**
 * Poll every source once and report what came back.
 * Use this after editing src/sources.js, or when a feed looks stale.
 *
 *   npm run sources
 */
import { SOURCES } from '../src/sources.js';
import { collectFeedItems } from '../src/feeds.js';

const started = Date.now();
const { reports } = await collectFeedItems(SOURCES);

const ok = reports.filter((r) => r.ok && r.count > 0);
const empty = reports.filter((r) => r.ok && r.count === 0);
const failed = reports.filter((r) => !r.ok);

const pad = (value, width) => String(value).padEnd(width);

console.log(`\nPolled ${reports.length} sources in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
for (const report of [...reports].sort((a, b) => a.name.localeCompare(b.name))) {
  const mark = report.ok ? (report.count > 0 ? 'ok  ' : 'warn') : 'FAIL';
  const detail = report.ok ? `${report.count} items` : report.error;
  console.log(`  ${mark}  ${pad(report.name, 26)} ${pad(`${report.ms}ms`, 8)} ${detail}`);
}

console.log(`\n  healthy: ${ok.length}   empty: ${empty.length}   failed: ${failed.length}`);
if (empty.length) console.log(`  empty:  ${empty.map((r) => r.name).join(', ')}`);
if (failed.length) console.log(`  failed: ${failed.map((r) => `${r.name} (${r.error})`).join(', ')}`);
console.log('');

process.exit(failed.length ? 1 : 0);
