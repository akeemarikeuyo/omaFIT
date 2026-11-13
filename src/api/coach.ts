import { effectivePlan, exerciseLabel, planAsText } from '../data/effective';
import { candidates, EQUIPMENT_OPTIONS, equipmentLabel, isLoaded, libraryAsText, rejectReason, userEquipment } from '../data/library';
import { PAIN_LOADS_FOR_AI, painForAI, painsOf } from '../data/pain';
import { SessionId } from '../data/plan';
import {
  AnyLog,
  ChatMessage,
  ExerciseOverride,
  getLogs,
  getPostureAssessment,
  getSettings,
  logsSince,
  programWeek,
  ReviewChange,
  Settings,
} from '../storage/store';
import { AIError, askAI } from './ai';
import { findDemo } from './demos';

// The coach's prompts, rules and safety checks. Provider-neutral: requests go through askAI() (src/api/ai),
// which sends them to whichever AI provider and model the user picked in Settings.

// The default plan's kit, described in full. Used until the user picks their own equipment.
const DEFAULT_KIT =
  'adjustable barbell + flat/incline bench with low rack uprights, leg extension/curl bench attachment, ' +
  'adjustable plastic-plate dumbbells, push-up bars, ab wheel, two long loop bands (red lighter, black heavier), yoga mat, ' +
  'posture-corrector strap. No pull-up bar, no cables, no machines.';
const SCHEDULE =
  'Schedule: strength Mon/Wed/Fri alternating Day A and Day B, walks Tue/Thu (run-walk from program week 5), ' +
  'long walk Sat, rest Sun, a 10-minute posture routine daily.';

function equipmentText(s: Settings): string {
  const notes = s.equipmentNotes?.trim() ? ` Notes from the user: ${s.equipmentNotes.trim()}.` : '';
  if (!s.equipment) return `Equipment ONLY (default home kit): ${DEFAULT_KIT}${notes}`;
  const labels = EQUIPMENT_OPTIONS.filter(o => s.equipment!.includes(o.key)).map(o => o.label.toLowerCase());
  return `Equipment ONLY: bodyweight${labels.length ? `, ${labels.join(', ')}` : ''}.${notes} Nothing else.`;
}

/** Built from the profile the user fills in under Settings; nothing personal lives in the code. */
function athleteProfile(s: Settings): string {
  const p = s.profile ?? {};
  const who = [p.name?.trim() || 'The user', p.age ? `age ${p.age}` : null, p.work?.trim() || 'desk worker']
    .filter(Boolean)
    .join(', ');
  const sitting = p.sittingHoursPerDay ? `about ${p.sittingHoursPerDay} hours` : 'most of the day';
  return [
    `Athlete: ${who}. Sits ${sitting}. Trains at home.`,
    `Goals: ${p.goals?.trim() || 'better posture, better physique, more strength'}.`,
    p.postureNotes?.trim() ? `Posture notes (self-reported): ${p.postureNotes.trim()}` : null,
    p.healthNotes?.trim() ? `Health / back notes (self-reported): ${p.healthNotes.trim()}` : null,
    s.bodyweightKg ? `Bodyweight: ${s.bodyweightKg} kg.` : null,
    equipmentText(s),
    SCHEDULE,
  ]
    .filter(Boolean)
    .join('\n');
}

export const COACHING_RULES = `
Coaching rules you must follow:
- Be conservative. Progress by adding reps first; add load only when every set hit the top of the rep range with effort <= 4/5 and pain <= 3/10 in every area logged.
- Load increases at most about 5-10% (or the smallest plate step, typically 1-2.5 kg per dumbbell) per week.
- Keep upper-body pulling volume at least 2x pushing volume.
- No barbell back squats or heavy barbell deadlifts. Prefer goblet squats, split squats, dumbbell RDLs, hip thrusts.
- Pain is logged per area on strength days ("pain: none" means no pain or discomfort). Walks and the posture routine don't ask, so they have no pain field: that means not asked, not pain-free. If pain in any area was >= 5/10 or rising: reduce load or volume on the exercises that load that area, or swap them for gentler ones. Never add load to exercises that load a painful area. What loads each area: ${PAIN_LOADS_FOR_AI}.
- If lower back pain was >= 5/10 or rising: reduce load or volume on hinges, squats and the ab wheel, or swap the ab wheel for dead bugs/planks. Keep the gentle posture routine.
- Only use the equipment listed. Never invent data the logs do not contain; if there is too little data, say so and change little or nothing.
- New or swapped exercises must come from the exercise library list, by its exact id. Never invent exercises.
- Red flags (pain spreading down a leg or arm, numbness/tingling, weakness in a leg or arm, night pain, bladder/bowel changes, pain not improving after 4-6 weeks; or a joint that swells, locks, gives way, can't bear weight, or isn't settling after 2 weeks): tell them to stop and see a doctor or physiotherapist, and do not progress anything.
- Chest pain, dizziness, fainting or trouble breathing are not training issues: tell them to stop and get medical help now.
- You cannot see their exercise form. Say so if asked, and point them to the exercise cues, demo photos and demo video.
- You are a coach, not a doctor. Keep answers short and practical.
`.trim();

/**
 * The exercise library the AI may pick from, filtered to the user's equipment, as a cacheable system block.
 * It only changes when the equipment changes, so repeat requests can be served from the provider's prompt cache.
 */
export function librarySystemBlock(s: Settings) {
  const { posture, strength } = candidates(userEquipment(s));
  return {
    text:
      'EXERCISE LIBRARY. You may only add or swap in exercises from these lists, using the exact id (first column). ' +
      'Columns: id | name | equipment | force | level | primary muscles.\n\n' +
      `POSTURE ROUTINE options:\n${libraryAsText(posture)}\n\nSTRENGTH DAY options:\n${libraryAsText(strength)}`,
    cache: true,
  };
}

// ---------- turning logs into a compact text the AI can read ----------

export function logsAsText(logs: AnyLog[]): string {
  if (!logs.length) return 'No workouts logged in this period.';
  return logs
    .slice()
    .reverse()
    .map(l => {
      const day = l.date.slice(0, 10);
      if (l.kind === 'cardio') {
        const pain = l.painRated === false ? '' : ` | pain: ${painForAI(painsOf(l))}`;
        return `${day} ${l.type} ${l.minutes} min${pain}${l.notes ? ` | "${l.notes}"` : ''}`;
      }
      const byEx = new Map<string, string[]>();
      for (const s of l.sets) {
        if (!s.done) continue;
        const parts = [s.weightKg != null ? `${s.weightKg}kg` : null, s.reps != null ? `${s.reps}` : null]
          .filter(Boolean)
          .join('x');
        byEx.set(s.exerciseId, [...(byEx.get(s.exerciseId) ?? []), parts || 'done']);
      }
      const exLines = [...byEx.entries()].map(([id, sets]) => `   [${id}] ${exerciseLabel(id)}: ${sets.join(', ')}`);
      const title = l.session === 'posture' ? 'Posture routine' : `Strength Day ${l.session}`;
      return (
        `${day} ${title} | ` +
        (l.finished === false
          ? 'unfinished, effort and pain not rated'
          : `effort ${l.effort}/5${l.painRated === false ? '' : ` | pain: ${painForAI(painsOf(l))}`}`) +
        `${l.notes ? ` | "${l.notes}"` : ''}\n${exLines.join('\n')}`
      );
    })
    .join('\n');
}

export async function contextBlock(days: number): Promise<string> {
  const settings = await getSettings();
  const week = programWeek(settings.startDate);
  const logs = await logsSince(days);
  const posture = await getPostureAssessment();
  return [
    athleteProfile(settings),
    posture?.findings.length
      ? `Posture check from photos (${posture.date.slice(0, 10)}, visual observations, not a diagnosis):\n- ${posture.findings.join('\n- ')}`
      : null,
    `Today: ${new Date().toDateString()}. Program week: ${week}.`,
    `Current plan (ids in brackets; {library: id} is the demo exercise):\n${await planAsText()}`,
    `Logs from the last ${days} days (oldest first; sets shown as weight x reps):\n${logsAsText(logs)}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

// ---------- weekly plan tuning ----------

export interface ReviewResult {
  summary: string;
  safetyNote?: string;
  changes: ReviewChange[];
  rejected: { exerciseId: string; why: string }[];
}

const REVIEW_TOOL = {
  name: 'submit_weekly_review',
  description: 'Submit the weekly review and any plan changes for the next week.',
  schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: '2-4 short sentences on how the week went, plain language.' },
      safety_note: {
        type: 'string',
        description: 'Only if pain in any area or a red flag needs attention. Otherwise omit.',
      },
      changes: {
        type: 'array',
        description: 'At most 4 changes. Empty if nothing should change.',
        items: {
          type: 'object',
          properties: {
            exercise_id: { type: 'string', description: 'An id from the plan, in brackets.' },
            sets: { type: 'integer', minimum: 1, maximum: 5 },
            reps: { type: 'string', description: 'e.g. "10", "8-12", "30 s"' },
            target_weight_kg: { type: 'number', description: 'Per dumbbell, or total barbell weight.' },
            swap_to: {
              type: 'object',
              description: 'Replace the exercise with one from the exercise library.',
              properties: {
                library_id: { type: 'string', description: 'Exact id from the exercise library list.' },
                cues: { type: 'array', items: { type: 'string' }, description: '2-3 short form cues.' },
              },
              required: ['library_id', 'cues'],
            },
            note: { type: 'string', description: 'One short cue shown on the exercise.' },
            reason: { type: 'string', description: 'Why, citing the logged numbers.' },
          },
          required: ['exercise_id', 'reason'],
        },
      },
    },
    required: ['summary', 'changes'],
  },
};

interface RawChange {
  exercise_id: string;
  sets?: number;
  reps?: string;
  target_weight_kg?: number;
  swap_to?: { library_id: string; cues: string[] };
  note?: string;
  reason: string;
}

function heaviestRecent(logs: AnyLog[], exerciseId: string): number | null {
  let max: number | null = null;
  for (const l of logs) {
    if (l.kind !== 'session') continue;
    for (const s of l.sets) {
      if (s.exerciseId === exerciseId && s.done && s.weightKg != null) max = Math.max(max ?? 0, s.weightKg);
    }
  }
  return max;
}

/** App-side safety checks on the AI's suggestions, so a bad suggestion can't slip through. */
async function validateChanges(raw: RawChange[], logs: AnyLog[]) {
  const plan = await effectivePlan();
  const sessionOf = new Map<string, SessionId>();
  for (const [sid, exs] of Object.entries(plan)) for (const e of exs) sessionOf.set(e.id, sid as SessionId);
  const have = userEquipment(await getSettings());
  const changes: ReviewChange[] = [];
  const rejected: { exerciseId: string; why: string }[] = [];

  for (const c of raw.slice(0, 4)) {
    const session = sessionOf.get(c.exercise_id);
    if (!session) {
      rejected.push({ exerciseId: c.exercise_id, why: 'Not an exercise in your plan.' });
      continue;
    }
    if (c.sets != null && (!Number.isInteger(c.sets) || c.sets < 1 || c.sets > 5)) {
      rejected.push({ exerciseId: c.exercise_id, why: 'Sets must be 1 to 5.' });
      continue;
    }
    if (c.target_weight_kg != null) {
      const prev = heaviestRecent(logs, c.exercise_id);
      if (c.target_weight_kg <= 0 || c.target_weight_kg > 300) {
        rejected.push({ exerciseId: c.exercise_id, why: 'Weight out of range.' });
        continue;
      }
      if (prev == null) {
        rejected.push({ exerciseId: c.exercise_id, why: 'No logged weight yet to progress from.' });
        continue;
      }
      if (c.target_weight_kg > prev * 1.1 + 2.5) {
        rejected.push({
          exerciseId: c.exercise_id,
          why: `Jump from ${prev} kg to ${c.target_weight_kg} kg is bigger than the plan allows.`,
        });
        continue;
      }
    }
    const change: ExerciseOverride = {};
    if (c.swap_to) {
      const lib = findDemo(c.swap_to.library_id);
      const why = lib ? rejectReason(lib, session, have) : 'Not in the exercise library.';
      if (!lib || why) {
        rejected.push({ exerciseId: c.exercise_id, why: `Swap blocked: ${why}` });
        continue;
      }
      change.swapTo = {
        name: lib.name,
        equipment: equipmentLabel(lib, have),
        cues: (c.swap_to.cues ?? []).slice(0, 4),
        demoSearch: [],
        demoId: lib.id,
        loaded: isLoaded(lib),
      };
    }
    if (c.sets != null) change.sets = c.sets;
    if (c.reps) change.reps = c.reps.slice(0, 20);
    if (c.target_weight_kg != null) change.targetWeightKg = c.target_weight_kg;
    if (c.note) change.note = c.note;
    changes.push({ exerciseId: c.exercise_id, change, reason: c.reason });
  }
  return { changes, rejected };
}

export async function runWeeklyReview(): Promise<ReviewResult> {
  const recentLogs = await logsSince(14);
  if (!recentLogs.length) {
    throw new AIError('Log at least one workout before running a review.');
  }
  const settings = await getSettings();
  const { toolInput } = await askAI({
    maxTokens: 16000,
    system: [{ text: `You are a careful strength and posture coach.\n\n${COACHING_RULES}` }, librarySystemBlock(settings)],
    tool: REVIEW_TOOL,
    messages: [
      {
        role: 'user',
        content:
          `${await contextBlock(14)}\n\n` +
          'Review the last 7 days (the 7 days before that are for comparison). ' +
          "Decide next week's adjustments following the coaching rules, then call submit_weekly_review once with your answer.",
      },
    ],
  });

  const input = toolInput as { summary?: string; safety_note?: string; changes?: RawChange[] };
  const { changes, rejected } = await validateChanges(Array.isArray(input.changes) ? input.changes : [], await getLogs());
  return { summary: String(input.summary ?? '').slice(0, 800), safetyNote: input.safety_note, changes, rejected };
}

// ---------- coach chat ----------

export async function askCoach(history: ChatMessage[]): Promise<string> {
  const name = (await getSettings()).profile?.name?.trim();
  const { text } = await askAI({
    maxTokens: 8000,
    effort: 'low',
    system: [
      {
        text:
          `You are ${name ? `${name}'s` : 'the user’s'} posture and home workout coach in the omaFIT app, chatting on their phone. ` +
          `They spend long hours sitting.\n\n${COACHING_RULES}\n\n` +
          `Context:\n${await contextBlock(14)}`,
      },
    ],
    messages: history.slice(-20).map(m => ({ role: m.role, content: m.content })),
  });
  if (!text) throw new AIError('Empty reply from your AI coach. Try again.');
  return text;
}
