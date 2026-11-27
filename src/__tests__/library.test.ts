// rejectReason: what the AI may pick from the library. These are safety rules: a failing test here means a rule
// got looser.
import { describe, expect, it } from '@jest/globals';
import { findDemo } from '../api/demos';
import { DEFAULT_EQUIPMENT, rejectReason, SKIPPING_ROPE } from '../data/library';

const ex = (id: string) => {
  const e = findDemo(id);
  if (!e) throw new Error(`Test exercise ${id} is not in the library`);
  return e;
};

describe('rejectReason', () => {
  it('blocks barbell squats and deadlifts', () => {
    expect(rejectReason(ex('Barbell_Squat'), 'A', DEFAULT_EQUIPMENT)).toMatch(/squats and deadlifts/);
  });

  it('always blocks expert exercises, at any level', () => {
    for (const level of ['beginner', 'intermediate', 'advanced'] as const) {
      expect(rejectReason(ex('Handstand_Push-Ups'), 'A', DEFAULT_EQUIPMENT, level)).toMatch(/Expert/);
    }
  });

  it('keeps beginners to beginner-level exercises', () => {
    expect(rejectReason(ex('Arnold_Dumbbell_Press'), 'A', DEFAULT_EQUIPMENT, 'beginner')).toMatch(/level/);
    expect(rejectReason(ex('Arnold_Dumbbell_Press'), 'A', DEFAULT_EQUIPMENT, 'intermediate')).toBeNull();
  });

  it("blocks equipment the user doesn't have", () => {
    expect(rejectReason(ex('Butterfly'), 'A', DEFAULT_EQUIPMENT)).toMatch(/isn't in your equipment/);
    expect(rejectReason(ex('Butterfly'), 'A', [...DEFAULT_EQUIPMENT, 'machine'])).toBeNull();
  });

  it('allows the skipping rope only on strength days, and only with a rope', () => {
    expect(rejectReason(ex('Rope_Jumping'), 'A', DEFAULT_EQUIPMENT)).toMatch(/skipping rope/);
    expect(rejectReason(ex('Rope_Jumping'), 'posture', [...DEFAULT_EQUIPMENT, SKIPPING_ROPE])).toMatch(/not the posture/);
    expect(rejectReason(ex('Rope_Jumping'), 'B', [...DEFAULT_EQUIPMENT, SKIPPING_ROPE])).toBeNull();
  });

  it('keeps stretches in the posture routine, not on strength days', () => {
    expect(rejectReason(ex('Arm_Circles'), 'posture', DEFAULT_EQUIPMENT)).toBeNull();
    expect(rejectReason(ex('Arm_Circles'), 'A', DEFAULT_EQUIPMENT)).toMatch(/not used on strength days/);
  });
});
