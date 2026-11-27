// Small builders for test logs. Dates are local, like the app's days.
import type { CardioLog, WorkoutLog } from '../storage/store';

let n = 0;

export function walkOn(date: Date, minutes = 30): CardioLog {
  return { id: `t${n++}`, kind: 'cardio', date: date.toISOString(), type: 'walk', minutes, backPain: 0, notes: '' };
}

export function workoutOn(date: Date, sets: WorkoutLog['sets'], session: WorkoutLog['session'] = 'A'): WorkoutLog {
  return { id: `t${n++}`, kind: 'session', date: date.toISOString(), session, sets, backPain: 0, effort: 3, notes: '' };
}

/** Local noon, so time zones never move a log to another day */
export const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);
