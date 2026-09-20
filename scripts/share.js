/**
 * Print the URLs the running server is reachable on, plus a QR code for the
 * best one, rendered as terminal blocks so a phone can scan it off the screen.
 *
 * The addresses come from the server rather than from this process, because
 * only the server knows which interface it actually bound to.
 */
import { encodeQr } from '../src/qr.js';
import { config } from '../src/config.js';

const base = `http://127.0.0.1:${config.port}`;

let data;
try {
  const res = await fetch(`${base}/api/connect`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  data = await res.json();
} catch (err) {
  console.error(`\n  Could not reach the server on ${base} (${err.message}).`);
  console.error('  Start it with: sentinel\n');
  process.exit(1);
}

console.log('\n  SENTINEL FEED\n');
for (const entry of data.urls) {
  console.log(`  ${entry.url.padEnd(34)} ${entry.label}`);
}

if (!data.lanReady) {
  console.log('\n  Reachable from this machine only. To open it on your phone:');
  console.log('    HOST=0.0.0.0 npm run service:install\n');
  process.exit(0);
}

const { size, modules } = encodeQr(data.best);
const quiet = 2;
const at = (r, c) => (r < 0 || r >= size || c < 0 || c >= size ? 0 : modules[r][c]);

console.log(`\n  Scan to open ${data.best}\n`);

const lines = [];
for (let row = -quiet; row < size + quiet; row += 2) {
  let line = '  ';
  for (let col = -quiet; col < size + quiet; col += 1) {
    const top = at(row, col);
    const bottom = at(row + 1, col);
    // Printed black-on-white, so a dark module has to render as ink.
    if (top && bottom) line += '█';
    else if (top) line += '▀';
    else if (bottom) line += '▄';
    else line += ' ';
  }
  lines.push(line);
}
console.log(`\x1b[47m\x1b[30m${lines.join('\x1b[0m\n\x1b[47m\x1b[30m')}\x1b[0m`);
console.log(`\n  Refresh cycle: every ${config.refreshHours}h\n`);
