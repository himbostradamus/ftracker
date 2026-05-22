import { ActivityId, ActivityMeta, ExerciseConfig } from './types';

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const LIFT_ROTATION = [
  { label: "WK 1", lifts: ["Legs", "Push", "Legs", "Push", "Pull"] },
  { label: "WK 2", lifts: ["Legs", "Pull", "Legs", "Push", "Pull"] },
  { label: "WK 3", lifts: ["Push", "Legs", "Pull", "Push", "Pull"] }
] as const;

export const EXERCISES = {
  Push: ["Incline Bench", "Overhead Press", "Tricep Pushdown", "Pec Fly"],
  Pull: ["Seated Row", "Lat Pulldown", "Deadlift", "Pull Up", "Bicep Curl", "Reverse Pec Fly"],
  Legs: ["Squat", "Leg Press", "Calf Raises", "Hamstring Curl", "Quad Extension"]
} as const;

export const AVAILABLE_EXERCISES = {
  Push: [
    "Standing Barbell Overhead Press",
    "Dumbbell Shoulder Press",
    "Push Press",
    "Close-Grip Bench Press",
    "Weighted Dips",
    "Machine Chest Press",
    "Landmine Press",
    "Arnold Press",
    "Seated Military Press",
    "Dumbbell Incline Press"
  ],
  Pull: [
    "Barbell Row",
    "Dumbbell Row",
    "Chest-Supported Row",
    "T-Bar Row",
    "Face Pull",
    "Cable Row",
    "Straight-Arm Pulldown",
    "Shrug",
    "Hammer Curl",
    "Romanian Deadlift"
  ],
  Legs: [
    "Front Squat",
    "Hack Squat",
    "Bulgarian Split Squat",
    "Walking Lunge",
    "Romanian Deadlift",
    "Hip Thrust",
    "Glute Bridge",
    "Step-Up",
    "Good Morning"
  ]
} as const;

export const DEFAULT_EXERCISE_SETS = 4;
export const DEFAULT_EXERCISE_REPS = 8;

export const STOCK_DEFAULTS: Record<string, ExerciseConfig> = {
  "Incline Bench": { sets: DEFAULT_EXERCISE_SETS, reps: DEFAULT_EXERCISE_REPS, w: 135, inc: 5, bw: false, rest: 90 },
  "Overhead Press": { sets: DEFAULT_EXERCISE_SETS, reps: DEFAULT_EXERCISE_REPS, w: 95, inc: 5, bw: false, rest: 90 },
  "Tricep Pushdown": { sets: DEFAULT_EXERCISE_SETS, reps: DEFAULT_EXERCISE_REPS, w: 40, inc: 5, bw: false, rest: 60 },
  "Pec Fly": { sets: DEFAULT_EXERCISE_SETS, reps: DEFAULT_EXERCISE_REPS, w: 30, inc: 5, bw: false, rest: 60 },
  "Reverse Pec Fly": { sets: DEFAULT_EXERCISE_SETS, reps: DEFAULT_EXERCISE_REPS, w: 25, inc: 5, bw: false, rest: 60 },
  "Seated Row": { sets: DEFAULT_EXERCISE_SETS, reps: DEFAULT_EXERCISE_REPS, w: 120, inc: 5, bw: false, rest: 90 },
  "Lat Pulldown": { sets: DEFAULT_EXERCISE_SETS, reps: DEFAULT_EXERCISE_REPS, w: 100, inc: 5, bw: false, rest: 90 },
  "Deadlift": { sets: DEFAULT_EXERCISE_SETS, reps: DEFAULT_EXERCISE_REPS, w: 185, inc: 10, bw: false, rest: 120 },
  "Pull Up": { sets: DEFAULT_EXERCISE_SETS, reps: DEFAULT_EXERCISE_REPS, w: 0, inc: 5, bw: true, rest: 90 },
  "Bicep Curl": { sets: DEFAULT_EXERCISE_SETS, reps: DEFAULT_EXERCISE_REPS, w: 25, inc: 5, bw: false, rest: 60 },
  "Squat": { sets: DEFAULT_EXERCISE_SETS, reps: DEFAULT_EXERCISE_REPS, w: 185, inc: 10, bw: false, rest: 120 },
  "Calf Raises": { sets: DEFAULT_EXERCISE_SETS, reps: DEFAULT_EXERCISE_REPS, w: 90, inc: 10, bw: false, rest: 60 },
  "Leg Press": { sets: DEFAULT_EXERCISE_SETS, reps: DEFAULT_EXERCISE_REPS, w: 270, inc: 10, bw: false, rest: 90 },
  "Romanian Deadlift": { sets: DEFAULT_EXERCISE_SETS, reps: DEFAULT_EXERCISE_REPS, w: 135, inc: 10, bw: false, rest: 90 },
  "Hamstring Curl": { sets: DEFAULT_EXERCISE_SETS, reps: DEFAULT_EXERCISE_REPS, w: 70, inc: 5, bw: false, rest: 60 },
  "Quad Extension": { sets: DEFAULT_EXERCISE_SETS, reps: DEFAULT_EXERCISE_REPS, w: 70, inc: 5, bw: false, rest: 60 }
};

// Single source of truth for non-lift activities. Each entry's key matches an
// ActivityId in types.ts; ChecklistTab and the ScheduleEditor both read from
// here so adding a new wellness activity is one entry plus a default.
export const ACTIVITY_REGISTRY: Record<ActivityId, ActivityMeta> = {
  run:           { icon: "▸",  color: "#47E8A0", label: "Run / Bike",      kind: 'session' },
  hiit:          { icon: "⚡", color: "#E85C47", label: "HIIT Sprint",     kind: 'session' },
  walk:          { icon: "~",  color: "#47B8E8", label: "75 min Walk",     kind: 'session' },
  core:          { icon: "◉",  color: "#F59E0B", label: "Core",            kind: 'session' },
  "bend-full":   { icon: "○",  color: "#C084FC", label: "Bend – Full Body", kind: 'checkbox' },
  "bend-expert": { icon: "◎",  color: "#C084FC", label: "Bend – Expert",   kind: 'checkbox' },
  meditate:      { icon: "◇",  color: "#A78BFA", label: "Meditate",        kind: 'checkbox' }
};

// Stable order for UI lists (chips in the editor, default scheduling).
export const ACTIVITY_IDS: readonly ActivityId[] = [
  'run', 'hiit', 'walk', 'core', 'bend-full', 'bend-expert', 'meditate'
] as const;

// Default activities per day (Mon..Sun). This drives the schedule when the
// user hasn't customized anything for a given week. Bend-full and meditate
// default to every day to match the previous app behavior; cardio/HIIT
// follow the original rotation by week parity (handled in helpers.ts).
export const DEFAULT_DAY_ACTIVITIES: Record<number, ActivityId[]> = {
  0: ['hiit',    'bend-full', 'meditate'], // Mon
  1: ['run',     'bend-full', 'meditate'], // Tue
  2: ['hiit',    'bend-full', 'meditate'], // Wed
  3: ['run',     'bend-full', 'meditate'], // Thu
  4: ['hiit',    'bend-full', 'meditate'], // Fri (becomes 'core' on even weeks, see helpers)
  5: ['run',     'bend-full', 'meditate'], // Sat (becomes 'core' on odd weeks)
  6: ['walk',    'bend-full', 'meditate']  // Sun
};

// Legacy aliases retained for code that still imports the old names.
// TYPE_META now also includes a 'lift' entry that the ACTIVITY_REGISTRY (which
// only lists non-lift activities) doesn't carry.
export const TYPE_META = {
  lift: { icon: "◆", color: "#E8C547", label: "Lift" },
  ...ACTIVITY_REGISTRY
} as const;

export const DAILY_TASKS = [
  { id: "bend-full",   label: ACTIVITY_REGISTRY['bend-full'].label,   icon: ACTIVITY_REGISTRY['bend-full'].icon,   color: ACTIVITY_REGISTRY['bend-full'].color },
  { id: "bend-expert", label: ACTIVITY_REGISTRY['bend-expert'].label, icon: ACTIVITY_REGISTRY['bend-expert'].icon, color: ACTIVITY_REGISTRY['bend-expert'].color },
  { id: "meditate",    label: ACTIVITY_REGISTRY.meditate.label,       icon: ACTIVITY_REGISTRY.meditate.icon,       color: ACTIVITY_REGISTRY.meditate.color }
] as const;

export const ALL_EX_CATS = [
  { cat: "Push", items: EXERCISES.Push },
  { cat: "Pull", items: EXERCISES.Pull },
  { cat: "Legs", items: EXERCISES.Legs },
  { cat: "Core", items: ["Plank", "Hanging Leg Raise", "Ab Wheel", "Russian Twist", "Dead Bug", "Cable Crunch"] },
  { cat: "Cardio", items: ["Run / Bike", "HIIT Sprint", "Walk"] }
] as const;
