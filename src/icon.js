/**
 * The app icon, drawn and encoded here rather than checked in as a binary.
 *
 * iOS home-screen icons must be PNG, so an SVG will not do. Rather than add a
 * rasteriser dependency for one small mark, this draws the shield into a pixel
 * buffer with 4x supersampling and writes a PNG by hand: node:zlib supplies the
 * only hard part, and PNG's chunk format is a CRC and a length away from
 * trivial.
 */
import zlib from 'node:zlib';

/* ---- PNG ---------------------------------------------------------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Encode RGBA pixels (Uint8Array, width*height*4) as a PNG buffer. */
function encodePng(pixels, width, height) {
  // Each scanline is prefixed with a filter byte; filter 0 is "none".
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(pixels.buffer, y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---- Drawing ------------------------------------------------------------ */

const hex = (value) => {
  const n = parseInt(value.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Is (x, y) inside the polygon? Even-odd rule. */
function inPolygon(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance from (x, y) to the segment a-b, for drawing thick strokes. */
function distanceToSegment(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy || 1;
  let t = ((x - ax) * dx + (y - ay) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const px = ax + t * dx;
  const py = ay + t * dy;
  return Math.hypot(x - px, y - py);
}

/**
 * Render the mark at `size` pixels square.
 *
 * `padded` insets the artwork, which is what a maskable icon needs: the
 * platform may crop to a circle and would otherwise clip the shield.
 */
export function renderIcon(size, { padded = false } = {}) {
  const SS = 4; // supersample factor
  const dim = size * SS;
  const pixels = new Uint8Array(size * size * 4);

  const bg = hex('#070b11');
  const accent = hex('#35e0f0');
  const ok = hex('#5ef08f');

  // Geometry in a 0..1 space, then scaled.
  const inset = padded ? 0.26 : 0.16;
  const s = (v) => v * dim;
  const shield = [
    [0.5, inset],
    [0.5 + (0.5 - inset) * 0.72, inset + 0.1],
    [0.5 + (0.5 - inset) * 0.72, 0.52],
    [0.5, 1 - inset],
    [0.5 - (0.5 - inset) * 0.72, 0.52],
    [0.5 - (0.5 - inset) * 0.72, inset + 0.1],
  ].map(([x, y]) => [s(x), s(y)]);

  // A second, smaller shield makes the first an outline rather than a slab.
  const centre = [s(0.5), s((inset + (1 - inset)) / 2)];
  const strokeWidth = dim * 0.045;
  const inner = shield.map(([x, y]) => {
    const dx = x - centre[0];
    const dy = y - centre[1];
    const len = Math.hypot(dx, dy) || 1;
    const shrink = (strokeWidth * 1.6) / len;
    return [x - dx * shrink, y - dy * shrink];
  });

  const check = [
    [s(0.36), s(0.5)],
    [s(0.46), s(0.6)],
    [s(0.66), s(0.39)],
  ];
  const checkWidth = dim * 0.062;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;

      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const px = x * SS + sx + 0.5;
          const py = y * SS + sy + 0.5;

          let colour = bg;
          if (inPolygon(shield, px, py) && !inPolygon(inner, px, py)) colour = accent;

          const onCheck =
            distanceToSegment(px, py, check[0], check[1]) < checkWidth / 2 ||
            distanceToSegment(px, py, check[1], check[2]) < checkWidth / 2;
          if (onCheck) colour = ok;

          r += colour[0];
          g += colour[1];
          b += colour[2];
        }
      }

      const samples = SS * SS;
      const offset = (y * size + x) * 4;
      pixels[offset] = Math.round(r / samples);
      pixels[offset + 1] = Math.round(g / samples);
      pixels[offset + 2] = Math.round(b / samples);
      pixels[offset + 3] = 255;
    }
  }

  return encodePng(pixels, size, size);
}
