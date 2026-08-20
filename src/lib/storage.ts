import { ActivityId, ExerciseConfig, LiftData, NutritionProfile, UIPrefs, WeightEntry, DaySchedule } from '../types';
import { getWeekKey, getWeekTemplate, getWorkoutItemKey } from './helpers';
import { ACTIVITY_REGISTRY, DEFAULT_EXERCISE_REPS, DEFAULT_EXERCISE_SETS, STOCK_DEFAULTS } from '../constants';

const SK = "workout-tracker-v6";
const CK = "exercise-config-v1";
const NK = "nutrition-v1";
const WK = "weight-log-v1";
const UK = "ui-prefs-v1";

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJSON(key: string, fallback: unknown): unknown {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// Convert the old ISO week-number identity to the Monday date that the week
// actually represents. This runs lazily on first data read after upgrading.
function legacyWeekToDateKey(legacyKey: string): string | null {
  const match = legacyKey.match(/^([0-9]{4})-W([0-9]{2})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const monday = new Date(year, 0, 4 - (jan4Day - 1) + (week - 1) * 7);
  return getWeekKey(monday);
}

function migrateLegacyWeekKeys(data: Record<string, any>): { data: Record<string, any>; changed: boolean } {
  const next = { ...data };
  let changed = false;

  for (const key of Object.keys(data)) {
    const lift = key.match(/^lift-([0-9]{4}-W[0-9]{2})-(.+)$/);
    const schedule = key.match(/^(week-(?:lifts|activities))-([0-9]{4}-W[0-9]{2})$/);
    const checklist = key.match(/^([0-9]{4}-W[0-9]{2})-(.+)$/);

    let convertedKey: string | null = null;
    if (lift) {
      const monday = legacyWeekToDateKey(lift[1]);
      if (monday) convertedKey = `lift-${monday}-${lift[2]}`;
    } else if (schedule) {
      const monday = legacyWeekToDateKey(schedule[2]);
      if (monday) convertedKey = `${schedule[1]}-${monday}`;
    } else if (checklist) {
      const monday = legacyWeekToDateKey(checklist[1]);
      if (monday) convertedKey = `${monday}-${checklist[2]}`;
    }

    if (!convertedKey) continue;
    // If both formats exist, keep the newer date-keyed value. Otherwise move
    // the legacy value, then remove the obsolete week-number key.
    if (!Object.hasOwn(next, convertedKey)) next[convertedKey] = data[key];
    delete next[key];
    changed = true;
  }

  return { data: next, changed };
}

function migrateIndexedWorkoutKeys(data: Record<string, any>): { data: Record<string, any>; changed: boolean } {
  const next = { ...data };
  const schedules = new Map<string, DaySchedule[]>();
  let changed = false;

  for (const key of Object.keys(data)) {
    const match = key.match(/^([0-9]{4}-[0-9]{2}-[0-9]{2})-([0-6])-([0-9]+)(-ex[0-9]+)?$/);
    if (!match) continue;

    const [, weekKey, dayText, itemText, suffix = ""] = match;
    const day = parseInt(dayText, 10);
    const itemIndex = parseInt(itemText, 10);
    let schedule = schedules.get(weekKey);
    if (!schedule) {
      schedule = getWeekTemplate(weekKey, data);
      schedules.set(weekKey, schedule);
    }
    const item = schedule[day]?.items[itemIndex];
    if (!item) continue;

    const convertedKey = `${getWorkoutItemKey(weekKey, day, item)}${suffix}`;
    if (!Object.hasOwn(next, convertedKey)) next[convertedKey] = data[key];
    delete next[key];
    changed = true;
  }

  return { data: next, changed };
}

function migrateWorkoutData(data: Record<string, any>): { data: Record<string, any>; changed: boolean } {
  const legacy = migrateLegacyWeekKeys(data);
  const indexed = migrateIndexedWorkoutKeys(legacy.data);
  return { data: indexed.data, changed: legacy.changed || indexed.changed };
}

export function normalizeWorkoutData(data: Record<string, any>): Record<string, any> {
  return migrateWorkoutData(data).data;
}

export function loadData() {
  const stored = readJSON(SK, {});
  const parsed = isRecord(stored) ? stored : {};
  const migrated = migrateWorkoutData(parsed);
  if (migrated.changed) saveData(migrated.data);
  return migrated.data;
}

export function saveData(data: any) {
  localStorage.setItem(SK, JSON.stringify(data));
}

export function loadConfigs() {
  const stored = readJSON(CK, {});
  return isRecord(stored) ? stored : {};
}

export function saveConfigs(configs: any) {
  localStorage.setItem(CK, JSON.stringify(configs));
}

export function loadNutrProfile(): NutritionProfile | null {
  const stored = readJSON(NK, null);
  return stored === null || isRecord(stored) ? stored as NutritionProfile | null : null;
}

export function saveNutrProfile(profile: NutritionProfile | null) {
  localStorage.setItem(NK, JSON.stringify(profile));
}

export function loadWeightLog(): WeightEntry[] {
  const stored = readJSON(WK, []);
  if (!Array.isArray(stored)) return [];
  return stored.filter((entry): entry is WeightEntry =>
    isRecord(entry) && typeof entry.date === "string" &&
    typeof entry.weight === "number" && Number.isFinite(entry.weight)
  );
}

export function saveWeightLog(log: WeightEntry[]) {
  localStorage.setItem(WK, JSON.stringify(log));
}

export function mergeWeightLogs(current: WeightEntry[], backup: WeightEntry[]): WeightEntry[] {
  const byDate = new Map(current.map(entry => [entry.date, entry]));
  backup.forEach(entry => byDate.set(entry.date, entry));
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function loadUIPrefs(): UIPrefs {
  const stored = readJSON(UK, {});
  return isRecord(stored) ? stored : {};
}

export function saveUIPrefs(prefs: UIPrefs) {
  localStorage.setItem(UK, JSON.stringify(prefs));
}

export function clearAppData() {
  [SK, CK, NK, WK, UK].forEach(key => localStorage.removeItem(key));
}

export function getDef(name: string): ExerciseConfig {
  const configs = loadConfigs();
  const s = STOCK_DEFAULTS[name] || { sets: DEFAULT_EXERCISE_SETS, reps: DEFAULT_EXERCISE_REPS, w: 0, inc: 5, bw: false, rest: 90 };
  const c = configs[name];
  return c ? { ...s, ...c } : s;
}

// Reads the per-week lift override map (day -> 'Push' | 'Pull' | 'Legs' | 'None'),
// or undefined if the user hasn't customized this week yet.
export function getCustomLifts(data: any, weekKey: string): Record<number, string> | undefined {
  return data[`week-lifts-${weekKey}`];
}

// Returns a new top-level data object with one day's lift override set.
// On first edit it seeds the override map from the current schedule so the
// non-edited days don't snap back to the rotation default.
export function updateWeekLifts(
  data: any,
  weekKey: string,
  sched: DaySchedule[],
  day: number,
  value: string
): any {
  const key = `week-lifts-${weekKey}`;
  let customLifts: Record<number, string> = data[key];
  if (!customLifts) {
    customLifts = {};
    sched.forEach(s => {
      const lift = s.items.find(i => i.type === 'lift');
      customLifts[s.day] = lift?.liftType ?? 'None';
    });
  }
  return { ...data, [key]: { ...customLifts, [day]: value } };
}

export function getCustomActivities(data: any, weekKey: string): Record<number, ActivityId[]> | undefined {
  return data[`week-activities-${weekKey}`];
}

// Sets a day's activity list (everything except the lift slot). On first
// edit, seeds the full week from the current schedule so that toggling one
// day's activities doesn't reset the others to defaults.
export function updateWeekActivities(
  data: any,
  weekKey: string,
  sched: DaySchedule[],
  day: number,
  activities: ActivityId[]
): any {
  const key = `week-activities-${weekKey}`;
  let map: Record<number, ActivityId[]> = data[key];
  if (!map) {
    map = {};
    sched.forEach(s => {
      map[s.day] = s.items
        .filter((i): i is { type: ActivityId } => i.type !== 'lift' && (i.type as ActivityId) in ACTIVITY_REGISTRY)
        .map(i => i.type as ActivityId);
    });
  }
  return { ...data, [key]: { ...map, [day]: activities } };
}

// Matches lift keys of form `lift-YYYY-MM-DD-d-<exName>`. The exercise name
// capture is greedy so it correctly preserves spaces, hyphens, etc.
const LIFT_KEY_RE = /^lift-([0-9]{4}-[0-9]{2}-[0-9]{2})-([0-9])-(.+)$/;

export interface LastPerformed {
  weekKey: string;
  day: number;
  date: Date;
  weight: number;
  // Prescription: what the session intended. Pulled from the stored
  // prescribedSets/Reps when present, else inferred from the grid shape.
  prescribedSets: number;
  prescribedReps: number;
  // Performance: what was actually completed.
  completedSets: number;
  reps: number;
  // True when every prescribed rep was checked off. Used to decide whether
  // the next session should auto-bump the weight.
  fullyCleared: boolean;
  daysAgo: number;
}

// Offsets the stored Monday date by `day` (0..6) to get the actual
// calendar date a session was performed on. Parse as local time to avoid UTC
// conversion moving the date backward in western time zones.
function dateForWeekDay(weekKey: string, day: number): Date {
  const match = weekKey.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
  if (!match) return new Date(NaN);

  const date = new Date(
    parseInt(match[1], 10),
    parseInt(match[2], 10) - 1,
    parseInt(match[3], 10) + day
  );
  date.setHours(0, 0, 0, 0);
  return date;
}

// Find the most recent prior session for a given exercise. Used by both the
// weight-defaulting in getLift and the "last performed" indicator in the UI.
// `excludeKey` lets the caller skip the current session while looking up
// what the previous one was.
export function getLastPerformed(exName: string, excludeKey?: string): LastPerformed | null {
  const data = loadData();
  // Use today (local midnight) as the upper bound. Future-dated sessions —
  // which can exist if the user navigates ahead with the week buttons and
  // logs reps there — are excluded from "last performed" lookups so they
  // don't trigger auto-bump or show up in the indicator with a future date.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let best: { weekKey: string; day: number; entry: LiftData; date: Date } | null = null;

  for (const key of Object.keys(data)) {
    if (key === excludeKey) continue;
    const m = key.match(LIFT_KEY_RE);
    if (!m) continue;
    const [, weekKey, dayStr, name] = m;
    if (name !== exName) continue;
    const entry = data[key] as LiftData | undefined;
    // We accept weight === 0 (bodyweight sessions with no added weight) but
    // reject undefined/null/missing weight. Using `typeof !== 'number'` makes
    // the intent explicit; `!entry.weight` would silently drop BW sessions.
    if (!entry || typeof entry.weight !== 'number' || !entry.grid) continue;
    // Only count sessions where at least one rep was logged.
    const hasWork = entry.grid.some(row => row.some(r => r));
    if (!hasWork) continue;
    // Filter out future-dated sessions.
    const date = dateForWeekDay(weekKey, parseInt(dayStr, 10));
    if (date.getTime() > today.getTime()) continue;
    if (!best || `${weekKey}-${dayStr}` > `${best.weekKey}-${best.day}`) {
      best = { weekKey, day: parseInt(dayStr, 10), entry, date };
    }
  }

  if (!best) return null;
  const daysAgo = Math.round((today.getTime() - best.date.getTime()) / 86400000);
  const grid = best.entry.grid;
  const completedSets = grid.filter(row => row.some(r => r)).length;
  const reps = grid.reduce((acc, row) => acc + row.filter(r => r).length, 0);
  const prescribedSets = best.entry.prescribedSets ?? grid.length;
  const prescribedReps = best.entry.prescribedReps ?? (grid[0]?.length ?? 0);
  // Fully cleared = every cell of the prescribed area is checked. We compare
  // against the prescription rather than the grid shape so a session that
  // was logged with a stale grid size is judged correctly. If for some
  // reason the stored grid is smaller than the prescription, that auto-fails.
  let fullyCleared = prescribedSets > 0 && prescribedReps > 0;
  if (fullyCleared) {
    for (let s = 0; s < prescribedSets && fullyCleared; s++) {
      for (let r = 0; r < prescribedReps; r++) {
        if (!grid[s]?.[r]) { fullyCleared = false; break; }
      }
    }
  }
  return {
    weekKey: best.weekKey,
    day: best.day,
    date: best.date,
    weight: best.entry.weight,
    prescribedSets,
    prescribedReps,
    completedSets,
    reps,
    fullyCleared,
    daysAgo
  };
}

export function getLift(day: number, exName: string, weekKey: string): LiftData {
  const data = loadData();
  const key = `lift-${weekKey}-${day}-${exName}`;
  const stored = data[key] as LiftData | undefined;
  const def = getDef(exName);

  // Resolve the most recent prior session (if any). Used to carry forward
  // both the prescription and to decide whether to auto-bump weight.
  const last = getLastPerformed(exName, key);

  // Resolve prescription:
  //   1. If this session stores its own prescription, use it.
  //   2. Else, if this session already has a grid from an older version,
  //      preserve that shape so editing defaults later does not mutate an
  //      in-progress workout.
  //   3. Else fall back to the current per-exercise default config.
  //
  // New sessions intentionally read from today's defaults rather than
  // carrying forward last session's prescription. That keeps auto-progression
  // stable when the user changes their default sets/reps: weight still keys
  // off whether the last session was fully cleared, but the next target size
  // comes from the current config.
  const prescribedSets =
    stored?.prescribedSets ?? stored?.grid?.length ?? def.sets;
  const prescribedReps =
    stored?.prescribedReps ?? stored?.grid?.[0]?.length ?? def.reps;

  // Resolve weight:
  //   - Existing session with a stored weight (including 0 for pure bodyweight): honor it.
  //   - No history: stock default.
  //   - Last fully cleared at weight W and auto-bump enabled for this exercise:
  //     prescribe W + def.inc. For bodyweight exercises this still adds to
  //     the *added* weight, which is the right behavior for weighted dips/pull-ups.
  //   - Last fully cleared but auto-bump disabled: stay at last weight; user
  //     drives progression manually.
  //   - Last under-performed: same weight as last time, deload is a manual choice.
  let weight: number;
  if (stored && typeof stored.weight === 'number') {
    weight = stored.weight;
  } else if (!last) {
    weight = def.w;
  } else if (last.fullyCleared && def.autoBump !== false) {
    weight = last.weight + (def.inc ?? 0);
  } else {
    weight = last.weight;
  }

  // Build (or rebuild) the grid to match the resolved prescription, copying
  // any already-checked cells from a stored partial session into the same
  // positions in the new grid.
  const grid: boolean[][] = [];
  for (let s = 0; s < prescribedSets; s++) {
    grid.push(new Array(prescribedReps).fill(false));
  }
  if (stored?.grid) {
    for (let s = 0; s < Math.min(stored.grid.length, prescribedSets); s++) {
      for (let r = 0; r < Math.min(stored.grid[s].length, prescribedReps); r++) {
        grid[s][r] = stored.grid[s][r];
      }
    }
  }

  return {
    weight,
    grid,
    skipped: stored?.skipped,
    prescribedSets,
    prescribedReps
  };
}

export function getAllHistory(exName: string) {
  const data = loadData();
  const results: { date: Date; weight: number; completedSets: number; totalSets: number; reps: number; volume: number }[] = [];
  
  Object.keys(data).forEach(key => {
    const m = key.match(LIFT_KEY_RE);
    if (!m) return;
    const [, weekKey, day, name] = m;
    if (name !== exName) return;
    const d = data[key];
    // Zero is a valid added weight for bodyweight exercises.
    if (!d || typeof d.weight !== 'number') return;
    
    if (d.grid) {
      const cs = d.grid.filter((row: boolean[]) => row.some(r => r)).length;
      const reps = d.grid.reduce((acc: number, row: boolean[]) => acc + row.filter(r => r).length, 0);
      if (cs > 0) results.push({
        date: dateForWeekDay(weekKey, parseInt(day, 10)),
        weight: d.weight,
        completedSets: cs,
        totalSets: d.grid.length,
        reps,
        volume: d.weight * reps
      });
    }
  });
  
  results.sort((a, b) => a.date.getTime() - b.date.getTime());
  return results;
}

