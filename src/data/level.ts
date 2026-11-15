// Training level, set by the user in Settings. It tells the AI how hard and long to make the plan, and which library
// difficulty it may use. Based on common strength-training guidance (e.g. ACSM's progression position stand):
// novices start with fewer sets, moderate loads (8-12+ reps) and 2-3 strength days; more experienced people handle
// more volume and progress further. Expert-level library exercises stay blocked at every level (see rejectReason).
import type { Settings } from '../storage/store';

export type TrainingLevel = 'beginner' | 'intermediate' | 'advanced';

export const DEFAULT_LEVEL: TrainingLevel = 'beginner';

export interface LevelInfo {
  id: TrainingLevel;
  label: string;
  /** Shown in Settings so users can pick honestly */
  who: string;
  /** Library difficulties the AI may pick from at this level */
  libraryLevels: string[];
  /** Plan guidance for the AI */
  aiGuide: string;
}

export const LEVELS: LevelInfo[] = [
  {
    id: 'beginner',
    label: 'Beginner',
    who: 'New to working out, or back after a long break (less than about 6 months of regular training).',
    libraryLevels: ['beginner'],
    aiGuide:
      'BEGINNER: new to training or returning after a long break. Keep strength sessions to about 30-40 minutes with ' +
      '2-3 sets per exercise, moderate effort (8-15 reps, 2-3 reps left in the tank). Teach the basic patterns first. ' +
      'Progress slowly: reps before load, small load steps. Walks before running.',
  },
  {
    id: 'intermediate',
    label: 'Intermediate',
    who: 'Training regularly for 6 months or more and comfortable with the basic moves.',
    libraryLevels: ['beginner', 'intermediate'],
    aiGuide:
      'INTERMEDIATE: trains regularly (6+ months) and knows the basic moves. Strength sessions of about 40-50 minutes, ' +
      '3-4 sets per exercise, 6-12 reps, some variety. Progress load steadily once reps are at the top of the range.',
  },
  {
    id: 'advanced',
    label: 'Advanced',
    who: 'Training consistently for 2+ years and comfortable with heavier loads and more volume.',
    libraryLevels: ['beginner', 'intermediate'],
    aiGuide:
      'ADVANCED: trains consistently (2+ years). Strength sessions of about 50-60 minutes, 3-5 sets per exercise, a mix ' +
      'of heavier (6-8 reps) and lighter work, more variety. The conservative coaching rules still apply in full.',
  },
];

export const levelOf = (s: Settings): TrainingLevel => s.level ?? DEFAULT_LEVEL;
export const levelInfo = (l: TrainingLevel) => LEVELS.find(x => x.id === l) ?? LEVELS[0];
