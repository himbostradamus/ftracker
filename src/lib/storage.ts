import { ActivityId, ExerciseConfig, LiftData, NutritionProfile, WeightEntry, DaySchedule } from '../types';
import { ACTIVITY_REGISTRY, STOCK_DEFAULTS } from '../constants';
import { getWeekId } from './helpers';

const SK = "workout-tracker-v6";
const CK = "exercise-config-v1";
const NK = "nutrition-v1";
const WK = "weight-log-v1";

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

export function getLift(day: number, exName: string, weekId: string): LiftData {
  const data = loadData();
  const key = `lift-${weekId}-${day}-${exName}`;
  const d = data[key];
  const def = getDef(exName);
  
  if (d && d.grid && d.grid.length === def.sets && d.grid[0]?.length === def.reps) return d;
  
  // Build or rebuild grid
  let lastW = def.w;
  // Try to find last weight in previous weeks
  const today = new Date();
  for (let off = 1; off <= 12; off++) {
    const past = new Date(today);
    past.setDate(past.getDate() - off * 7);
    const prevWk = getWeekId(past);
    for (let dy = 6; dy >= 0; dy--) {
      const pk = `lift-${prevWk}-${dy}-${exName}`;
      if (data[pk] && data[pk].weight > 0) {
        lastW = data[pk].weight;
        off = 99;
        break;
      }
    }
  }
  
  const grid: boolean[][] = [];
  for (let s = 0; s < def.sets; s++) grid.push(new Array(def.reps).fill(false));
  
  if (d && d.grid) {
    for (let s = 0; s < Math.min(d.grid.length, def.sets); s++)
      for (let r = 0; r < Math.min(d.grid[s].length, def.reps); r++)
        grid[s][r] = d.grid[s][r];
  }
  
  return { weight: d ? d.weight : lastW, grid, skipped: d?.skipped };
}

// Matches lift keys of form `lift-YYYY-Www-d-<exName>`. The exercise name capture
// uses a greedy `(.+)$` so it correctly preserves spaces, hyphens, etc.
const LIFT_KEY_RE = /^lift-(\d{4}-W\d{2})-(\d)-(.+)$/;

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


