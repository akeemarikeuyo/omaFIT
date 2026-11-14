// Pain and discomfort by body area. Logs store a list of { area, side, score }; nothing logged means no pain.
import type { AnyLog, PainArea, PainEntry, PainSide } from '../storage/store';
import { JOINT_RED_FLAGS, RED_FLAGS } from './plan';

export interface PainAreaInfo {
  id: PainArea;
  label: string;
  /** Joints have a left/right side */
  sided: boolean;
  /** Spine areas use the back red flags; the rest use the joint red flags */
  spine: boolean;
  /** For the AI: the kinds of exercise that load this area */
  loads: string;
}

export const PAIN_AREAS: PainAreaInfo[] = [
  { id: 'neck', label: 'Neck', sided: false, spine: true, loads: 'shrugs, overhead pressing, neck-loaded positions' },
  { id: 'upper-back', label: 'Upper back', sided: false, spine: true, loads: 'rows, shrugs, overhead pressing' },
  { id: 'lower-back', label: 'Lower back', sided: false, spine: true, loads: 'hinges, squats, the ab wheel, loaded carries' },
  { id: 'shoulder', label: 'Shoulder', sided: true, spine: false, loads: 'presses, push-ups, dips, overhead work, heavy rows' },
  { id: 'elbow', label: 'Elbow', sided: true, spine: false, loads: 'curls, triceps work, presses, push-ups' },
  { id: 'wrist', label: 'Wrist / hand', sided: true, spine: false, loads: 'push-ups, planks, presses, heavy grip work' },
  { id: 'hip', label: 'Hip', sided: true, spine: false, loads: 'squats, lunges, hinges, hip thrusts' },
  { id: 'knee', label: 'Knee', sided: true, spine: false, loads: 'squats, lunges, split squats, step-ups, leg extensions, running' },
  { id: 'ankle', label: 'Ankle / foot', sided: true, spine: false, loads: 'lunges, calf raises, jumping, running and long walks' },
  { id: 'other', label: 'Other', sided: false, spine: false, loads: 'exercises that load the area described' },
];

export const SIDES: { id: PainSide; label: string }[] = [
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'both', label: 'Both' },
];

export const MAX_PAIN_NOTE = 40;

export const areaInfo = (a: PainArea) => PAIN_AREAS.find(p => p.id === a) ?? PAIN_AREAS[PAIN_AREAS.length - 1];

/** "Left knee", "Both shoulders", "Lower back", or the note for "other". */
export function painLabel(p: Pick<PainEntry, 'area' | 'side' | 'note'>): string {
  const info = areaInfo(p.area);
  if (p.area === 'other') return p.note?.trim() || 'Other';
  if (!info.sided || !p.side) return info.label;
  if (p.side === 'both') return `Both ${BOTH[p.area] ?? info.label.toLowerCase()}`;
  return `${p.side === 'left' ? 'Left' : 'Right'} ${info.label.toLowerCase()}`;
}

const BOTH: Partial<Record<PainArea, string>> = {
  shoulder: 'shoulders',
  elbow: 'elbows',
  wrist: 'wrists / hands',
  hip: 'hips',
  knee: 'knees',
  ankle: 'ankles / feet',
};

/** Same place = same area, side and (for "other") note. */
export const samePlace = (a: PainEntry, b: Pick<PainEntry, 'area' | 'side' | 'note'>) =>
  a.area === b.area && (a.side ?? null) === (b.side ?? null) && (a.note ?? '').trim().toLowerCase() === (b.note ?? '').trim().toLowerCase();

/** Only real entries: a score above 0 and a known area. */
export const cleanPains = (list: PainEntry[]): PainEntry[] =>
  list
    .filter(p => p.score > 0 && PAIN_AREAS.some(a => a.id === p.area))
    .map(p => ({ ...p, score: Math.min(10, Math.round(p.score)), note: p.note?.trim().slice(0, MAX_PAIN_NOTE) || undefined }));

/** Pain logged on any entry. Older logs only had a back pain score, which counts as lower back. */
export function painsOf(l: AnyLog): PainEntry[] {
  if (l.pains) return cleanPains(l.pains);
  return l.backPain > 0 ? [{ area: 'lower-back', score: l.backPain }] : [];
}

/** Highest score, 0 if none. */
export const maxPain = (list: PainEntry[]) => list.reduce((m, p) => Math.max(m, p.score), 0);

/** The lower back score stored in `backPain`, so older readers of logs still see it. */
export const lowerBackScore = (list: PainEntry[]) => maxPain(list.filter(p => p.area === 'lower-back'));

/** "Left knee 4 · Lower back 2", or "no pain". Worst first. */
export function painSummary(list: PainEntry[]): string {
  if (!list.length) return 'no pain';
  return [...list]
    .sort((a, b) => b.score - a.score)
    .map(p => `${painLabel(p)} ${p.score}`)
    .join(' · ');
}

/** For the AI: "left knee 5/10, lower back 2/10", or "none". */
export function painForAI(list: PainEntry[]): string {
  if (!list.length) return 'none';
  return list.map(p => `${painLabel(p).toLowerCase()} ${p.score}/10`).join(', ');
}

/** The red flags that fit where it hurts: back flags for spine areas, joint flags for the rest. */
export function redFlagsFor(list: PainEntry[]): string {
  const spine = list.some(p => areaInfo(p.area).spine);
  const joint = list.some(p => !areaInfo(p.area).spine);
  return [spine ? RED_FLAGS : null, joint ? JOINT_RED_FLAGS : null].filter(Boolean).join(' ') || RED_FLAGS;
}

/** Areas and what loads them, for the AI's coaching rules. */
export const PAIN_LOADS_FOR_AI = PAIN_AREAS.filter(a => a.id !== 'other')
  .map(a => `${a.label.toLowerCase()}: ${a.loads}`)
  .join('; ');
