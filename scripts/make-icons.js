/**
 * Generate the home-screen icons and the web app manifest.
 *   node scripts/make-icons.js
 *
 * The server also runs this on startup when the manifest is missing, so a
 * fresh clone needs no extra step.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderIcon } from '../src/icon.js';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const dir = path.join(publicDir, 'icons');
await fs.mkdir(dir, { recursive: true });

const targets = [
  { name: 'icon-180.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-512.png', size: 512, padded: true },
];

for (const target of targets) {
  const png = renderIcon(target.size, { padded: target.padded });
  await fs.writeFile(path.join(dir, target.name), png);
  console.log(`  ${target.name.padEnd(26)} ${(png.length / 1024).toFixed(1)} KB`);
}

const manifest = {
  name: 'Sentinel Feed',
  short_name: 'Sentinel',
  description: 'Cybersecurity intelligence briefing, rebuilt every 12 hours.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait-primary',
  background_color: '#161616',
  theme_color: '#161616',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

await fs.writeFile(path.join(publicDir, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));
console.log('  manifest.webmanifest');
