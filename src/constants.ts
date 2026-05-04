import { ExerciseConfig } from './types';

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


export const STOCK_DEFAULTS: Record<string, ExerciseConfig> = {
  "Incline Bench": { sets: 4, reps: 8, w: 135, inc: 5, bw: false, rest: 90 },
  "Overhead Press": { sets: 4, reps: 8, w: 95, inc: 5, bw: false, rest: 90 },
  "Tricep Pushdown": { sets: 3, reps: 12, w: 40, inc: 5, bw: false, rest: 60 },
  "Pec Fly": { sets: 3, reps: 12, w: 30, inc: 5, bw: false, rest: 60 },
  "Reverse Pec Fly": { sets: 3, reps: 12, w: 25, inc: 5, bw: false, rest: 60 },
  "Seated Row": { sets: 4, reps: 10, w: 120, inc: 5, bw: false, rest: 90 },
  "Lat Pulldown": { sets: 4, reps: 10, w: 100, inc: 5, bw: false, rest: 90 },
  "Deadlift": { sets: 4, reps: 5, w: 185, inc: 10, bw: false, rest: 120 },
  "Pull Up": { sets: 3, reps: 8, w: 0, inc: 5, bw: true, rest: 90 },
  "Bicep Curl": { sets: 3, reps: 12, w: 25, inc: 5, bw: false, rest: 60 },
  "Squat": { sets: 4, reps: 6, w: 185, inc: 10, bw: false, rest: 120 },
  "Calf Raises": { sets: 4, reps: 15, w: 90, inc: 10, bw: false, rest: 60 },
  "Leg Press": { sets: 4, reps: 10, w: 270, inc: 10, bw: false, rest: 90 },
  "Romanian Deadlift": { sets: 4, reps: 8, w: 135, inc: 10, bw: false, rest: 90 },
  "Hamstring Curl": { sets: 3, reps: 12, w: 70, inc: 5, bw: false, rest: 60 },
  "Quad Extension": { sets: 3, reps: 12, w: 70, inc: 5, bw: false, rest: 60 }
};

export const DAILY_TASKS = [
  { id: "bend-full", label: "Bend – Full Body", icon: "○", color: "#C084FC" },
  { id: "bend-expert", label: "Bend – Expert", icon: "◎", color: "#C084FC" },
  { id: "meditate", label: "Meditate", icon: "◇", color: "#A78BFA" }
] as const;

export const TYPE_META = {
  lift: { icon: "◆", color: "#E8C547", label: "Lift" },
  run: { icon: "▸", color: "#47E8A0", label: "Run / Bike" },
  hiit: { icon: "⚡", color: "#E85C47", label: "HIIT Sprint" },
  walk: { icon: "~", color: "#47B8E8", label: "75 min Walk" },
  core: { icon: "◉", color: "#F59E0B", label: "Core" }
} as const;

export const ALL_EX_CATS = [
  { cat: "Push", items: EXERCISES.Push },
  { cat: "Pull", items: EXERCISES.Pull },
  { cat: "Legs", items: EXERCISES.Legs },
  { cat: "Core", items: ["Plank", "Hanging Leg Raise", "Ab Wheel", "Russian Twist", "Dead Bug", "Cable Crunch"] },
  { cat: "Cardio", items: ["Run / Bike", "HIIT Sprint", "Walk"] }
] as const;

