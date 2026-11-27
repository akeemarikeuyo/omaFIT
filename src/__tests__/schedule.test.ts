// The streak (rest days), the week plan, Full/Short sessions and coming back after a break.
import { describe, expect, it } from '@jest/globals';
import { applyOverrides } from '../data/effective';
import { comebackOffer, startDateForWeek } from '../data/comeback';
import { upperBodyBalance } from '../data/library';
import { dayKind, SESSIONS, weekProblem, weekText } from '../data/plan';
import { exerciseHistory, summary } from '../data/progress';
import { estimateSeconds, hasShortVersion, sessionMinutes, shortVersion } from '../data/sessionLength';
import { upcomingDays } from '../data/week';
import { programWeek } from '../storage/store';
import { postureCheckDue } from '../data/postureCheck';
import { breakTimes } from '../session/postureReminders';
import { day, walkOn, workoutOn } from './helpers';

// 23 Nov 2026 is a Monday; Sunday the 29th is the planned rest day
const monToSat = [23, 24, 25, 26, 27, 28].map(d => walkOn(day(2026, 11, d)));

describe('streak', () => {
  it('counts the planned rest day as a streak day', () => {
    expect(summary(monToSat, day(2026, 11, 29)).streak).toBe(7);
  });

  it("isn't broken before the day is over", () => {
    expect(summary(monToSat, day(2026, 11, 30)).streak).toBe(7);
  });

  it('breaks after a missed training day', () => {
    expect(summary(monToSat, day(2026, 12, 1)).streak).toBe(0);
  });

  it("can't start from a rest day", () => {
    // Fri 13th logged, Sat 14th missed, Sun 15th rest, Mon 16th logged: the Sunday doesn't count
    const logs = [walkOn(day(2026, 11, 13)), walkOn(day(2026, 11, 16))];
    expect(summary(logs, day(2026, 11, 16)).streak).toBe(1);
  });

  it('carries the best streak across a rest day', () => {
    const logs = [20, 21, 23].map(d => walkOn(day(2026, 11, d)));
    expect(summary(logs, day(2026, 12, 10)).bestStreak).toBe(4);
  });
});

describe('upcomingDays', () => {
  const week = upcomingDays(day(2026, 11, 23), '2026-11-23', 'A');

  it('follows the weekday pattern and alternates A and B', () => {
    expect(week.map(d => d.kind)).toEqual(['strength', 'walk', 'strength', 'walk', 'strength', 'longwalk', 'rest']);
    expect(week.filter(d => d.strength).map(d => d.strength)).toEqual(['A', 'B', 'A']);
  });

  it('has no walk on the rest day', () => {
    expect(week[6].walk).toBeUndefined();
  });

  it('moves to the next walk stage when the program week changes', () => {
    // Started 10 Nov: Monday the 23rd is week 2, Tuesday the 24th week 3
    const days = upcomingDays(day(2026, 11, 23), '2026-11-10', 'A');
    expect(days[0].walk?.weeks).toBe('1-2');
    expect(days[1].walk?.weeks).toBe('3-4');
  });
});

describe('Short sessions', () => {
  it('keep pulling at least twice pushing', () => {
    for (const id of ['A', 'B'] as const) {
      const short = shortVersion(SESSIONS[id].exercises);
      const { push, pull } = upperBodyBalance(short.map(e => ({ demoId: e.demoId, sets: e.sets })));
      expect(pull).toBeGreaterThanOrEqual(2 * push);
    }
  });

  it('are shorter than Full, for every session', () => {
    for (const s of Object.values(SESSIONS)) {
      expect(hasShortVersion(s.exercises)).toBe(true);
      expect(sessionMinutes(shortVersion(s.exercises), 75)).toBeLessThan(sessionMinutes(s.exercises, 75));
    }
  });

  it('never use more sets than the full exercise', () => {
    const lowered = applyOverrides(SESSIONS.A, { 'one-arm-row': { sets: 2 } });
    expect(shortVersion(lowered).find(e => e.id === 'one-arm-row')?.sets).toBe(2);
  });

  it('keep a swapped-in exercise in its slot, and leave AI-added ones out', () => {
    const swapped = applyOverrides(
      SESSIONS.A,
      { 'one-arm-row': { swapTo: { name: 'Other row', equipment: 'Dumbbell', cues: [], demoSearch: [] } } },
      [{ id: 'lib-A-Dumbbell_Bench_Press', session: 'A', name: 'Bench', sets: 3, reps: '10', perSide: false, loaded: true, equipment: 'Dumbbell', cues: [], demoId: 'Dumbbell_Bench_Press' }],
    );
    const ids = shortVersion(swapped).map(e => e.id);
    expect(ids).toContain('one-arm-row');
    expect(ids).not.toContain('lib-A-Dumbbell_Bench_Press');
  });

  it('estimate nothing when nothing is left', () => {
    expect(estimateSeconds([{ ex: { reps: '10' }, sets: 0 }], 75)).toBe(0);
  });
});

describe('coming back after a break', () => {
  const now = day(2026, 11, 27);

  it('offers to pick up at the week the user left off', () => {
    const offer = comebackOffer([walkOn(day(2026, 11, 6))], '2026-10-01', undefined, now);
    expect(offer).toMatchObject({ daysAway: 21, weekNow: 9, resumeWeek: 6 });
  });

  it('goes back one more week after 4+ weeks away', () => {
    // Last active in week 4, 30 days ago
    const offer = comebackOffer([walkOn(day(2026, 10, 28))], '2026-10-01', undefined, now);
    expect(offer?.resumeWeek).toBe(3);
  });

  it('says nothing after a short break, or once answered', () => {
    expect(comebackOffer([walkOn(day(2026, 11, 20))], '2026-10-01', undefined, now)).toBeNull();
    const offer = comebackOffer([walkOn(day(2026, 11, 6))], '2026-10-01', undefined, now);
    expect(comebackOffer([walkOn(day(2026, 11, 6))], '2026-10-01', offer?.key, now)).toBeNull();
  });

  it('starts at week 1 if the user never logged anything', () => {
    expect(comebackOffer([], '2026-10-01', undefined, now)).toMatchObject({ neverStarted: true, resumeWeek: 1 });
  });

  it('sets a start date that puts today in the chosen week', () => {
    expect(programWeek(startDateForWeek(6, now), now)).toBe(6);
  });
});

describe('posture breaks', () => {
  it('come every 90 minutes inside work hours', () => {
    const times = breakTimes(9, 17).map(t => `${t.hour}:${String(t.minute).padStart(2, '0')}`);
    expect(times).toEqual(['10:30', '12:00', '13:30', '15:00', '16:30']);
  });
});

describe('exerciseHistory', () => {
  it('keeps the best ticked set per workout, oldest first', () => {
    const history = exerciseHistory(
      [
        workoutOn(day(2026, 11, 25), [
          { exerciseId: 'goblet-squat', setIndex: 0, done: true, weightKg: 16, reps: 10 },
          { exerciseId: 'goblet-squat', setIndex: 1, done: true, weightKg: 18, reps: 8 },
          { exerciseId: 'goblet-squat', setIndex: 2, done: false, weightKg: 30, reps: 10 },
        ]),
        workoutOn(day(2026, 11, 23), [{ exerciseId: 'goblet-squat', setIndex: 0, done: true, weightKg: 14, reps: 10 }]),
        workoutOn(day(2026, 11, 24), [{ exerciseId: 'one-arm-row', setIndex: 0, done: true, weightKg: 20, reps: 10 }]),
      ],
      'goblet-squat',
    );
    expect(history.map(p => p.weightKg)).toEqual([14, 18]);
  });
});

describe('posture check-ins', () => {
  const check = (y: number, m: number, d: number) => ({ date: day(y, m, d).toISOString(), findings: ['x'] });
  const now = day(2026, 11, 27);

  it('are due 4 weeks after the last check', () => {
    expect(postureCheckDue([check(2026, 10, 30)], undefined, now)).toBe(28);
    expect(postureCheckDue([check(2026, 11, 10)], undefined, now)).toBeNull();
  });

  it("aren't suggested to users who never did one, or while snoozed", () => {
    expect(postureCheckDue([], undefined, now)).toBeNull();
    expect(postureCheckDue([check(2026, 10, 1)], day(2026, 12, 1).toISOString(), now)).toBeNull();
  });
});

describe('own training days', () => {
  // Strength Tue/Thu/Sat, rest Wednesday
  const custom = { strength: [2, 4, 6], rest: 3 };

  it('puts the long walk on the last walk day before the rest day', () => {
    expect(weekText(custom)).toBe('strength Tue/Thu/Sat, walks Fri/Sun, long walk Mon, rest Wed');
    expect(weekText()).toBe('strength Mon/Wed/Fri, walks Tue/Thu, long walk Sat, rest Sun');
  });

  it('drives the week plan and the streak', () => {
    const days = upcomingDays(day(2026, 11, 23), '2026-11-23', 'A', custom);
    expect(days.map(d => d.kind)).toEqual(['longwalk', 'strength', 'rest', 'strength', 'walk', 'strength', 'walk']);
    // Mon and Tue logged; Wednesday is the rest day
    const logs = [23, 24].map(d => walkOn(day(2026, 11, d)));
    expect(summary(logs, day(2026, 11, 25), custom).streak).toBe(3);
  });

  it('rejects a week that is not 3 strength days plus a separate rest day', () => {
    expect(weekProblem({ strength: [1, 3], rest: 0 })).toMatch(/3 strength days/);
    expect(weekProblem({ strength: [1, 3, 5], rest: 5 })).toMatch(/rest day/);
    expect(dayKind(day(2026, 11, 23), { strength: [1], rest: 1 })).toBe('strength');
  });
});
