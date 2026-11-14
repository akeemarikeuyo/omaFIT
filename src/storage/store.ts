import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { SessionId } from '../data/plan';

// ---------- API keys (phone's secure storage, never in the code) ----------

/** One API key per AI provider. The Claude key keeps its original slot so existing keys still work. */
export type KeyName = 'anthropic' | 'openai' | 'gemini' | 'deepseek';
const KEY_IDS: Record<KeyName, string> = {
  anthropic: 'anthropic_api_key',
  openai: 'openai_api_key',
  gemini: 'gemini_api_key',
  deepseek: 'deepseek_api_key',
};

export async function getKey(name: KeyName): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_IDS[name]);
}
export async function setKey(name: KeyName, value: string): Promise<void> {
  const v = value.trim();
  if (v) await SecureStore.setItemAsync(KEY_IDS[name], v);
  else await SecureStore.deleteItemAsync(KEY_IDS[name]);
}

// ---------- small JSON helpers ----------

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
async function writeJson(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// ---------- settings ----------

/** About you, for the AI coach. All optional; stored on this phone only. */
export interface Profile {
  name?: string;
  age?: number;
  /** e.g. "software engineer" */
  work?: string;
  sittingHoursPerDay?: number;
  goals?: string;
  /** e.g. "forward head, rounded shoulders" */
  postureNotes?: string;
  /** e.g. "occasional lower back pain" */
  healthNotes?: string;
}

export interface Settings {
  profile?: Profile;
  /** Which AI provider the coach uses. Missing = Gemini, or Claude if a Claude key is saved (see settingsWithProvider). */
  aiProvider?: KeyName;
  /** Model chosen per provider. Missing = that provider's default. */
  aiModels?: Partial<Record<KeyName, string>>;
  /** Library equipment keys you have (see EQUIPMENT_OPTIONS). Missing = the default home kit. */
  equipment?: string[];
  /** Anything the list doesn't cover, e.g. "flat bench, dumbbells up to 20 kg" */
  equipmentNotes?: string;
  /** ISO date the program started; drives the walking/running week */
  startDate: string;
  bodyweightKg?: number;
  /** Rest between sets on strength days. Missing = the plan's default. */
  restSeconds?: number;
  /** The one-time "turn on notifications?" question has been shown (see src/session/restAlert.ts). */
  notificationsAsked?: boolean;
  /** Day the weekly review unlocks, 0 = Sunday … 6 = Saturday. Missing = Sunday. See src/data/reviewSchedule.ts. */
  reviewDay?: number;
  /** When "Reset plan to original" was last used: unlocks one extra weekly review. */
  planResetAt?: string;
}
const SETTINGS = 'settings_v1';

export const MIN_REST_SECONDS = 60;
export const REST_OPTIONS = [60, 75, 90, 120, 150, 180];

/** Rest for a session: your setting on strength days (never under 60 s), the plan's value for posture. */
export function restSecondsFor(session: { id: SessionId; restSeconds: number }, s: Settings): number {
  if (session.id === 'posture') return session.restSeconds;
  return Math.max(MIN_REST_SECONDS, s.restSeconds ?? session.restSeconds);
}

export async function getSettings(): Promise<Settings> {
  const s = await readJson<Settings | null>(SETTINGS, null);
  if (s) return s;
  const fresh: Settings = { startDate: new Date().toISOString().slice(0, 10) };
  await writeJson(SETTINGS, fresh);
  return fresh;
}
/** Merges into the saved settings, so saving one field never wipes another. */
export async function saveSettings(patch: Partial<Settings>) {
  await writeJson(SETTINGS, { ...(await getSettings()), ...patch });
}
export function programWeek(startDate: string, now = new Date()): number {
  const start = new Date(`${startDate}T00:00:00`);
  const days = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, Math.floor(days / 7) + 1);
}

// ---------- workout logs ----------

export interface SetLog {
  exerciseId: string;
  setIndex: number;
  reps?: number;
  weightKg?: number;
  done: boolean;
}
/** Where it hurts. See src/data/pain.ts for labels and which areas have a side. */
export type PainArea = 'neck' | 'upper-back' | 'lower-back' | 'shoulder' | 'elbow' | 'wrist' | 'hip' | 'knee' | 'ankle' | 'other';
export type PainSide = 'left' | 'right' | 'both';
/** Pain or discomfort in one place, 1 (slight) to 10 (worst). */
export interface PainEntry {
  area: PainArea;
  /** Joints only */
  side?: PainSide;
  score: number;
  /** For "other": a few words, e.g. "right calf" */
  note?: string;
}

export interface WorkoutLog {
  id: string;
  kind: 'session';
  date: string; // ISO datetime
  session: SessionId;
  sets: SetLog[];
  /** Lower back score (0 = none). Kept so older logs and code still work: read pain with painsOf() instead. */
  backPain: number;
  /** Pain or discomfort by area. Missing on logs from before this field: painsOf() falls back to backPain. */
  pains?: PainEntry[];
  /** false = pain wasn't asked (posture routine). Missing = asked. See isPainRated(). */
  painRated?: boolean;
  /** 1 = very easy, 5 = could not do one more rep */
  effort: number;
  notes: string;
  /**
   * false while the workout is still going: sets are saved as they're ticked, and back pain and effort aren't
   * rated yet. Missing = finished (all logs before this field existed were saved at the end).
   */
  finished?: boolean;
}

/** A workout saved as it goes and not finished yet. Its pain and effort are not ratings yet. */
export const isUnfinished = (l: AnyLog): l is WorkoutLog => l.kind === 'session' && l.finished === false;

/**
 * Whether this log has a pain rating. Strength days and walks/runs ask; the posture routine doesn't and is saved with
 * `painRated: false`, so its empty pain list never counts as "no pain". Older logs always asked.
 */
export const isPainRated = (l: AnyLog) => !isUnfinished(l) && l.painRated !== false;
export interface CardioLog {
  id: string;
  kind: 'cardio';
  date: string;
  type: 'walk' | 'run-walk' | 'run';
  minutes: number;
  /** Lower back score, as on WorkoutLog. Read pain with painsOf(). */
  backPain: number;
  pains?: PainEntry[];
  /** false = pain wasn't asked (only walks logged by one test build). Missing = asked. */
  painRated?: boolean;
  notes: string;
}
export type AnyLog = WorkoutLog | CardioLog;
const LOGS = 'logs_v1';

export async function getLogs(): Promise<AnyLog[]> {
  const logs = await readJson<AnyLog[]>(LOGS, []);
  return logs.sort((a, b) => b.date.localeCompare(a.date));
}
export async function addLog(log: Omit<WorkoutLog, 'id'> | Omit<CardioLog, 'id'>) {
  const logs = await getLogs();
  logs.unshift({ ...log, id: uid() } as AnyLog);
  await writeJson(LOGS, logs);
}
/** New id for a workout saved as it goes (see saveWorkout). */
export const newLogId = uid;

/** Saves a workout, replacing the saved copy with the same id. Used to save a session after every tick. */
export async function saveWorkout(log: WorkoutLog) {
  const logs = await getLogs();
  const i = logs.findIndex(l => l.id === log.id);
  if (i >= 0) logs[i] = log;
  else logs.unshift(log);
  await writeJson(LOGS, logs);
}

const sameLocalDay = (iso: string, now = new Date()) => new Date(iso).toDateString() === now.toDateString();

/** Today's unfinished workout (for one session, or any), to continue where the user left off. */
export async function unfinishedToday(session?: SessionId): Promise<WorkoutLog | null> {
  const found = (await getLogs()).find(l => isUnfinished(l) && sameLocalDay(l.date) && (!session || l.session === session));
  return (found as WorkoutLog | undefined) ?? null;
}

export async function deleteLog(id: string) {
  const logs = await getLogs();
  await writeJson(LOGS, logs.filter(l => l.id !== id));
}
export async function logsSince(days: number): Promise<AnyLog[]> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  return (await getLogs()).filter(l => l.date >= cutoff);
}

/**
 * Alternate A and B: next strength day is the opposite of the last one logged. If today's strength day was
 * started and not finished, it's still that one, so the user can continue it.
 */
export async function nextStrengthSession(): Promise<'A' | 'B'> {
  const last = (await getLogs()).find(
    (l): l is WorkoutLog => l.kind === 'session' && (l.session === 'A' || l.session === 'B'),
  );
  if (last && isUnfinished(last) && sameLocalDay(last.date)) return last.session as 'A' | 'B';
  return last?.session === 'A' ? 'B' : 'A';
}

/** Most recent logged weight and reps for an exercise, to prefill the next session. `skipLogId`: the workout in progress. */
export async function lastPerformance(exerciseId: string, skipLogId?: string): Promise<SetLog[] | null> {
  for (const l of await getLogs()) {
    if (l.kind !== 'session' || l.id === skipLogId) continue;
    const sets = l.sets.filter(s => s.exerciseId === exerciseId && s.done);
    if (sets.length) return sets;
  }
  return null;
}

// ---------- plan overrides (applied from the AI's weekly review, only when you approve) ----------

export interface ExerciseOverride {
  sets?: number;
  reps?: string;
  targetWeightKg?: number;
  /** Swap to a different exercise, keeping the slot */
  swapTo?: {
    name: string;
    equipment: string;
    cues: string[];
    demoSearch: string[];
    /** Library exercise id. Set for every swap the AI makes now; older swaps only have demoSearch. */
    demoId?: string;
    loaded?: boolean;
  };
  /** Drop this exercise from its session */
  removed?: boolean;
  note?: string;
}
export type Overrides = Record<string, ExerciseOverride>;
const OVERRIDES = 'overrides_v1';

export const getOverrides = () => readJson<Overrides>(OVERRIDES, {});
export async function mergeOverrides(patch: Overrides) {
  const cur = await getOverrides();
  for (const [id, o] of Object.entries(patch)) cur[id] = { ...cur[id], ...o };
  await writeJson(OVERRIDES, cur);
}
export const resetOverrides = () => writeJson(OVERRIDES, {});

// ---------- exercises the AI added from the library (applied only when you approve) ----------

export interface AddedExercise {
  /** lib-<session>-<libraryId>, see addedExerciseId */
  id: string;
  session: SessionId;
  /** Library id: every added exercise has a demo */
  demoId: string;
  name: string;
  sets: number;
  reps: string;
  perSide?: boolean;
  loaded: boolean;
  equipment: string;
  cues: string[];
}
const ADDITIONS = 'plan_additions_v1';

export const getAdditions = () => readJson<AddedExercise[]>(ADDITIONS, []);
export async function addAdditions(items: AddedExercise[]) {
  const cur = (await getAdditions()).filter(a => !items.some(i => i.id === a.id));
  await writeJson(ADDITIONS, [...cur, ...items]);
}
export async function removeAdditions(ids: string[]) {
  await writeJson(ADDITIONS, (await getAdditions()).filter(a => !ids.includes(a.id)));
}

/** Back to the baseline plan: clears review changes and AI-added exercises. Logs are kept. */
export async function resetPlan() {
  await resetOverrides();
  await writeJson(ADDITIONS, []);
  // Nothing is applied any more, so reviews and AI plans can be applied again
  await writeJson(REVIEWS, (await getReviews()).map(r => ({ ...r, applied: false })));
  await writeJson(PROPOSALS, (await getProposals()).map(p => ({ ...p, applied: false })));
  // Starting over unlocks one extra weekly review
  await saveSettings({ planResetAt: new Date().toISOString() });
}

// ---------- posture check (findings only; photos are never stored) ----------

export interface PostureAssessment {
  date: string;
  findings: string[];
}
const POSTURE = 'posture_assessment_v1';
export const getPostureAssessment = () => readJson<PostureAssessment | null>(POSTURE, null);
export const savePostureAssessment = (a: PostureAssessment) => writeJson(POSTURE, a);

// ---------- weekly reviews ----------

export interface ReviewRecord {
  id: string;
  date: string;
  summary: string;
  safetyNote?: string;
  changes: ReviewChange[];
  applied: boolean;
}
export interface ReviewChange {
  exerciseId: string;
  change: ExerciseOverride;
  reason: string;
}
const REVIEWS = 'reviews_v1';

export const getReviews = () => readJson<ReviewRecord[]>(REVIEWS, []);
export async function saveReview(r: Omit<ReviewRecord, 'id'>): Promise<ReviewRecord> {
  const all = await getReviews();
  const rec = { ...r, id: uid() };
  all.unshift(rec);
  await writeJson(REVIEWS, all.slice(0, 20));
  return rec;
}
export async function markReviewApplied(id: string) {
  const all = await getReviews();
  await writeJson(REVIEWS, all.map(r => (r.id === id ? { ...r, applied: true } : r)));
}

// ---------- AI plan proposals (from "Build my plan") ----------

export interface ProposedAdd {
  session: SessionId;
  libraryId: string;
  name: string;
  sets: number;
  reps: string;
  perSide: boolean;
  cues: string[];
  reason: string;
}
export interface ProposedSwap {
  exerciseId: string;
  libraryId: string;
  name: string;
  cues: string[];
  reason: string;
}
export interface ProposedRemove {
  exerciseId: string;
  reason: string;
}
export interface ProposedAdjust {
  exerciseId: string;
  sets?: number;
  reps?: string;
  reason: string;
}
export interface PlanProposal {
  id: string;
  date: string;
  summary: string;
  findings: string[];
  safetyNote?: string;
  add: ProposedAdd[];
  swap: ProposedSwap[];
  remove: ProposedRemove[];
  adjust: ProposedAdjust[];
  /** Suggestions the app blocked, with the reason */
  rejected: { what: string; why: string }[];
  applied: boolean;
}
const PROPOSALS = 'plan_proposals_v1';

export const getProposals = () => readJson<PlanProposal[]>(PROPOSALS, []);
export async function saveProposal(p: Omit<PlanProposal, 'id'>): Promise<PlanProposal> {
  const rec = { ...p, id: uid() };
  await writeJson(PROPOSALS, [rec, ...(await getProposals())].slice(0, 10));
  return rec;
}
export async function markProposalApplied(id: string) {
  await writeJson(PROPOSALS, (await getProposals()).map(p => (p.id === id ? { ...p, applied: true } : p)));
}

// ---------- coach chat ----------

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
const CHAT = 'chat_v1';
export const getChat = () => readJson<ChatMessage[]>(CHAT, []);
export const saveChat = (m: ChatMessage[]) => writeJson(CHAT, m.slice(-60));
export const clearChat = () => writeJson(CHAT, []);

// ---------- GIF choices (which demo you picked for each plan exercise) ----------

const GIF_PICKS = 'gif_picks_v1';
export const getGifPicks = () => readJson<Record<string, string>>(GIF_PICKS, {});
export async function setGifPick(exerciseId: string, dbId: string) {
  const picks = await getGifPicks();
  picks[exerciseId] = dbId;
  await writeJson(GIF_PICKS, picks);
}
