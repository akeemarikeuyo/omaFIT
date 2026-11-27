// Daily progress stats built from the workout logs. Read-only: nothing here is stored.
import { AnyLog, isPainRated } from '../storage/store';
import { maxPain, painLabel, painsOf } from './pain';
import { dayKind, DEFAULT_WEEK, WeekSetup } from './plan';

/** Local calendar day as YYYY-MM-DD (logs are stored in UTC, but a day is your day). */
export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export interface DayStats {
  key: string;
  date: Date;
  postureSets: number;
  strengthSets: number;
  walkMinutes: number;
  /** Highest pain rated that day in any area (0 = rated, no pain), or null if nothing rated (only strength days ask) */
  maxPain: number | null;
  active: boolean;
}

/** One entry per day for the last `days` days, oldest first, ending today. */
export function dailyStats(logs: AnyLog[], days: number, now = new Date()): DayStats[] {
  const byDay = new Map<string, AnyLog[]>();
  for (const l of logs) {
    const k = dayKey(new Date(l.date));
    const list = byDay.get(k);
    if (list) list.push(l);
    else byDay.set(k, [l]);
  }

  const out: DayStats[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = dayKey(date);
    const dayLogs = byDay.get(key) ?? [];
    const rated = dayLogs.filter(isPainRated);
    let postureSets = 0;
    let strengthSets = 0;
    let walkMinutes = 0;
    for (const l of dayLogs) {
      if (l.kind === 'cardio') walkMinutes += l.minutes;
      else {
        const done = l.sets.filter(s => s.done).length;
        if (l.session === 'posture') postureSets += done;
        else strengthSets += done;
      }
    }
    out.push({
      key,
      date,
      postureSets,
      strengthSets,
      walkMinutes,
      maxPain: rated.length ? Math.max(...rated.map(l => maxPain(painsOf(l)))) : null,
      active: dayLogs.length > 0,
    });
  }
  return out;
}

export interface Summary {
  /**
   * Days in a row on plan: days with something logged, plus planned rest days that follow one
   * (resting on plan keeps the streak and adds to it, but can't start one). Today still counts as "not missed yet".
   */
  streak: number;
  bestStreak: number;
  /** Active days since Monday */
  activeThisWeek: number;
  /** Days elapsed this week, Monday = 1 */
  daysIntoWeek: number;
  totalWorkouts: number;
  totalWalkMinutes: number;
  activeToday: boolean;
  /** Today is a planned rest day */
  restToday: boolean;
}

export function summary(logs: AnyLog[], now = new Date(), week: WeekSetup = DEFAULT_WEEK): Summary {
  const activeDays = new Set(logs.map(l => dayKey(new Date(l.date))));
  const shift = (n: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + n);

  const activeToday = activeDays.has(dayKey(now));
  const restToday = dayKind(now, week) === 'rest';

  // Walk day by day from the first log to today. A logged day adds to the run; a planned rest day
  // adds only when a run is going, so resting on plan never breaks a streak but can't start one.
  let run = 0;
  let runBeforeToday = 0;
  let bestStreak = 0;
  const first = logs.reduce<Date | null>((min, l) => {
    const d = new Date(l.date);
    return !min || d < min ? d : min;
  }, null);
  if (first) {
    const startOffset = Math.round((new Date(first.getFullYear(), first.getMonth(), first.getDate()).getTime() - shift(0).getTime()) / 86400000);
    for (let i = startOffset; i <= 0; i++) {
      if (i === 0) runBeforeToday = run;
      const day = shift(i);
      if (activeDays.has(dayKey(day))) run++;
      else if (dayKind(day, week) === 'rest' && run > 0) run++;
      else run = 0;
      bestStreak = Math.max(bestStreak, run);
    }
  }
  // If today isn't counted yet, show the streak up to yesterday, so it doesn't look broken before the day is over
  const streak = run > 0 ? run : runBeforeToday;

  const daysIntoWeek = ((now.getDay() + 6) % 7) + 1; // Mon=1 … Sun=7
  let activeThisWeek = 0;
  for (let i = 0; i < daysIntoWeek; i++) if (activeDays.has(dayKey(shift(-i)))) activeThisWeek++;

  return {
    streak,
    bestStreak,
    activeThisWeek,
    daysIntoWeek,
    totalWorkouts: logs.filter(l => l.kind === 'session').length,
    totalWalkMinutes: logs.reduce((n, l) => n + (l.kind === 'cardio' ? l.minutes : 0), 0),
    activeToday,
    restToday,
  };
}

export interface PainPlace {
  label: string;
  days: number;
  worst: number;
}

/** Where pain was logged since `since`, most days first. */
export function painPlaces(logs: AnyLog[], since: Date): PainPlace[] {
  const byPlace = new Map<string, { days: Set<string>; worst: number }>();
  for (const l of logs) {
    if (!isPainRated(l) || new Date(l.date) < since) continue;
    for (const p of painsOf(l)) {
      const label = painLabel(p);
      const e = byPlace.get(label) ?? { days: new Set<string>(), worst: 0 };
      e.days.add(dayKey(new Date(l.date)));
      e.worst = Math.max(e.worst, p.score);
      byPlace.set(label, e);
    }
  }
  return [...byPlace.entries()]
    .map(([label, e]) => ({ label, days: e.days.size, worst: e.worst }))
    .sort((a, b) => b.days - a.days || b.worst - a.worst);
}

/** A short line to nudge you back. */
export function encouragement(s: Summary): string {
  if (s.streak === 0) return s.totalWorkouts ? 'Start a new streak today. Even the posture routine counts.' : 'Log your first session to start a streak.';
  if (!s.activeToday && s.restToday) return `Rest day. Your ${s.streak}-day streak is safe, and resting counts.`;
  if (!s.activeToday) return `Keep your ${s.streak}-day streak alive: do the posture routine today.`;
  if (s.streak >= s.bestStreak && s.streak > 1) return 'This is your best streak yet. Keep going.';
  return 'Done for today. See you tomorrow.';
}

/** One workout's best set of an exercise: heaviest weight (most reps at it), or most reps if no weight was logged. */
export interface ExercisePoint {
  date: string;
  weightKg?: number;
  reps?: number;
}

/** Best set per workout for one exercise, oldest first. Only ticked sets count. */
export function exerciseHistory(logs: AnyLog[], exerciseId: string): ExercisePoint[] {
  const out: ExercisePoint[] = [];
  for (const l of logs) {
    if (l.kind !== 'session') continue;
    const sets = l.sets.filter(s => s.exerciseId === exerciseId && s.done);
    if (!sets.length) continue;
    const best = sets.reduce((a, b) => {
      const wa = a.weightKg ?? -1;
      const wb = b.weightKg ?? -1;
      if (wb !== wa) return wb > wa ? b : a;
      return (b.reps ?? -1) > (a.reps ?? -1) ? b : a;
    });
    out.push({ date: l.date, weightKg: best.weightKg, reps: best.reps });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** The number to chart: weight if this exercise has logged weights, otherwise reps. */
export function pointValue(p: ExercisePoint, byWeight: boolean): number {
  return (byWeight ? p.weightKg : p.reps) ?? 0;
}
