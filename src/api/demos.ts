import { getGifPicks } from '../storage/store';
import INDEX from '../data/exerciseIndex.json';

// Free exercise demos from free-exercise-db (https://github.com/yuhonas/free-exercise-db),
// released into the public domain (Unlicense). No account or API key needed.
// Each exercise has a start and an end photo; ExerciseDemo flips between them like a GIF.
// The name index is bundled in the app; only the photos load from GitHub.

const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

export interface DemoExercise {
  id: string;
  name: string;
  equipment: string;
  /** strength, stretching, plyometrics, powerlifting, olympic weightlifting, strongman, cardio */
  category: string;
  /** push, pull, static, or '' */
  force: string;
  /** beginner, intermediate, expert */
  level: string;
  /** Primary muscles, e.g. ["middle back"] */
  muscles: string[];
  images: string[];
}

/** Every exercise in the bundled library. Each one has demo photos. */
export const ALL = INDEX as DemoExercise[];
const BY_ID = new Map(ALL.map(e => [e.id, e]));

// "Folder/0.jpg" only: no "..", slashes or query strings that could point outside the free-exercise-db repo
const SAFE_IMAGE_PATH = /^[A-Za-z0-9_-]+\/\d+\.jpg$/;

export const imageUrls = (ex: DemoExercise) => ex.images.filter(p => SAFE_IMAGE_PATH.test(p)).map(p => IMAGE_BASE + p);

export function findDemo(id: string | undefined): DemoExercise | null {
  return id ? BY_ID.get(id) ?? null : null;
}

/** Simple word search over the bundled index, best matches first. */
export function searchDemos(query: string, limit = 15): DemoExercise[] {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!words.length) return [];
  return ALL.map(e => {
    const name = e.name.toLowerCase();
    const score = words.reduce((n, w) => n + (name.includes(w) ? 1 : 0), 0);
    return { e, score };
  })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.e.name.length - b.e.name.length)
    .slice(0, limit)
    .map(x => x.e);
}

/** Your saved pick, else the plan's demo, else the best search match (used for swapped exercises). */
export async function resolveDemo(
  slotKey: string,
  demoId: string | undefined,
  searchTerms: string[] = [],
): Promise<DemoExercise | null> {
  const picks = await getGifPicks();
  const picked = findDemo(picks[slotKey]);
  if (picked) return picked;
  const planned = findDemo(demoId);
  if (planned) return planned;
  for (const term of searchTerms) {
    const hit = searchDemos(term, 1)[0];
    if (hit) return hit;
  }
  return null;
}
