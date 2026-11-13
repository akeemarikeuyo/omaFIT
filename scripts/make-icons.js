// Generates the omaFIT app icons (gold dumbbell) into ./assets.
// Plain Node, no dependencies: `node scripts/make-icons.js`
// The dumbbell shape matches src/components/Brand.tsx — change both together.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG = [0x0f, 0x11, 0x15];
const GOLD = [0xf5, 0xb8, 0x2e];
const WHITE = [0xff, 0xff, 0xff];

// Dumbbell in a 0..1 box, centred. [x0, y0, x1, y1, cornerRadius]
const SHAPES = [
  [0.3, 0.465, 0.7, 0.535, 0.02], // bar
  [0.22, 0.28, 0.31, 0.72, 0.03], // inner plates
  [0.69, 0.28, 0.78, 0.72, 0.03],
  [0.13, 0.35, 0.21, 0.65, 0.03], // outer plates
  [0.79, 0.35, 0.87, 0.65, 0.03],
  [0.08, 0.44, 0.13, 0.56, 0.015], // collars
  [0.87, 0.44, 0.92, 0.56, 0.015],
];

function inRoundRect(x, y, [x0, y0, x1, y1, r]) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** scale = how much of the canvas width the dumbbell spans (0..1). */
function render(size, { scale, fg, bg }) {
  const SS = 4; // 4x4 supersampling for smooth edges
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = ((x + (sx + 0.5) / SS) / size - 0.5) / scale + 0.5;
          const v = ((y + (sy + 0.5) / SS) / size - 0.5) / scale + 0.5;
          if (SHAPES.some(s => inRoundRect(u, v, s))) hits++;
        }
      }
      const a = hits / (SS * SS);
      const i = (y * size + x) * 4;
      if (bg) {
        for (let c = 0; c < 3; c++) px[i + c] = Math.round(fg[c] * a + bg[c] * (1 - a));
        px[i + 3] = 255;
      } else {
        for (let c = 0; c < 3; c++) px[i + c] = fg[c];
        px[i + 3] = Math.round(a * 255);
      }
    }
  }
  return px;
}

function solid(size, color) {
  const px = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) px.set([...color, 255], i * 4);
  return px;
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

const out = path.join(__dirname, '..', 'assets');
const write = (name, size, rgba, opaque) => {
  fs.writeFileSync(path.join(out, name), png(size, rgba, opaque));
  console.warn(`wrote assets/${name} (${size}x${size})`);
};

write('icon.png', 1024, render(1024, { scale: 0.78, fg: GOLD, bg: BG }), true);
// Android adaptive icons: keep the mark inside the centre safe zone (~66%)
write('android-icon-foreground.png', 512, render(512, { scale: 0.58, fg: GOLD }));
write('android-icon-background.png', 512, solid(512, BG));
write('android-icon-monochrome.png', 432, render(432, { scale: 0.58, fg: WHITE }));
write('splash-icon.png', 1024, render(1024, { scale: 0.6, fg: GOLD }));
write('favicon.png', 48, render(48, { scale: 0.9, fg: GOLD, bg: BG }));
