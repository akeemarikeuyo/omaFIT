// The workout plan from "Home Workout Plan: Posture, Physique & Strength".
// Claude's weekly tuning never edits this file; it stores overrides on top of it
// (see src/storage/overrides.ts), so you can always reset to this baseline.

export type SessionId = 'posture' | 'A' | 'B';

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  /** Target per set, e.g. "10", "8-12", "30-45 s" */
  reps: string;
  perSide?: boolean;
  /** true = you log a weight (kg) for it */
  loaded: boolean;
  equipment: string;
  cues: string[];
  /** Exercise id in the free-exercise-db dataset (start/end photos), if there is a close match */
  demoId?: string;
  /** Search terms for a demo, used for exercises swapped in by a weekly review */
  demoSearch?: string[];
  /** Free YouTube Short demonstrating the move, for exercises with no close photo demo */
  videoUrl?: string;
}

export interface Session {
  id: SessionId;
  title: string;
  subtitle: string;
  restSeconds: number;
  exercises: Exercise[];
}

export const POSTURE: Session = {
  id: 'posture',
  title: 'Posture & back routine',
  subtitle: 'Daily, 10-12 min. Also your warm-up on strength days.',
  restSeconds: 20,
  exercises: [
    {
      id: 'cat-cow', name: 'Cat-cow', sets: 1, reps: '8', loaded: false, equipment: 'Mat',
      cues: ['Move slowly, one vertebra at a time', 'Breathe out as you round, in as you arch'],
      demoId: 'Cat_Stretch',
    },
    {
      id: 'chin-tuck', name: 'Chin tucks (5 s hold)', sets: 1, reps: '10', loaded: false, equipment: 'None',
      cues: ['Glide your chin straight back, like making a double chin', 'Eyes stay level, do not tilt up or down'],
      // No close photo demo in the free dataset. Video: Dr. Dawn Thomas Physical Therapy.
      videoUrl: 'https://www.youtube.com/shorts/oO9Zernkbxg',
    },
    {
      id: 'thoracic-ext', name: 'Thoracic extension over bench edge', sets: 1, reps: '8', loaded: false,
      equipment: 'Bench + rolled mat as pad',
      cues: ['Hands behind head', 'Arch the upper back only', 'Keep ribs down, lower back still'],
      // No close photo demo in the free dataset. Video: React Physical Therapy.
      videoUrl: 'https://www.youtube.com/shorts/PCDYP9gpHWk',
    },
    {
      id: 'pec-stretch', name: 'Doorway pec stretch', sets: 1, reps: '30-45 s', perSide: true, loaded: false,
      equipment: 'Doorframe',
      cues: ['Elbow at shoulder height on the frame', 'Step through gently until you feel the chest stretch'],
      demoId: 'Chest_And_Front_Of_Shoulder_Stretch',
    },
    {
      id: 'pull-apart', name: 'Band pull-aparts', sets: 2, reps: '15', loaded: false, equipment: 'Red band',
      cues: ['Arms straight at shoulder height', 'Squeeze shoulder blades down and back', 'No shrugging'],
      demoId: 'Band_Pull_Apart',
    },
    {
      id: 'hip-flexor', name: 'Half-kneeling hip flexor stretch', sets: 1, reps: '30-45 s', perSide: true,
      loaded: false, equipment: 'Mat',
      cues: ['Squeeze the glute of the back leg', 'Tuck the pelvis under', 'Do not arch the lower back'],
      demoId: 'Kneeling_Hip_Flexor',
    },
    {
      id: 'dead-bug', name: 'Dead bug', sets: 2, reps: '8', perSide: true, loaded: false, equipment: 'Mat',
      cues: ['Lower back pressed into the floor the whole time', 'Move slowly, opposite arm and leg'],
      demoId: 'Dead_Bug',
    },
    {
      id: 'bird-dog', name: 'Bird-dog (3 s hold)', sets: 2, reps: '8', perSide: true, loaded: false, equipment: 'Mat',
      cues: ['Hips stay level, like a glass of water on your back', 'Reach long, do not lift high'],
      // No close photo demo in the free dataset. Video: Hinge Health.
      videoUrl: 'https://www.youtube.com/shorts/j-cX-4I-1pQ',
    },
    {
      id: 'glute-bridge', name: 'Glute bridge', sets: 2, reps: '12', loaded: false, equipment: 'Mat',
      cues: ['Drive through your heels', 'Squeeze glutes at the top', 'Do not overarch the lower back'],
      demoId: 'Butt_Lift_Bridge',
    },
  ],
};

export const DAY_A: Session = {
  id: 'A',
  title: 'Strength Day A',
  subtitle: 'Rest 60-90 s. Leave 2-3 reps in the tank.',
  restSeconds: 75,
  exercises: [
    {
      id: 'goblet-squat', name: 'Goblet squat', sets: 3, reps: '10', loaded: true,
      equipment: 'One dumbbell at chest',
      cues: ['Chest up', 'Sit down between your hips', 'Knees track over toes'],
      demoId: 'Goblet_Squat',
    },
    {
      id: 'one-arm-row', name: 'One-arm dumbbell row', sets: 4, reps: '10', perSide: true, loaded: true,
      equipment: 'Dumbbell + bench',
      cues: ['Knee and hand on the bench, flat back', 'Pull your elbow toward your hip', 'Pause at the top'],
      demoId: 'One-Arm_Dumbbell_Row',
    },
    {
      id: 'pushup-bars', name: 'Push-ups on push-up bars', sets: 3, reps: '8-12', loaded: false,
      equipment: 'Push-up bars',
      cues: ['Body in one straight line', 'Elbows about 45 degrees from your body', 'Chest to bar height'],
      demoId: 'Pushups',
    },
    {
      id: 'db-rdl', name: 'Dumbbell Romanian deadlift', sets: 3, reps: '10', loaded: true,
      equipment: 'Two dumbbells',
      cues: ['Hinge at the hips, soft knees', 'Flat back, dumbbells close to legs', 'Stop when hamstrings stretch'],
      demoId: 'Stiff-Legged_Dumbbell_Deadlift',
    },
    {
      id: 'face-pull', name: 'Band face pull', sets: 3, reps: '15', loaded: false,
      equipment: 'Black band on a rack upright at face height',
      cues: ['Pull toward your eyes, elbows high', 'Finish with thumbs pointing back', 'Squeeze the rear shoulders'],
      demoId: 'Face_Pull',
    },
    {
      id: 'leg-curl', name: 'Seated leg curl', sets: 3, reps: '12', loaded: true,
      equipment: 'Bench leg attachment',
      cues: ['Control the weight back up slowly', 'Do not let your hips lift'],
      demoId: 'Seated_Leg_Curl',
    },
    {
      id: 'side-plank', name: 'Side plank', sets: 2, reps: '20-30 s', perSide: true, loaded: false, equipment: 'Mat',
      cues: ['Hips high', 'Head, hips and feet in one line'],
      demoId: 'Side_Bridge',
    },
  ],
};

export const DAY_B: Session = {
  id: 'B',
  title: 'Strength Day B',
  subtitle: 'Rest 60-90 s. Leave 2-3 reps in the tank.',
  restSeconds: 75,
  exercises: [
    {
      id: 'split-squat', name: 'Dumbbell split squat', sets: 3, reps: '8', perSide: true, loaded: true,
      equipment: 'Two dumbbells',
      cues: ['Torso tall', 'Back knee drops straight down', 'Front heel stays down'],
      demoId: 'Split_Squat_with_Dumbbells',
    },
    {
      id: 'chest-supported-row', name: 'Chest-supported dumbbell row', sets: 4, reps: '10', loaded: true,
      equipment: 'Incline bench + dumbbells',
      cues: ['Chest stays on the pad', 'Squeeze shoulder blades together at the top'],
      demoId: 'Dumbbell_Incline_Row',
    },
    {
      id: 'bench-press', name: 'Barbell bench press', sets: 3, reps: '8', loaded: true,
      equipment: 'Barbell + bench rack',
      cues: ['Shoulder blades pinned back', 'Feet flat', 'Bar to lower chest, controlled'],
      demoId: 'Barbell_Bench_Press_-_Medium_Grip',
    },
    {
      id: 'hip-thrust', name: 'Hip thrust', sets: 3, reps: '12', loaded: true,
      equipment: 'Upper back on bench, weight on hips',
      cues: ['Chin tucked, ribs down', 'Squeeze glutes hard at the top', 'Shins vertical at the top'],
      demoId: 'Barbell_Hip_Thrust',
    },
    {
      id: 'hk-press', name: 'Half-kneeling one-arm dumbbell press', sets: 3, reps: '10', perSide: true,
      loaded: true, equipment: 'Dumbbell + mat',
      cues: ['Squeeze the glute of the down knee', 'Ribs down so the lower back does not arch'],
      demoId: 'Dumbbell_One-Arm_Shoulder_Press',
    },
    {
      id: 'rear-delt', name: 'Pull-apart + rear-delt fly superset', sets: 3, reps: '15 each', loaded: true,
      equipment: 'Red band + light dumbbells',
      cues: ['Lead with the elbows', 'No shrugging', 'Light weight, slow tempo'],
      demoId: 'Reverse_Flyes',
    },
    {
      id: 'ab-wheel', name: 'Ab wheel from knees', sets: 3, reps: '6-8', loaded: false, equipment: 'Ab wheel + mat',
      cues: ['Short range at first', 'Stop before the lower back sags', 'Swap for dead bugs if the back complains'],
      demoId: 'Ab_Roller',
    },
    {
      id: 'leg-ext', name: 'Leg extension', sets: 2, reps: '12', loaded: true, equipment: 'Bench leg attachment',
      cues: ['Pause 1 s at the top', 'Lower slowly'],
      demoId: 'Leg_Extensions',
    },
  ],
};

export const SESSIONS: Record<SessionId, Session> = { posture: POSTURE, A: DAY_A, B: DAY_B };

export const WALK_PLAN = [
  { weeks: '1-2', weekday: 'Brisk walk 30 min', saturday: 'Walk 45 min' },
  { weeks: '3-4', weekday: 'Brisk walk 40 min', saturday: 'Walk 60 min' },
  { weeks: '5-6', weekday: 'Run-walk: 1 min jog / 2 min walk x 8', saturday: 'Walk 60 min' },
  { weeks: '7-8', weekday: 'Run-walk: 2 min jog / 1 min walk x 8', saturday: 'Walk 60 min or easy 20 min jog' },
  { weeks: '9+', weekday: 'Easy continuous jog 20-30 min', saturday: 'Long walk or easy jog' },
];

export type DayKind = 'strength' | 'walk' | 'longwalk' | 'rest';

/** Mon/Wed/Fri strength, Tue/Thu walk, Sat long walk, Sun rest. (JS: 0 = Sunday) */
export function dayKind(date: Date): DayKind {
  const d = date.getDay();
  if (d === 1 || d === 3 || d === 5) return 'strength';
  if (d === 2 || d === 4) return 'walk';
  if (d === 6) return 'longwalk';
  return 'rest';
}

export function walkForWeek(programWeek: number) {
  if (programWeek <= 2) return WALK_PLAN[0];
  if (programWeek <= 4) return WALK_PLAN[1];
  if (programWeek <= 6) return WALK_PLAN[2];
  if (programWeek <= 8) return WALK_PLAN[3];
  return WALK_PLAN[4];
}

export const RED_FLAGS =
  'Stop and see a doctor or physiotherapist if you get pain spreading down a leg, numbness or tingling, ' +
  'leg weakness, pain worse at night or not improving after 4-6 weeks, or any bladder or bowel changes.';
