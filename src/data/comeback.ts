// Coming back after a break: the program week counts calendar weeks from the start date, so after weeks away the
// walk plan would jump ahead (e.g. straight to run-walk). Offer to pick up where the user left off instead.
import { AnyLog, programWeek } from '../storage/store';
import { dayKey } from './progress';

/** Away this long before the offer shows */
export const BREAK_DAYS = 14;
/** Away this long: go back one more week, to ease in */
const LONG_BREAK_DAYS = 28;

export interface ComebackOffer {
  /** Days since the last logged activity, or since the start date if nothing is logged */
  daysAway: number;
  /** Nothing logged yet: the user set up the app and didn't start */
  neverStarted: boolean;
  weekNow: number;
  resumeWeek: number;
  /** Identifies this break, so an answered offer doesn't come back for it */
  key: string;
}

const DAY_MS = 86_400_000;
const localMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function comebackOffer(logs: AnyLog[], startDate: string, answeredFor?: string, now = new Date()): ComebackOffer | null {
  const latest = logs.reduce<Date | null>((max, l) => {
    const d = new Date(l.date);
    return !max || d > max ? d : max;
  }, null);
  const last = latest ?? new Date(`${startDate}T00:00:00`);
  const daysAway = Math.round((localMidnight(now).getTime() - localMidnight(last).getTime()) / DAY_MS);
  if (daysAway < BREAK_DAYS) return null;

  const weekNow = programWeek(startDate, now);
  const weekThen = programWeek(startDate, last);
  const resumeWeek = Math.max(1, daysAway >= LONG_BREAK_DAYS ? weekThen - 1 : weekThen);
  if (resumeWeek >= weekNow) return null;

  const key = dayKey(last);
  if (key === answeredFor) return null;
  return { daysAway, neverStarted: !latest, weekNow, resumeWeek, key };
}

/** The start date (YYYY-MM-DD) that makes today fall in `week`. */
export function startDateForWeek(week: number, now = new Date()): string {
  return dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (week - 1) * 7));
}
