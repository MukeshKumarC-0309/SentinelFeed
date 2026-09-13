import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from './config.js';

// Asynchronous on purpose: these run inside the server, and a synchronous
// child process would stall every other request while it ran (about 0.3s
// cold for the Tailscale client, up to the timeout if it hangs).
const run = promisify(execFile);

/** The machine's Bonjour name, which resolves on most home and office LANs. */
async function localHostname() {
  try {
    const { stdout } = await run('scutil', ['--get', 'LocalHostName'], { timeout: 2000 });
    const name = stdout.trim();
    if (name) return `${name}.local`;
  } catch {
    /* not macOS, or scutil unavailable */
  }
  const host = os.hostname();
  return host.endsWith('.local') ? host : `${host}.local`;
}

/** Tailscale hands out addresses from the 100.64.0.0/10 shared range. */
export function isTailnetIPv4(address) {
  const [a, b] = String(address).split('.').map(Number);
  return a === 100 && b >= 64 && b <= 127;
}

const TAILSCALE_CLIS = ['/Applications/Tailscale.app/Contents/MacOS/Tailscale', 'tailscale'];
const CACHE_MS = 30000;

let cached = { at: 0, value: null };
let inFlight = null;

async function lookupTailnet() {
  for (const cli of TAILSCALE_CLIS) {
    try {
      const { stdout } = await run(cli, ['status', '--json'], {
        timeout: 3000,
        // The macOS app binary only acts as a CLI when it can tell it was run
        // from a terminal. Under launchd there is no terminal, so without this
        // it tries to open the GUI and fails. TAILSCALE_BE_CLI forces CLI mode.
        env: { ...process.env, TAILSCALE_BE_CLI: '1' },
      });
      const status = JSON.parse(stdout);
      if (status.BackendState !== 'Running') return null;
      const ipv4 = (status.Self?.TailscaleIPs || []).find((ip) => ip.includes('.')) || null;
      const dnsName = (status.Self?.DNSName || '').replace(/\.$/, '') || null;
      return { ipv4, dnsName: status.CurrentTailnet?.MagicDNSEnabled === false ? null : dnsName };
    } catch {
      /* try the next place the client might live */
    }
  }

  // No client answered, but an interface already holds a tailnet address.
  for (const addrs of Object.values(os.networkInterfaces())) {
    const hit = (addrs || []).find((a) => a.family === 'IPv4' && isTailnetIPv4(a.address));
    if (hit) return { ipv4: hit.address, dnsName: null };
  }
  return null;
}

/**
 * This machine's identity on the tailnet, or null if Tailscale is absent or
 * signed out. Cached briefly, and concurrent callers share one lookup.
 */
async function tailnetSelf() {
  if (Date.now() - cached.at < CACHE_MS) return cached.value;
  inFlight ??= lookupTailnet()
    .then((value) => {
      cached = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/**
 * Every address this server can realistically be reached on, best first.
 *
 * `scope` says where each one works, which is what a reader choosing a link
 * needs to know: the tailnet reaches a signed-in phone from anywhere, the
 * others only on the same Wi-Fi.
 */
export async function reachableUrls(port = config.port) {
  const urls = [];
  const add = (host, scope, label) => {
    const url = `http://${host}:${port}`;
    if (!urls.some((u) => u.url === url)) urls.push({ url, host, scope, label });
  };

  const bindsEverywhere = config.host === '0.0.0.0' || config.host === '::';

  if (bindsEverywhere) {
    const [tailnet, bonjour] = await Promise.all([tailnetSelf(), localHostname()]);
    if (tailnet?.dnsName) add(tailnet.dnsName, 'tailnet', 'Tailscale — works anywhere your phone is signed in');
    if (tailnet?.ipv4) add(tailnet.ipv4, 'tailnet', 'Tailscale address — same, if the name will not resolve');

    add(bonjour, 'lan', 'Name on this Wi-Fi — same network only');
    for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
      // Tunnel interfaces are VPNs and relays, not the local network.
      if (name.startsWith('utun')) continue;
      for (const addr of addrs || []) {
        if (addr.family !== 'IPv4' || addr.internal || isTailnetIPv4(addr.address)) continue;
        add(addr.address, 'lan', `Address on ${name} — same network only, changes`);
      }
    }
  }

  add('127.0.0.1', 'local', bindsEverywhere ? 'This machine only' : 'This machine only (server is bound to loopback)');
  return urls;
}
