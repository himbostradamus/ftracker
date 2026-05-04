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
  type: 'lift' | 'run' | 'hiit' | 'walk' | 'core';
  liftType?: 'Push' | 'Pull' | 'Legs' | 'None';
}

export interface DaySchedule {
  day: number;
  items: WorkoutItem[];
}
