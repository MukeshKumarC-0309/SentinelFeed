import { promises as fs } from 'node:fs';

// Windows refuses to replace a file another process has open. Antivirus
// scanners, search indexers and OneDrive all open freshly written files
// briefly, so a rename that fails with one of these usually succeeds moments
// later. Elsewhere these codes are rare and the retry costs nothing.
const TRANSIENT = new Set(['EPERM', 'EACCES', 'EBUSY']);
const DELAYS_MS = [50, 100, 200, 400, 800, 1600];

/**
 * Write JSON atomically: to a temporary file first, then renamed over the
 * target, so a crash mid-write can never leave a half-written file behind.
 */
export async function writeJsonAtomic(file, value, { pretty = false } = {}) {
  const temp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(value, null, pretty ? 2 : 0), 'utf8');
  for (let attempt = 0; ; attempt += 1) {
    try {
      await fs.rename(temp, file);
      return;
    } catch (err) {
      if (!TRANSIENT.has(err.code) || attempt >= DELAYS_MS.length) {
        await fs.unlink(temp).catch(() => {});
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, DELAYS_MS[attempt]));
    }
  }
}
