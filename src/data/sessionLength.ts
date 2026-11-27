// Full or Short sessions, and how long a session takes. Short is always a cut-down copy of the user's own approved
// plan (key exercises only, fewer sets), so it never adds anything the validators haven't seen.
import type { Exercise } from './plan';

export type SessionLength = 'full' | 'short';

/** The key exercises (`shortSets`), with their short set count. Exercises added by the AI aren't key. */
export function shortVersion<T extends Exercise>(exercises: T[]): T[] {
  return exercises
    .filter(ex => ex.shortSets != null)
    .map(ex => ({ ...ex, sets: Math.min(ex.shortSets ?? ex.sets, ex.sets) }));
}

/** A short version is offered only when it leaves out something. */
export function hasShortVersion(exercises: Exercise[]): boolean {
  const short = shortVersion(exercises);
  if (short.length === 0) return false;
  const sets = (list: Exercise[]) => list.reduce((n, ex) => n + ex.sets, 0);
  return sets(short) < sets(exercises);
}

/** Rough seconds of work in one set: 3 s a rep, a timed hold at its longest, plus getting set up. Both sides if per side. */
function setSeconds(ex: Pick<Exercise, 'reps' | 'perSide'>): number {
  const numbers = (ex.reps.match(/\d+/g) ?? []).map(Number);
  const top = numbers.length ? Math.max(...numbers) : 10;
  const timed = /s\b|sec/i.test(ex.reps);
  const work = timed ? top : top * 3;
  return (ex.perSide ? work * 2 : work) + 15;
}

const CHANGEOVER_SECONDS = 20;

/** Rough length in seconds: every set's work, rest between sets, a short changeover between exercises. */
export function estimateSeconds(items: { ex: Pick<Exercise, 'reps' | 'perSide'>; sets: number }[], restSeconds: number): number {
  const active = items.filter(i => i.sets > 0);
  const sets = active.reduce((n, i) => n + i.sets, 0);
  if (sets === 0) return 0;
  const work = active.reduce((n, i) => n + i.sets * setSeconds(i.ex), 0);
  return work + (sets - 1) * restSeconds + (active.length - 1) * CHANGEOVER_SECONDS;
}

/** Minutes for a whole session, rounded so it doesn't promise false precision. */
export function sessionMinutes(exercises: Exercise[], restSeconds: number): number {
  const minutes = estimateSeconds(exercises.map(ex => ({ ex, sets: ex.sets })), restSeconds) / 60;
  return minutes < 15 ? Math.max(1, Math.round(minutes)) : Math.round(minutes / 5) * 5;
}
