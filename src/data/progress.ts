// Daily progress stats built from the workout logs. Read-only: nothing here is stored.
import { AnyLog, isUnfinished } from '../storage/store';

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
  /** Highest back pain rated that day, or null if none (unfinished workouts aren't rated yet) */
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
    const rated = dayLogs.filter(l => !isUnfinished(l));
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
      maxPain: rated.length ? Math.max(...rated.map(l => l.backPain)) : null,
      active: dayLogs.length > 0,
    });
  }
  return out;
}

export interface Summary {
  /** Days in a row with something logged. Today still counts as "not missed yet". */
  streak: number;
  bestStreak: number;
  /** Active days since Monday */
  activeThisWeek: number;
  /** Days elapsed this week, Monday = 1 */
  daysIntoWeek: number;
  totalWorkouts: number;
  totalWalkMinutes: number;
  activeToday: boolean;
}

export function summary(logs: AnyLog[], now = new Date()): Summary {
  const activeDays = new Set(logs.map(l => dayKey(new Date(l.date))));
  const shift = (n: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + n);

  const activeToday = activeDays.has(dayKey(now));
  // Count back from today if you've trained, otherwise from yesterday,
  // so the streak doesn't show as broken before the day is over.
  let streak = 0;
  for (let i = activeToday ? 0 : -1; activeDays.has(dayKey(shift(i))); i--) streak++;

  let bestStreak = 0;
  for (const k of activeDays) {
    const [y, m, d] = k.split('-').map(Number);
    // Only start counting at the first day of a run
    if (activeDays.has(dayKey(new Date(y, m - 1, d - 1)))) continue;
    let run = 1;
    while (activeDays.has(dayKey(new Date(y, m - 1, d + run)))) run++;
    bestStreak = Math.max(bestStreak, run);
  }

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
  };
}

/** A short line to nudge you back. */
export function encouragement(s: Summary): string {
  if (s.streak === 0) return s.totalWorkouts ? 'Start a new streak today. Even the posture routine counts.' : 'Log your first session to start a streak.';
  if (!s.activeToday) return `Keep your ${s.streak}-day streak alive: do the posture routine today.`;
  if (s.streak >= s.bestStreak && s.streak > 1) return 'This is your best streak yet. Keep going.';
  return 'Done for today. See you tomorrow.';
}
