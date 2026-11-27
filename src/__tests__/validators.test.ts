// validateChanges (weekly review and coach chat) and validateProposal (Build my plan). These are the app's safety
// checks on AI output: a failing test here means a check got looser. Storage starts empty: default settings, the
// baseline plan, no logs.
import { describe, expect, it } from '@jest/globals';
import { validateChanges } from '../api/coach';
import { validateProposal } from '../api/planBuilder';
import { day, workoutOn } from './helpers';

const change = (c: Partial<Parameters<typeof validateChanges>[0][number]>) => ({ exercise_id: 'goblet-squat', reason: 'test', ...c });
const squatAt = (kg: number) => workoutOn(day(2026, 11, 20), [{ exerciseId: 'goblet-squat', setIndex: 0, done: true, weightKg: kg, reps: 10 }]);

describe('validateChanges', () => {
  it('rejects exercises that are not in the plan', async () => {
    const { changes, rejected } = await validateChanges([change({ exercise_id: 'made-up-exercise' })], []);
    expect(changes).toHaveLength(0);
    expect(rejected[0].why).toMatch(/Not an exercise in your plan/);
  });

  it('needs a logged weight before any load change', async () => {
    const { rejected } = await validateChanges([change({ target_weight_kg: 12 })], []);
    expect(rejected[0].why).toMatch(/No logged weight/);
  });

  it('allows up to about 10% + 2.5 kg, and no more', async () => {
    // 16 kg logged: 16 * 1.1 + 2.5 = 20.1 kg
    const ok = await validateChanges([change({ target_weight_kg: 20 })], [squatAt(16)]);
    expect(ok.changes).toHaveLength(1);
    const tooMuch = await validateChanges([change({ target_weight_kg: 21 })], [squatAt(16)]);
    expect(tooMuch.changes).toHaveLength(0);
    expect(tooMuch.rejected[0].why).toMatch(/bigger than the plan allows/);
  });

  it('rejects set counts outside 1 to 5', async () => {
    for (const sets of [0, 6, 2.5]) {
      const { rejected } = await validateChanges([change({ sets })], []);
      expect(rejected[0].why).toMatch(/Sets must be 1 to 5/);
    }
  });

  it('only swaps to library exercises that pass rejectReason', async () => {
    const free = await validateChanges([change({ swap_to: { library_id: 'Something the AI made up', cues: [] } })], []);
    expect(free.rejected[0].why).toMatch(/Not in the exercise library/);
    const banned = await validateChanges([change({ swap_to: { library_id: 'Barbell_Squat', cues: [] } })], []);
    expect(banned.rejected[0].why).toMatch(/Swap blocked/);
  });

  it('takes at most 4 changes', async () => {
    const many = Array.from({ length: 6 }, () => change({ sets: 3 }));
    const { changes } = await validateChanges(many, []);
    expect(changes).toHaveLength(4);
  });
});

describe('validateProposal', () => {
  it('rejects exercises that are not in the library', async () => {
    const { add, rejected } = await validateProposal({
      add: [{ session: 'A', library_id: 'Totally_Real_Exercise', sets: 3, reps: '10' }],
    });
    expect(add).toHaveLength(0);
    expect(rejected[0].why).toMatch(/Not in the exercise library/);
  });

  it("won't let pushing grow past half of pulling", async () => {
    const pushes = ['Dumbbell_Bench_Press', 'Decline_Dumbbell_Bench_Press', 'Dumbbell_Bench_Press_with_Neutral_Grip'];
    const { add, rejected } = await validateProposal({
      add: [
        ...pushes.map(library_id => ({ session: 'A', library_id, sets: 5, reps: '10' })),
        ...pushes.map(library_id => ({ session: 'B', library_id, sets: 5, reps: '10' })),
      ],
    });
    expect(rejected.some(r => /pushing/.test(r.why))).toBe(true);
    expect(add.length).toBeLessThan(6);
  });

  it("won't make a session too short", async () => {
    const { remove, rejected } = await validateProposal({
      remove: ['goblet-squat', 'pushup-bars', 'db-rdl', 'leg-curl'].map(exercise_id => ({ exercise_id })),
    });
    expect(remove.length).toBeLessThanOrEqual(2);
    expect(rejected.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects set counts outside 1 to 5', async () => {
    const { adjust, rejected } = await validateProposal({ adjust: [{ exercise_id: 'goblet-squat', sets: 9 }] });
    expect(adjust).toHaveLength(0);
    expect(rejected[0].why).toMatch(/Sets must be 1 to 5/);
  });
});
