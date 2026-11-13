import { AddedExercise, getAdditions, getOverrides, Overrides } from '../storage/store';
import { demoForAddedId } from './library';
import { Exercise, Session, SessionId, SESSIONS } from './plan';

export interface EffectiveExercise extends Exercise {
  targetWeightKg?: number;
  coachNote?: string;
  swapped: boolean;
  /** Added from the library by an approved AI plan */
  added?: boolean;
}

/** Baseline session + approved changes: overrides, removals and AI-added library exercises. */
export function applyOverrides(session: Session, overrides: Overrides, additions: AddedExercise[] = []): EffectiveExercise[] {
  const base = session.exercises
    .filter(ex => !overrides[ex.id]?.removed)
    .map((ex): EffectiveExercise => {
      const o = overrides[ex.id];
      if (!o) return { ...ex, swapped: false };
      return {
        ...ex,
        ...(o.swapTo
          ? {
              name: o.swapTo.name,
              equipment: o.swapTo.equipment,
              cues: o.swapTo.cues,
              demoId: o.swapTo.demoId,
              videoUrl: undefined,
              demoSearch: o.swapTo.demoSearch,
              loaded: o.swapTo.loaded ?? ex.loaded,
            }
          : {}),
        sets: o.sets ?? ex.sets,
        reps: o.reps ?? ex.reps,
        targetWeightKg: o.targetWeightKg,
        coachNote: o.note,
        swapped: !!o.swapTo,
      };
    });

  const extra = additions
    .filter(a => a.session === session.id && !overrides[a.id]?.removed)
    .map((a): EffectiveExercise => {
      const o = overrides[a.id];
      const w = o?.swapTo;
      return {
        id: a.id,
        name: w?.name ?? a.name,
        sets: o?.sets ?? a.sets,
        reps: o?.reps ?? a.reps,
        perSide: a.perSide,
        loaded: w?.loaded ?? a.loaded,
        equipment: w?.equipment ?? a.equipment,
        cues: w?.cues ?? a.cues,
        demoId: w ? w.demoId : a.demoId,
        demoSearch: w?.demoSearch,
        targetWeightKg: o?.targetWeightKg,
        coachNote: o?.note,
        swapped: !!w,
        added: true,
      };
    });

  return [...base, ...extra];
}

export async function effectiveSession(id: SessionId) {
  const session = SESSIONS[id];
  const [overrides, additions] = await Promise.all([getOverrides(), getAdditions()]);
  return { session, exercises: applyOverrides(session, overrides, additions) };
}

/** The whole current plan, per session. */
export async function effectivePlan(): Promise<Record<SessionId, EffectiveExercise[]>> {
  const [overrides, additions] = await Promise.all([getOverrides(), getAdditions()]);
  const ids = Object.keys(SESSIONS) as SessionId[];
  return Object.fromEntries(ids.map(id => [id, applyOverrides(SESSIONS[id], overrides, additions)])) as Record<
    SessionId,
    EffectiveExercise[]
  >;
}

/** Display name for any plan exercise id, including AI-added ones. */
export function exerciseLabel(id: string): string {
  for (const s of Object.values(SESSIONS)) {
    const e = s.exercises.find(x => x.id === id);
    if (e) return e.name;
  }
  return demoForAddedId(id)?.name ?? id;
}

/** Compact text description of the current plan for the AI's context. */
export async function planAsText(): Promise<string> {
  const plan = await effectivePlan();
  return (Object.keys(SESSIONS) as SessionId[])
    .map(id => {
      const lines = plan[id].map(
        e =>
          `- [${e.id}] ${e.name}: ${e.sets} x ${e.reps}${e.perSide ? ' per side' : ''}` +
          `${e.targetWeightKg ? ` @ ${e.targetWeightKg} kg` : ''} (${e.equipment})` +
          `${e.demoId ? ` {library: ${e.demoId}}` : ''}`,
      );
      return `${SESSIONS[id].title} (${id}):\n${lines.join('\n')}`;
    })
    .join('\n\n');
}
