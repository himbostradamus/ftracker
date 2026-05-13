export interface ExerciseConfig {
  sets: number;
  reps: number;
  w: number;
  inc: number;
  bw: boolean;
  rest: number;
  // Auto-progress weight after a fully-cleared session.
  // Undefined or true = enabled (default). Set to false to opt this exercise
  // out of progressive overload — useful for accessory work where you'd
  // rather control weight by feel than mechanically.
  autoBump?: boolean;
}

export interface LiftData {
  weight: number;
  grid: boolean[][];
  skipped?: boolean;
  // Prescription = what was intended for the session, distinct from what was
  // performed (which is `grid`). Carrying these forward — instead of looking
  // at completed counts — is what prevents an under-performed session from
  // silently lowering future targets. Optional for back-compat with existing
  // localStorage; readers fall back to def.sets/reps and grid.length.
  prescribedSets?: number;
  prescribedReps?: number;
}

export interface CustomItem {
  id: number;
  label: string;
  done: boolean;
}

// Lightweight container for UI-only preferences (visibility toggles, etc).
// Stored separately from workout data so it can be reset without losing logs.
export interface UIPrefs {
  // When true, the Macros/Nutrition tab is hidden from the TabBar. The data
  // itself (profile, weight log) is preserved — flip this back to false and
  // it's all still there.
  hideNutrition?: boolean;
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
