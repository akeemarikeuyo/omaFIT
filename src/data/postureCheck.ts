// Posture check-ins: every 4 weeks after a posture check, Today suggests a new one so the user can see what changed.
// Only for users who did a check before (it needs photos and an AI key), and "Not now" hides it for a week.
import type { PostureAssessment } from '../storage/store';

export const CHECK_EVERY_DAYS = 28;
export const SNOOZE_DAYS = 7;

const DAY_MS = 86_400_000;

/** Days since the last check, when a new one is due; otherwise null. `history` is newest first. */
export function postureCheckDue(history: PostureAssessment[], snoozedUntil?: string, now = new Date()): number | null {
  const last = history[0];
  if (!last) return null;
  if (snoozedUntil && now < new Date(snoozedUntil)) return null;
  const days = Math.floor((now.getTime() - new Date(last.date).getTime()) / DAY_MS);
  return days >= CHECK_EVERY_DAYS ? days : null;
}

export const snoozeUntil = (now = new Date()) => new Date(now.getTime() + SNOOZE_DAYS * DAY_MS).toISOString();
