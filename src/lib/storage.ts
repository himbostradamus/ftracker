import { ActivityId, ExerciseConfig, LiftData, NutritionProfile, UIPrefs, WeightEntry, DaySchedule } from '../types';
import { ACTIVITY_REGISTRY, STOCK_DEFAULTS } from '../constants';

const SK = "workout-tracker-v6";
const CK = "exercise-config-v1";
const NK = "nutrition-v1";
const WK = "weight-log-v1";
const UK = "ui-prefs-v1";

export function loadData() {
  return JSON.parse(localStorage.getItem(SK) || "{}");
}

export function saveData(data: any) {
  localStorage.setItem(SK, JSON.stringify(data));
}

export function loadConfigs() {
  return JSON.parse(localStorage.getItem(CK) || "{}");
}

export function saveConfigs(configs: any) {
  localStorage.setItem(CK, JSON.stringify(configs));
}

export function loadNutrProfile(): NutritionProfile | null {
  return JSON.parse(localStorage.getItem(NK) || "null");
}

export function saveNutrProfile(profile: NutritionProfile | null) {
  localStorage.setItem(NK, JSON.stringify(profile));
}

export function loadWeightLog(): WeightEntry[] {
  return JSON.parse(localStorage.getItem(WK) || "[]");
}

export function saveWeightLog(log: WeightEntry[]) {
  localStorage.setItem(WK, JSON.stringify(log));
}

export function loadUIPrefs(): UIPrefs {
  return JSON.parse(localStorage.getItem(UK) || "{}");
}

export function saveUIPrefs(prefs: UIPrefs) {
  localStorage.setItem(UK, JSON.stringify(prefs));
}

export function getDef(name: string): ExerciseConfig {
  const configs = loadConfigs();
  const s = STOCK_DEFAULTS[name] || { sets: 3, reps: 8, w: 0, inc: 5, bw: false, rest: 90 };
  const c = configs[name];
  return c ? { ...s, ...c } : s;
}

// Reads the per-week lift override map (day -> 'Push' | 'Pull' | 'Legs' | 'None'),
// or undefined if the user hasn't customized this week yet.
export function getCustomLifts(data: any, weekId: string): Record<number, string> | undefined {
  return data[`week-lifts-${weekId}`];
}

// Returns a new top-level data object with one day's lift override set.
// On first edit it seeds the override map from the current schedule so the
// non-edited days don't snap back to the rotation default.
export function updateWeekLifts(
  data: any,
  weekId: string,
  sched: DaySchedule[],
  day: number,
  value: string
): any {
  const key = `week-lifts-${weekId}`;
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

export function getCustomActivities(data: any, weekId: string): Record<number, ActivityId[]> | undefined {
  return data[`week-activities-${weekId}`];
}

// Sets a day's activity list (everything except the lift slot). On first
// edit, seeds the full week from the current schedule so that toggling one
// day's activities doesn't reset the others to defaults.
export function updateWeekActivities(
  data: any,
  weekId: string,
  sched: DaySchedule[],
  day: number,
  activities: ActivityId[]
): any {
  const key = `week-activities-${weekId}`;
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

// Matches lift keys of form `lift-YYYY-Www-d-<exName>`. The exercise name capture
// uses a greedy `(.+)$` so it correctly preserves spaces, hyphens, etc.
const LIFT_KEY_RE = /^lift-(\d{4}-W\d{2})-(\d)-(.+)$/;

export interface LastPerformed {
  weekId: string;
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

// Computes the Monday of an ISO week, then offsets by `day` (0..6) to get
// the actual calendar date a session was performed on.
function dateForWeekDay(weekId: string, day: number): Date {
  const m = weekId.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return new Date(NaN);
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  // ISO 8601: week 1 is the week containing Jan 4. The Monday of week 1 is
  // Jan 4 minus the weekday-1 offset (where Mon=1).
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7; // Sun=0 -> 7
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - (jan4Day - 1));
  const target = new Date(week1Monday);
  target.setDate(week1Monday.getDate() + (week - 1) * 7 + day);
  target.setHours(0, 0, 0, 0);
  return target;
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

  let best: { weekId: string; day: number; entry: LiftData; date: Date } | null = null;

  for (const key of Object.keys(data)) {
    if (key === excludeKey) continue;
    const m = key.match(LIFT_KEY_RE);
    if (!m) continue;
    const [, weekId, dayStr, name] = m;
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
    const date = dateForWeekDay(weekId, parseInt(dayStr, 10));
    if (date.getTime() > today.getTime()) continue;
    if (!best || `${weekId}-${dayStr}` > `${best.weekId}-${best.day}`) {
      best = { weekId, day: parseInt(dayStr, 10), entry, date };
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
    weekId: best.weekId,
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

export function getLift(day: number, exName: string, weekId: string): LiftData {
  const data = loadData();
  const key = `lift-${weekId}-${day}-${exName}`;
  const stored = data[key] as LiftData | undefined;
  const def = getDef(exName);

  // Resolve the most recent prior session (if any). Used to carry forward
  // both the prescription and to decide whether to auto-bump weight.
  const last = getLastPerformed(exName, key);

  // Resolve prescription:
  //   1. If this session has been edited and stores its own prescription, use it.
  //   2. Else carry forward last session's prescription.
  //   3. Else fall back to the per-exercise default config.
  const prescribedSets =
    stored?.prescribedSets ?? last?.prescribedSets ?? def.sets;
  const prescribedReps =
    stored?.prescribedReps ?? last?.prescribedReps ?? def.reps;

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
  const results: { weekKey: string; weight: number; completedSets: number; totalSets: number; reps: number; volume: number }[] = [];
  
  Object.keys(data).forEach(key => {
    const m = key.match(LIFT_KEY_RE);
    if (!m) return;
    const [, weekId, day, name] = m;
    if (name !== exName) return;
    const d = data[key];
    if (!d || !d.weight) return;
    
    if (d.grid) {
      const cs = d.grid.filter((row: boolean[]) => row.some(r => r)).length;
      const reps = d.grid.reduce((acc: number, row: boolean[]) => acc + row.filter(r => r).length, 0);
      if (cs > 0) results.push({
        weekKey: `${weekId}-${day}`,
        weight: d.weight,
        completedSets: cs,
        totalSets: d.grid.length,
        reps,
        volume: d.weight * reps
      });
    }
  });
  
  results.sort((a, b) => a.weekKey > b.weekKey ? 1 : a.weekKey < b.weekKey ? -1 : 0);
  return results;
}


