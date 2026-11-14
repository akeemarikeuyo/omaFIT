// The weekly review runs once a week, on or after the user's review day. This keeps AI calls (and API costs)
// predictable and builds a weekly habit instead of constant checking. "Reset plan to original" unlocks one extra review.
import type { ReviewRecord, Settings } from '../storage/store';

/** Sunday: the plan's rest day, so changes are ready for Monday */
export const DEFAULT_REVIEW_DAY = 0;
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const reviewDayOf = (s: Settings) => s.reviewDay ?? DEFAULT_REVIEW_DAY;

/** Midnight (local) at the start of the current review week: the latest review day on or before today. */
export function reviewWeekStart(reviewDay: number, now = new Date()): Date {
  const back = (now.getDay() - reviewDay + 7) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
}

export interface ReviewStatus {
  allowed: boolean;
  /** When the next review unlocks (only when not allowed) */
  next?: Date;
  /** Unlocked early by "Reset plan to original" */
  afterReset?: boolean;
}

/**
 * Whether the user can run a review now: once per review week (from the review day until the next one), the first
 * review any time, and one extra after "Reset plan to original".
 */
export function reviewStatus(reviews: ReviewRecord[], s: Settings, now = new Date()): ReviewStatus {
  const last = reviews[0];
  if (!last) return { allowed: true };
  const lastAt = new Date(last.date);
  const start = reviewWeekStart(reviewDayOf(s), now);
  if (lastAt < start) return { allowed: true };
  if (s.planResetAt && lastAt < new Date(s.planResetAt)) return { allowed: true, afterReset: true };
  const next = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return { allowed: false, next };
}
