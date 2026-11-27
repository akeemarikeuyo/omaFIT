// The days ahead as the plan lays them out, for the "Your week" list on Today. Read-only, derived from the plan.
import { programWeek } from '../storage/store';
import { DayKind, dayKind, DEFAULT_WEEK, walkToday, WalkToday, WeekSetup } from './plan';

export interface PlannedDay {
  date: Date;
  kind: DayKind;
  /** Strength days: which session, following the A/B rotation */
  strength?: 'A' | 'B';
  /** The walk or run the plan asks for; none on the rest day */
  walk?: WalkToday;
}

/**
 * `count` days starting at `from`. `firstStrength` is the session the first strength day in the list gets
 * (today's if today is a strength day, otherwise the next one); after that they alternate A, B.
 */
export function upcomingDays(
  from: Date,
  startDate: string,
  firstStrength: 'A' | 'B',
  week: WeekSetup = DEFAULT_WEEK,
  count = 7,
): PlannedDay[] {
  let strength = firstStrength;
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const kind = dayKind(date, week);
    const day: PlannedDay = { date, kind };
    if (kind === 'strength') {
      day.strength = strength;
      strength = strength === 'A' ? 'B' : 'A';
    }
    if (kind !== 'rest') day.walk = walkToday(date, programWeek(startDate, date), week);
    return day;
  });
}
