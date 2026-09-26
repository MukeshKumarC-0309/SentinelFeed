/**
 * Run the background-service script for this platform, so the npm service
 * commands work the same on macOS and Windows.
 *   node scripts/service.js <install|uninstall|status|stop|restart|logs|refresh> [options]
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = (name) => fileURLToPath(new URL(name, import.meta.url));
const args = process.argv.slice(2);

const [command, commandArgs] =
  process.platform === 'win32'
    ? ['powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script('service.ps1'), ...args]]
    : ['bash', [script('service.sh'), ...args]];

const result = spawnSync(command, commandArgs, { stdio: 'inherit' });
if (result.error) {
  console.error(`error: could not run ${command}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
