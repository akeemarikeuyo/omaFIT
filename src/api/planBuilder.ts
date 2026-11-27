// "Build my plan": the AI looks at optional posture photos, the user's profile, equipment and logs, and
// proposes changes to the posture routine and strength days. It may only pick exercises from the bundled
// library (so every pick has a demo). The app checks every suggestion, and nothing changes until Apply.
import { effectivePlan } from '../data/effective';
import { addedExerciseId, equipmentLabel, isLoaded, rejectReason, upperBodyBalance, userEquipment } from '../data/library';
import { SessionId, SESSIONS } from '../data/plan';
import {
  addAdditions,
  ExerciseOverride,
  getSettings,
  markProposalApplied,
  mergeOverrides,
  Overrides,
  PlanProposal,
  ProposedAdd,
  ProposedAdjust,
  ProposedRemove,
  ProposedSwap,
  removeAdditions,
  getPostureAssessment,
  savePostureAssessment,
  saveProposal,
} from '../storage/store';
import { AIPart, askAI } from './ai';
import { COACHING_RULES, contextBlock, librarySystemBlock } from './coach';
import { levelOf } from '../data/level';
import { findDemo } from './demos';

export type PhotoView = 'front' | 'left side' | 'right side';
export interface PosturePhoto {
  view: PhotoView;
  /** JPEG, already resized on the phone */
  base64: string;
}

const MAX_ADDS_PER_SESSION = 3;
const MAX_REMOVES_PER_SESSION = 2;
const MIN_SIZE: Record<SessionId, number> = { posture: 5, A: 4, B: 4 };
const MAX_SIZE: Record<SessionId, number> = { posture: 12, A: 10, B: 10 };

const PLAN_TOOL = {
  name: 'submit_plan_proposal',
  description: 'Submit posture findings and the proposed changes to the posture routine and strength days.',
  schema: {
    type: 'object',
    properties: {
      posture_findings: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Up to 6 short visual observations from the photos (e.g. "head sits forward of the shoulders in the side view"). Empty if no photos or nothing clear.',
      },
      photo_note: { type: 'string', description: 'Only if the photos were hard to read (angle, clothing, lighting). Otherwise omit.' },
      summary: { type: 'string', description: '2-4 plain sentences: what you focused on and why.' },
      safety_note: { type: 'string', description: 'Only if something needs a doctor/physio or extra care. Otherwise omit.' },
      add: {
        type: 'array',
        description: `New exercises. At most ${MAX_ADDS_PER_SESSION} per session.`,
        items: {
          type: 'object',
          properties: {
            session: { type: 'string', enum: ['posture', 'A', 'B'] },
            library_id: { type: 'string', description: 'Exact id from the exercise library list for that session type.' },
            sets: { type: 'integer', minimum: 1, maximum: 5 },
            reps: { type: 'string', description: 'e.g. "10", "8-12", "30 s"' },
            per_side: { type: 'boolean' },
            cues: { type: 'array', items: { type: 'string' }, description: '2-3 short form cues.' },
            reason: { type: 'string', description: 'Why, linked to the findings, goals or logs.' },
          },
          required: ['session', 'library_id', 'sets', 'reps', 'per_side', 'cues', 'reason'],
        },
      },
      swap: {
        type: 'array',
        description: 'Replace a plan exercise with a library exercise (e.g. it needs equipment the user lacks).',
        items: {
          type: 'object',
          properties: {
            exercise_id: { type: 'string', description: 'An id from the current plan, in brackets.' },
            library_id: { type: 'string' },
            cues: { type: 'array', items: { type: 'string' } },
            reason: { type: 'string' },
          },
          required: ['exercise_id', 'library_id', 'cues', 'reason'],
        },
      },
      remove: {
        type: 'array',
        description: `Drop plan exercises that don't fit. At most ${MAX_REMOVES_PER_SESSION} per session.`,
        items: {
          type: 'object',
          properties: { exercise_id: { type: 'string' }, reason: { type: 'string' } },
          required: ['exercise_id', 'reason'],
        },
      },
      adjust: {
        type: 'array',
        description: 'Change sets or reps of a plan exercise. Do not change weights here.',
        items: {
          type: 'object',
          properties: {
            exercise_id: { type: 'string' },
            sets: { type: 'integer', minimum: 1, maximum: 5 },
            reps: { type: 'string' },
            reason: { type: 'string' },
          },
          required: ['exercise_id', 'reason'],
        },
      },
    },
    required: ['posture_findings', 'summary', 'add', 'swap', 'remove', 'adjust'],
  },
};

interface RawProposal {
  posture_findings?: string[];
  photo_note?: string;
  summary?: string;
  safety_note?: string;
  add?: { session: string; library_id: string; sets: number; reps: string; per_side?: boolean; cues?: string[]; reason?: string }[];
  swap?: { exercise_id: string; library_id: string; cues?: string[]; reason?: string }[];
  remove?: { exercise_id: string; reason?: string }[];
  adjust?: { exercise_id: string; sets?: number; reps?: string; reason?: string }[];
}

const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.trim().slice(0, n) : '');
const clipList = (a: unknown, count: number, n: number) =>
  Array.isArray(a) ? a.map(x => clip(x, n)).filter(Boolean).slice(0, count) : [];
const validSets = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5;
const isSession = (s: string): s is SessionId => s === 'posture' || s === 'A' || s === 'B';

type SimItem = { id: string; demoId?: string; sets: number };

/** Applies the app's safety checks. Anything that fails goes to `rejected` with the reason. */
export async function validateProposal(raw: RawProposal) {
  const plan = await effectivePlan();
  const settings = await getSettings();
  const have = userEquipment(settings);
  const level = levelOf(settings);
  const rejected: { what: string; why: string }[] = [];

  // A working copy of the plan, so each accepted change is checked against the ones before it
  const sim: Record<SessionId, SimItem[]> = {
    posture: plan.posture.map(e => ({ id: e.id, demoId: e.demoId, sets: e.sets })),
    A: plan.A.map(e => ({ id: e.id, demoId: e.demoId, sets: e.sets })),
    B: plan.B.map(e => ({ id: e.id, demoId: e.demoId, sets: e.sets })),
  };
  const sessionOf = (id: string) => (Object.keys(sim) as SessionId[]).find(s => sim[s].some(e => e.id === id));
  const balanceScore = () => {
    const b = upperBodyBalance([...sim.posture, ...sim.A, ...sim.B]);
    return { ok: b.pull >= 2 * b.push, margin: b.pull - 2 * b.push };
  };
  /** Rejects a change that worsens the pull:push balance while it is below 2:1. */
  const keepsBalance = (apply: () => void, undo: () => void) => {
    const before = balanceScore();
    apply();
    const after = balanceScore();
    if (!after.ok && after.margin < before.margin) {
      undo();
      return false;
    }
    return true;
  };

  const remove: ProposedRemove[] = [];
  const removedPerSession: Record<SessionId, number> = { posture: 0, A: 0, B: 0 };
  for (const r of raw.remove ?? []) {
    const s = sessionOf(r.exercise_id);
    const what = `Remove ${r.exercise_id}`;
    if (!s) { rejected.push({ what, why: 'Not in your plan.' }); continue; }
    if (removedPerSession[s] >= MAX_REMOVES_PER_SESSION) { rejected.push({ what, why: 'Too many removals in one session.' }); continue; }
    if (sim[s].length - 1 < MIN_SIZE[s]) { rejected.push({ what, why: 'The session would get too short.' }); continue; }
    const idx = sim[s].findIndex(e => e.id === r.exercise_id);
    const item = sim[s][idx];
    if (!keepsBalance(() => sim[s].splice(idx, 1), () => sim[s].splice(idx, 0, item))) {
      rejected.push({ what, why: 'Would leave too little upper-body pulling (keep pulling at least 2x pushing).' });
      continue;
    }
    removedPerSession[s]++;
    remove.push({ exerciseId: r.exercise_id, reason: clip(r.reason, 300) });
  }

  const swap: ProposedSwap[] = [];
  for (const w of raw.swap ?? []) {
    const s = sessionOf(w.exercise_id);
    const lib = findDemo(w.library_id);
    const what = `Swap ${w.exercise_id} → ${lib?.name ?? w.library_id}`;
    if (!s) { rejected.push({ what, why: 'Not in your plan (or already removed).' }); continue; }
    if (!lib) { rejected.push({ what, why: 'Not in the exercise library.' }); continue; }
    const why = rejectReason(lib, s, have, level);
    if (why) { rejected.push({ what, why }); continue; }
    if (sim[s].some(e => e.demoId === lib.id)) { rejected.push({ what, why: 'Already in that session.' }); continue; }
    const item = sim[s].find(e => e.id === w.exercise_id)!;
    const prevDemo = item.demoId;
    if (!keepsBalance(() => (item.demoId = lib.id), () => (item.demoId = prevDemo))) {
      rejected.push({ what, why: 'Would push upper-body pushing above half of pulling.' });
      continue;
    }
    swap.push({ exerciseId: w.exercise_id, libraryId: lib.id, name: lib.name, cues: clipList(w.cues, 4, 120), reason: clip(w.reason, 300) });
  }

  const add: ProposedAdd[] = [];
  const addedPerSession: Record<SessionId, number> = { posture: 0, A: 0, B: 0 };
  for (const a of raw.add ?? []) {
    const lib = findDemo(a.library_id);
    const what = `Add ${lib?.name ?? a.library_id}`;
    if (!isSession(a.session)) { rejected.push({ what, why: 'Unknown session.' }); continue; }
    const s = a.session;
    if (!lib) { rejected.push({ what, why: 'Not in the exercise library.' }); continue; }
    const why = rejectReason(lib, s, have, level);
    if (why) { rejected.push({ what, why }); continue; }
    if (!validSets(a.sets) || !clip(a.reps, 20)) { rejected.push({ what, why: 'Sets must be 1-5, with a rep target.' }); continue; }
    if (sim[s].some(e => e.demoId === lib.id)) { rejected.push({ what, why: 'Already in that session.' }); continue; }
    if (addedPerSession[s] >= MAX_ADDS_PER_SESSION || sim[s].length >= MAX_SIZE[s]) {
      rejected.push({ what, why: 'That session is already full enough.' });
      continue;
    }
    const item = { id: addedExerciseId(s, lib.id), demoId: lib.id, sets: a.sets };
    if (!keepsBalance(() => sim[s].push(item), () => sim[s].pop())) {
      rejected.push({ what, why: 'Would push upper-body pushing above half of pulling.' });
      continue;
    }
    addedPerSession[s]++;
    add.push({
      session: s,
      libraryId: lib.id,
      name: lib.name,
      sets: a.sets,
      reps: clip(a.reps, 20),
      perSide: !!a.per_side,
      cues: clipList(a.cues, 4, 120),
      reason: clip(a.reason, 300),
    });
  }

  const adjust: ProposedAdjust[] = [];
  for (const j of raw.adjust ?? []) {
    const what = `Adjust ${j.exercise_id}`;
    if (!sessionOf(j.exercise_id)) { rejected.push({ what, why: 'Not in your plan.' }); continue; }
    if (j.sets != null && !validSets(j.sets)) { rejected.push({ what, why: 'Sets must be 1 to 5.' }); continue; }
    if (j.sets == null && !clip(j.reps, 20)) continue;
    adjust.push({ exerciseId: j.exercise_id, sets: j.sets, reps: clip(j.reps, 20) || undefined, reason: clip(j.reason, 300) });
  }

  return { add, swap, remove, adjust, rejected };
}

/** Sends photos (optional) + context to the AI and returns a checked, saved proposal. */
export async function buildPlan(photos: PosturePhoto[]): Promise<PlanProposal> {
  const settings = await getSettings();
  // The check before this one (contextBlock lists its findings), so the AI can say what changed
  const previousCheck = await getPostureAssessment();
  const imageParts = photos.flatMap((p): AIPart[] => [
    { type: 'text', text: `Photo: ${p.view} view` },
    { type: 'image', mediaType: 'image/jpeg', base64: p.base64 },
  ]);
  const task = [
    await contextBlock(14),
    photos.length
      ? 'The photos above are relaxed standing posture photos. Describe only what is clearly visible, as observations, never as a diagnosis.'
      : 'No posture photos were provided. Base the plan on the profile and logs; leave posture_findings empty.',
    photos.length && previousCheck
      ? 'An earlier posture check is listed above. In photo_note, say briefly what looks different from it (better, ' +
        'the same or worse), as observations only. Photos differ in light and angle, so be cautious.'
      : null,
    'Build the best plan for this person: tailor the daily posture routine to their posture findings and sitting habits, ' +
      'and the strength days to their goals and equipment. Swap or remove plan exercises that need equipment they do not have. ' +
      'Keep the plan short enough to finish (posture routine about 10-15 minutes). Prefer few, high-value changes. ' +
      'Every new or swapped exercise must be an exact id from the exercise library list for that session type. ' +
      'Then call submit_plan_proposal once with your answer.',
  ]
    .filter(Boolean)
    .join('\n\n');

  const { toolInput } = await askAI({
    maxTokens: 16000,
    effort: 'high',
    system: [
      { text: `You are a careful posture and strength coach for people who sit for long hours.\n\n${COACHING_RULES}` },
      librarySystemBlock(settings),
    ],
    tool: PLAN_TOOL,
    messages: [{ role: 'user', content: [...imageParts, { type: 'text', text: task }] }],
  });

  // Output from any provider is untrusted: every field is type-checked and clipped below
  const raw = (toolInput ?? {}) as RawProposal;
  const checked = await validateProposal(raw);
  const findings = clipList(raw.posture_findings, 6, 200);
  const photoNote = clip(raw.photo_note, 200);
  if (photos.length && findings.length) {
    await savePostureAssessment({ date: new Date().toISOString(), findings });
  }
  return saveProposal({
    date: new Date().toISOString(),
    summary: [clip(raw.summary, 800), photoNote].filter(Boolean).join(' '),
    findings,
    safetyNote: clip(raw.safety_note, 400) || undefined,
    ...checked,
    applied: false,
  });
}

/** Applies an approved proposal on top of the baseline plan. "Reset plan" undoes it. */
export async function applyProposal(p: PlanProposal) {
  const have = userEquipment(await getSettings());
  const overrides: Overrides = {};
  const dropAdded: string[] = [];

  for (const r of p.remove) {
    if (r.exerciseId.startsWith('lib-')) dropAdded.push(r.exerciseId);
    else overrides[r.exerciseId] = { removed: true };
  }
  for (const w of p.swap) {
    const lib = findDemo(w.libraryId);
    if (!lib) continue;
    const change: ExerciseOverride = {
      swapTo: {
        name: lib.name,
        equipment: equipmentLabel(lib, have),
        cues: w.cues,
        demoSearch: [],
        demoId: lib.id,
        loaded: isLoaded(lib),
      },
    };
    overrides[w.exerciseId] = { ...overrides[w.exerciseId], ...change };
  }
  for (const j of p.adjust) {
    overrides[j.exerciseId] = {
      ...overrides[j.exerciseId],
      ...(j.sets != null ? { sets: j.sets } : {}),
      ...(j.reps ? { reps: j.reps } : {}),
    };
  }

  await addAdditions(
    p.add.flatMap(a => {
      const lib = findDemo(a.libraryId);
      if (!lib) return [];
      return [
        {
          id: addedExerciseId(a.session, lib.id),
          session: a.session,
          demoId: lib.id,
          name: lib.name,
          sets: a.sets,
          reps: a.reps,
          perSide: a.perSide,
          loaded: isLoaded(lib),
          equipment: equipmentLabel(lib, have),
          cues: a.cues.length ? a.cues : ['Follow the demo photos', 'Move slowly and with control'],
        },
      ];
    }),
  );
  if (dropAdded.length) await removeAdditions(dropAdded);
  await mergeOverrides(overrides);
  await markProposalApplied(p.id);
}

export const sessionTitle = (s: SessionId) => SESSIONS[s].title;
