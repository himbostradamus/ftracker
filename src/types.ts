export interface ExerciseConfig {
  sets: number;
  reps: number;
  w: number;
  inc: number;
  bw: boolean;
  rest: number;
}

export interface LiftData {
  weight: number;
  grid: boolean[][];
  skipped?: boolean;
}

export interface CustomItem {
  id: number;
  label: string;
  done: boolean;
}

// All possible activities a day can contain, except for "lift" which keeps its
// own Push/Pull/Legs sub-type. Adding a new wellness/cardio activity = adding
// an entry here, in ACTIVITY_REGISTRY (constants), and in DEFAULT_DAY_ACTIVITIES.
export type ActivityId =
  | 'run'
  | 'hiit'
  | 'walk'
  | 'core'
  | 'bend-full'
  | 'bend-expert'
  | 'meditate';

export interface ActivityMeta {
  icon: string;
  color: string;
  label: string;
  // Activities marked "checkbox" are completed in-place by tapping them in
  // the day expansion. Activities marked "session" open the WorkoutDetail
  // screen with sets/timer support.
  kind: 'checkbox' | 'session';
}

export interface NutritionProfile {
  sex: 'm' | 'f';
  age: number;
  ft: number;
  inches: number;
  weight: number;
  goalWeight: number;
  startWeight: number;
  activity: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  goal: 'cut' | 'maintain' | 'bulk';
  weightKg: number;
  heightCm: number;
}

export interface WeightEntry {
  date: string;
  weight: number;
}

export interface WorkoutItem {
  type: 'lift' | ActivityId;
  liftType?: 'Push' | 'Pull' | 'Legs' | 'None';
}

export interface DaySchedule {
  day: number;
  items: WorkoutItem[];
}
