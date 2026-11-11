// Shared types for the stretching and mobility section. This module is
// deliberately independent of the lift tracker's types and storage.

export type Area =
  | 'neck' | 'shoulders' | 'chest' | 'arms' | 'wrists' | 'upper-back'
  | 'lower-back' | 'core' | 'hips' | 'glutes' | 'groin' | 'hamstrings'
  | 'quads' | 'calves' | 'feet';

export type Category = 'static' | 'dynamic' | 'yoga' | 'hold' | 'reps' | 'balance';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type Position = 'standing' | 'chair' | 'seated' | 'kneeling' | 'lying' | 'support';
export type Equipment = 'none' | 'wall' | 'chair' | 'doorway';
export type Space = 'spot' | 'mat' | 'room';
export type Sides = 'both' | 'each' | 'alt';
export type Unit = 'sec' | 'reps';

// Things a person may prefer to avoid. These are preferences that steer
// recommendations; they are not a medical assessment.
export type Caution =
  | 'kneeling' | 'wrists' | 'impact' | 'deep-knee' | 'inversion'
  | 'backbend' | 'balance' | 'neck-load' | 'floor';

export type CatalogGroup =
  | 'neck' | 'shoulders' | 'wrists' | 'spine' | 'hips' | 'hamstrings'
  | 'quads' | 'lower-leg' | 'yoga' | 'dynamic' | 'planks' | 'core' | 'legs';

export interface Exercise {
  id: string;
  name: string;
  aliases: string[];
  group: CatalogGroup;
  desc: string;
  primary: Area[];
  secondary: Area[];
  category: Category;
  difficulty: Difficulty;
  position: Position;
  alsoIn: Position[];    // other positions the movement works in
  equipment: Equipment;
  space: Space;
  sides: Sides;
  unit: Unit;
  dose: number;          // seconds, or repetitions; per side when sides === 'each'
  secPerRep: number;     // used to estimate time for repetition-based doses
  steps: string[];
  breath?: string;
  errors: string[];
  easier: string;
  caution?: string;
  flags: Caution[];
  related: string[];
  alt: string;           // alternative text for the illustration
  demo: { status: 'none' | 'bundled'; path?: string; license?: string };
}

export interface RoutineItem {
  ex: string;            // exercise id
  dose: number;          // seconds or reps (per side where applicable)
  unit?: Unit;           // overrides the exercise default unit
  before?: number;       // transition seconds before this item (override)
}

export type RoutineFamily =
  | 'daily' | 'work' | 'target' | 'posture' | 'prep' | 'recovery'
  | 'flexibility' | 'strength' | 'mixed';

export interface Routine {
  id: string;
  name: string;
  purpose: string;
  family: RoutineFamily;
  difficulty: Difficulty;
  items: RoutineItem[];
  custom?: boolean;
  cover?: { color: string; ex?: string; image?: string };
  timeOfDay?: 'morning' | 'midday' | 'evening';
  createdAt?: string;
  updatedAt?: string;
  generated?: boolean;
}

export interface SeriesDay { routine: string | null; label?: string }
export interface Series {
  id: string;
  name: string;
  purpose: string;
  difficulty: Difficulty;
  days: SeriesDay[];
}

export interface ActiveSeries {
  seriesId: string;
  startedAt: string;                    // ISO timestamp
  days: { date: string; routine: string | null; sessionId?: string }[];
}

export interface SessionItemResult {
  ex: string;
  status: 'completed' | 'partial' | 'skipped';
  activeSec: number;
}

export interface SessionRecord {
  id: string;
  routineId: string | null;
  routineName: string;
  startedAt: string;     // ISO timestamp (UTC instant)
  endedAt: string;
  dateKey: string;       // local calendar date at the time it was recorded
  tz: string;            // timezone used to derive dateKey
  activeSec: number;
  completed: number;
  skipped: number;
  total: number;
  items: SessionItemResult[];
  note?: string;
  effort?: number;       // 1-5 self-reported difficulty
  source: 'session' | 'manual';
  edited?: boolean;
  repair?: boolean;      // manual entry added specifically to mend a streak
}

export interface Reminder {
  id: string;
  title: string;
  time: string;          // HH:MM, local
  days: number[];        // 0 = Monday .. 6 = Sunday
  enabled: boolean;
  routineId?: string;
}

export interface Goal {
  kind: 'none' | 'sessions-week' | 'days-month';
  target: number;
}

export interface Settings {
  appearance: 'system' | 'light' | 'dark';
  textSize: 'normal' | 'large' | 'larger';
  reduceMotion: 'system' | 'on';
  sounds: boolean;
  speakNames: boolean;
  speakSides: boolean;
  volume: number;        // 0..1
  prepSec: number;
  transitionSec: number;
  switchSec: number;
  pauseOnInfo: boolean;
  keepAwake: boolean;
  level: Difficulty;
  cautions: Caution[];
  timezone: string;      // 'auto' or an IANA name
  scheduleDays: number[];// weekdays (0 = Monday) the person intends to practice
  dayThresholdMin: number;
  showGauge: boolean;
  goal: Goal;
  streakReminder: boolean;
  streakReminderTime: string;
  quietStart: string;
  quietEnd: string;
  quietEnabled: boolean;
  notifications: boolean;
  backupReminder: boolean;
  lastBackupAt?: string;
  firstUseDate?: string;
  lastSection?: 'tracker' | 'mobility';
}

export interface MobilityState {
  schema: number;
  settings: Settings;
  customRoutines: Routine[];
  favorites: { routines: string[]; exercises: string[] };
  history: SessionRecord[];
  reminders: Reminder[];
  series: ActiveSeries | null;
  recent: string[];      // routine ids, most recent first
  fired: Record<string, string>; // reminder id -> date key it last fired on
}
