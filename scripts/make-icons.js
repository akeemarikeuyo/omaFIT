// Generates the omaFIT app icons from the logo master, assets/logo.png (the gold-and-white figure with a spine).
// Plain Node, no dependencies: `node scripts/make-icons.js` (or `npm run icons`).
// To change the logo, replace assets/logo.png (transparent PNG, square, at least 1024 px is best) and run this again.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG = [0x0f, 0x11, 0x15];
const WHITE = [0xff, 0xff, 0xff];
const assets = path.join(__dirname, '..', 'assets');

// ---------- PNG read/write (8-bit RGBA only) ----------

function readPng(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file} is not a PNG`);
  const w = b.readUInt32BE(16);
  const h = b.readUInt32BE(20);
  if (b[24] !== 8 || b[25] !== 6) throw new Error(`${file} must be an 8-bit RGBA PNG`);
  const idat = [];
  for (let i = 8; i < b.length; ) {
    const len = b.readUInt32BE(i);
    if (b.toString('ascii', i + 4, i + 8) === 'IDAT') idat.push(b.subarray(i + 8, i + 8 + len));
    i += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const row = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? px[y * stride + x - 4] : 0;
      const up = y ? px[(y - 1) * stride + x] : 0;
      const upLeft = x >= 4 && y ? px[(y - 1) * stride + x - 4] : 0;
      let v = raw[row + x];
      if (filter === 1) v += left;
      else if (filter === 2) v += up;
      else if (filter === 3) v += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        v += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      px[y * stride + x] = v & 255;
    }
  }
  return { w, h, px };
}

/** opaque = write RGB with no alpha channel (required for the iOS app icon). */
function png(size, rgba, opaque = false) {
  const bpp = opaque ? 3 : 4;
  const raw = Buffer.alloc(size * (size * bpp + 1));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = y * (size * bpp + 1) + 1 + x * bpp;
      for (let c = 0; c < bpp; c++) raw[dst + c] = rgba[src + c];
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = opaque ? 2 : 6; // RGB or RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- drawing ----------

const logo = readPng(path.join(assets, 'logo.png'));

/**
 * The logo scaled into a size x size canvas, centred, spanning `fill` of the width (0..1).
 * Each output pixel averages the exact area of the logo it covers, so small icons stay smooth.
 * bg: paint onto this colour (opaque). tint: replace the colour with this one (for the monochrome icon).
 */
function render(size, { fill, bg, tint }) {
  const out = Buffer.alloc(size * size * 4);
  const scale = logo.w / (size * fill); // logo pixels per output pixel
  const offset = (size - size * fill) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx0 = (x - offset) * scale;
      const sy0 = (y - offset) * scale;
      const sx1 = sx0 + scale;
      const sy1 = sy0 + scale;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = Math.max(0, Math.floor(sy0)); sy < Math.min(logo.h, Math.ceil(sy1)); sy++) {
        const wy = Math.min(sy + 1, sy1) - Math.max(sy, sy0);
        for (let sx = Math.max(0, Math.floor(sx0)); sx < Math.min(logo.w, Math.ceil(sx1)); sx++) {
          const wgt = wy * (Math.min(sx + 1, sx1) - Math.max(sx, sx0));
          const i = (sy * logo.w + sx) * 4;
          const al = (logo.px[i + 3] / 255) * wgt;
          r += logo.px[i] * al;
          g += logo.px[i + 1] * al;
          b += logo.px[i + 2] * al;
          a += al;
        }
      }
      const area = scale * scale;
      const alpha = Math.min(1, a / area);
      const color = tint ?? (a ? [r / a, g / a, b / a] : [0, 0, 0]);
      const o = (y * size + x) * 4;
      if (bg) {
        for (let c = 0; c < 3; c++) out[o + c] = Math.round(color[c] * alpha + bg[c] * (1 - alpha));
        out[o + 3] = 255;
      } else {
        for (let c = 0; c < 3; c++) out[o + c] = Math.round(color[c]);
        out[o + 3] = Math.round(alpha * 255);
      }
    }
  }
  return out;
}

function solid(size, color) {
  const px = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) px.set([...color, 255], i * 4);
  return px;
}

const write = (name, size, rgba, opaque) => {
  fs.writeFileSync(path.join(assets, name), png(size, rgba, opaque));
  console.warn(`wrote assets/${name} (${size}x${size})`);
};

write('icon.png', 1024, render(1024, { fill: 0.8, bg: BG }), true);
// Android adaptive icons: the launcher crops to a circle or squircle, so keep the whole logo inside the centre safe circle (66 of 108 dp)
write('android-icon-foreground.png', 512, render(512, { fill: 0.5 }));
write('android-icon-background.png', 512, solid(512, BG));
// Themed (Material You) icon: one colour, the launcher recolours it
write('android-icon-monochrome.png', 432, render(432, { fill: 0.5, tint: WHITE }));
write('splash-icon.png', 1024, render(1024, { fill: 0.86 }));
write('favicon.png', 48, render(48, { fill: 0.92, bg: BG }));
// Used inside the app by the Brand mark and the launch screen
write('logo-mark.png', 384, render(384, { fill: 1 }));
