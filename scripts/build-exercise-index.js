// Rebuilds src/data/exerciseIndex.json from free-exercise-db (public domain).
//   1. Download https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json
//   2. node scripts/build-exercise-index.js <path-to-exercises.json>
// Only plain fields are copied, and every value is type-checked, so the dataset is treated as data only.
const fs = require('fs');
const path = require('path');

const src = process.argv[2];
if (!src) {
  console.error('Usage: node scripts/build-exercise-index.js <path-to-exercises.json>');
  process.exit(1);
}

const str = v => (typeof v === 'string' ? v.trim().slice(0, 120) : '');
const strList = (v, max = 40) =>
  Array.isArray(v) ? v.filter(x => typeof x === 'string').map(x => x.trim().slice(0, max)) : [];
const ID = /^[A-Za-z0-9_\-]+$/;
const IMG = /^[A-Za-z0-9_\-]+\/\d+\.jpg$/;

const raw = JSON.parse(fs.readFileSync(src, 'utf8'));
if (!Array.isArray(raw)) throw new Error('Expected an array of exercises');

const out = [];
for (const e of raw) {
  const id = str(e.id);
  const images = strList(e.images, 200).filter(p => IMG.test(p));
  if (!ID.test(id) || !str(e.name) || images.length === 0) continue;
  out.push({
    id,
    name: str(e.name),
    // The dataset uses null for no equipment
    equipment: str(e.equipment) || 'body only',
    category: str(e.category),
    force: str(e.force),
    level: str(e.level),
    muscles: strList(e.primaryMuscles),
    images,
  });
}
out.sort((a, b) => a.name.localeCompare(b.name));

const dest = path.join(__dirname, '..', 'src', 'data', 'exerciseIndex.json');
fs.writeFileSync(dest, JSON.stringify(out));
console.warn(`wrote ${out.length} exercises to src/data/exerciseIndex.json`);
