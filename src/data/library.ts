// Rules for which library exercises the AI may pick. The AI can only choose exercises from the
// bundled free-exercise-db index (so every pick has a demo), and only ones that pass these checks.
import { ALL, DemoExercise, findDemo } from '../api/demos';
import type { Settings } from '../storage/store';
import type { SessionId } from './plan';

export const EQUIPMENT_OPTIONS: { key: string; label: string }[] = [
  { key: 'dumbbell', label: 'Dumbbells' },
  { key: 'barbell', label: 'Barbell' },
  { key: 'kettlebells', label: 'Kettlebells' },
  { key: 'bands', label: 'Resistance bands' },
  { key: 'cable', label: 'Cable machine' },
  { key: 'machine', label: 'Gym machines' },
  { key: 'e-z curl bar', label: 'EZ curl bar' },
  { key: 'medicine ball', label: 'Medicine ball' },
  { key: 'exercise ball', label: 'Exercise ball' },
  { key: 'foam roll', label: 'Foam roller' },
  { key: 'other', label: 'Other (ab wheel, bench…)' },
];

/** Matches the default plan's home kit. Bodyweight is always available. */
export const DEFAULT_EQUIPMENT = ['dumbbell', 'barbell', 'bands', 'other'];

export const userEquipment = (s: Settings) => s.equipment ?? DEFAULT_EQUIPMENT;

/**
 * Can this library exercise be done with the user's equipment? Returns a note when it is done with
 * a substitute (e.g. a band instead of a cable), or null when it can't be done.
 */
export function equipmentFit(libEquipment: string, have: string[]): { note?: string } | null {
  if (libEquipment === 'body only' || have.includes(libEquipment)) return {};
  if (libEquipment === 'cable' && have.includes('bands')) return { note: 'Use a band anchored at the same height instead of the cable.' };
  if (libEquipment === 'kettlebells' && have.includes('dumbbell')) return { note: 'Use a dumbbell instead of the kettlebell.' };
  if (libEquipment === 'e-z curl bar' && have.includes('barbell')) return { note: 'Use the barbell instead of the EZ bar.' };
  return null;
}

const STRENGTH_CATEGORIES = ['strength'];
const POSTURE_CATEGORIES = ['stretching', 'strength'];
const POSTURE_EQUIPMENT = ['body only', 'bands', 'foam roll', 'exercise ball'];
// Loaded spinal moves the coaching rules rule out
const BANNED_BARBELL = /squat|deadlift|good ?morning|clean|snatch|jerk|rack pull/i;

/** Why an exercise can't go into this session, or null if it can. */
export function rejectReason(ex: DemoExercise, session: SessionId, have: string[]): string | null {
  if (!equipmentFit(ex.equipment, have)) return `Needs ${ex.equipment}, which isn't in your equipment.`;
  if (ex.level === 'expert') return 'Expert-level exercise.';
  if (ex.equipment === 'barbell' && BANNED_BARBELL.test(ex.name)) return 'Heavy barbell squats and deadlifts are not used in omaFIT.';
  if (session === 'posture') {
    if (!POSTURE_CATEGORIES.includes(ex.category)) return 'Not a posture or mobility exercise.';
    if (ex.level !== 'beginner') return 'The posture routine only uses beginner-level moves.';
    if (!POSTURE_EQUIPMENT.includes(ex.equipment)) return 'The posture routine uses bodyweight, bands or a foam roller only.';
  } else if (!STRENGTH_CATEGORIES.includes(ex.category)) {
    return `Category "${ex.category}" is not used on strength days.`;
  }
  return null;
}

/** Library exercises the AI may choose from, for the given equipment. */
export function candidates(have: string[]): { posture: DemoExercise[]; strength: DemoExercise[] } {
  return {
    posture: ALL.filter(e => !rejectReason(e, 'posture', have)),
    strength: ALL.filter(e => !rejectReason(e, 'A', have)),
  };
}

/** Compact one-line-per-exercise list for the AI prompt. */
export function libraryAsText(list: DemoExercise[]): string {
  return list.map(e => `${e.id} | ${e.name} | ${e.equipment} | ${e.force || '-'} | ${e.level} | ${e.muscles.join(', ')}`).join('\n');
}

/** Plan id for a library exercise the AI added to a session. Stable, so logs keep matching. */
export const addedExerciseId = (session: SessionId, demoId: string) => `lib-${session}-${demoId}`;

/** Library exercise behind an added id, if it is one. */
export function demoForAddedId(id: string) {
  const m = id.match(/^lib-(posture|A|B)-(.+)$/);
  return m ? findDemo(m[2]) : null;
}

const UPPER_PUSH = ['chest', 'shoulders', 'triceps'];
const UPPER_PULL = ['lats', 'middle back', 'traps', 'shoulders', 'biceps'];

/** Upper-body push and pull sets, from the library's force and muscle data. */
export function upperBodyBalance(items: { demoId?: string; sets: number }[]): { push: number; pull: number } {
  let push = 0;
  let pull = 0;
  for (const it of items) {
    const ex = findDemo(it.demoId);
    if (!ex) continue;
    if (ex.force === 'push' && ex.muscles.some(m => UPPER_PUSH.includes(m))) push += it.sets;
    if (ex.force === 'pull' && ex.muscles.some(m => UPPER_PULL.includes(m))) pull += it.sets;
  }
  return { push, pull };
}

/** Equipment the library entry needs, written for the plan (with a substitute note if any). */
export function equipmentLabel(ex: DemoExercise, have: string[]): string {
  const note = equipmentFit(ex.equipment, have)?.note;
  const base = ex.equipment === 'body only' ? 'Bodyweight' : ex.equipment[0].toUpperCase() + ex.equipment.slice(1);
  return note ? `${base}. ${note}` : base;
}

/** Whether to log a weight for this exercise. */
export const isLoaded = (ex: DemoExercise) =>
  ['dumbbell', 'barbell', 'kettlebells', 'e-z curl bar', 'cable', 'machine', 'medicine ball'].includes(ex.equipment);
