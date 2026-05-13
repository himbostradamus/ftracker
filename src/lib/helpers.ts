import { ActivityId, ExerciseConfig, NutritionProfile, DaySchedule, WorkoutItem } from '../types';
import { ACTIVITY_REGISTRY, DEFAULT_DAY_ACTIVITIES, LIFT_ROTATION } from '../constants';

export function getWeekId(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const thu = new Date(d);
  thu.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3);
  const j = new Date(thu.getFullYear(), 0, 1);
  return `${thu.getFullYear()}-W${String(Math.ceil(((thu.getTime() - j.getTime()) / 864e5 + 1) / 7)).padStart(2, "0")}`;
}

// Maps an ISO week number to a 0..2 index into LIFT_ROTATION.
// Week 1 -> index 0 ("WK 1"), week 2 -> index 1 ("WK 2"), week 3 -> index 2 ("WK 3"), etc.
// Display code should use `getRotationIndex(wn) + 1` to show the matching label.
export function getRotationIndex(weekNum: number): number {
  return ((weekNum - 1) % LIFT_ROTATION.length + LIFT_ROTATION.length) % LIFT_ROTATION.length;
}

// Default lift slot per day (5 lift days; Sat/Sun are rest from lifting).
// Indexed by Mon..Sun. `null` means the day has no lift slot in the template.
const DEFAULT_LIFT_DAYS: (number | null)[] = [0, 1, 2, 3, 4, null, null];

// Returns activities scheduled for a given day, applying the week-parity
// swap (Fri HIIT -> Core on even weeks, Sat Run -> Core on odd weeks) that
// the original template encoded.
function getDefaultActivities(day: number, weekNum: number): ActivityId[] {
  const base = [...DEFAULT_DAY_ACTIVITIES[day]];
  if (weekNum % 2 === 0 && day === 4) {
    return base.map(a => a === 'hiit' ? 'core' : a);
  }
  if (weekNum % 2 !== 0 && day === 5) {
    return base.map(a => a === 'run' ? 'core' : a);
  }
  return base;
}

export function getWeekTemplate(wid: string, data: any): DaySchedule[] {
  const wn = parseInt(wid.split("-W")[1], 10);
  const customLifts: Record<number, string> | undefined = data[`week-lifts-${wid}`];
  const customActivities: Record<number, ActivityId[]> | undefined = data[`week-activities-${wid}`];
  const rotationLifts = LIFT_ROTATION[getRotationIndex(wn)].lifts;

  return [0, 1, 2, 3, 4, 5, 6].map(day => {
    const items: WorkoutItem[] = [];

    // 1. Lift slot (if any). Per-week override wins; otherwise fall back to
    //    the default lift-day mapping plus the rotation table.
    let liftType: string | undefined;
    if (customLifts && customLifts[day] !== undefined) {
      const v = customLifts[day];
      if (v && v !== 'None') liftType = v;
    } else {
      const defaultLiftIdx = DEFAULT_LIFT_DAYS[day];
      if (defaultLiftIdx !== null) liftType = rotationLifts[defaultLiftIdx];
    }
    if (liftType) {
      items.push({ type: 'lift', liftType: liftType as any });
    }

    // 2. Other activities. Per-week override wins; otherwise use the seed
    //    in DEFAULT_DAY_ACTIVITIES (with the parity swap applied).
    const activities = customActivities?.[day] ?? getDefaultActivities(day, wn);
    activities.forEach(a => {
      // Skip unknown ids gracefully (e.g. data from an older schema version).
      if (ACTIVITY_REGISTRY[a]) items.push({ type: a });
    });

    return { day, items };
  });
}

export function getMon(date: Date): Date {
  const d = new Date(date);
  const dy = d.getDay();
  d.setDate(d.getDate() - dy + (dy === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Human-readable "how long ago" string for the last-performed indicator.
// Tries to be useful at common ranges: today/yesterday/N days, weeks, months.
export function formatLastPerformed(daysAgo: number, date: Date): string {
  if (daysAgo < 0) return fmtDate(date); // future-dated session, just show date
  if (daysAgo === 0) return "today";
  if (daysAgo === 1) return "yesterday";
  if (daysAgo < 7) return `${daysAgo} days ago`;
  if (daysAgo < 14) return "1 week ago";
  if (daysAgo < 60) return `${Math.floor(daysAgo / 7)} weeks ago`;
  // Past 2 months, switch to date so the user can locate it on a calendar.
  return fmtDate(date);
}

export function calcTDEE(p: NutritionProfile): number {
  let bmr;
  if (p.sex === "m") bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + 5;
  else bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age - 161;
  const mult = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
  return Math.round(bmr * (mult[p.activity] || 1.55));
}

export function calcTarget(p: NutritionProfile) {
  const tdee = calcTDEE(p);
  let cal = tdee;
  if (p.goal === "cut") cal = tdee - 500;
  else if (p.goal === "bulk") cal = tdee + 300;
  cal = Math.max(1200, cal);
  const targetW = p.goal === "maintain" ? p.weight : p.goalWeight;
  const protein = Math.round(targetW * 1);
  const fat = Math.round(cal * 0.25 / 9);
  const carbs = Math.round((cal - protein * 4 - fat * 9) / 4);
  return { tdee, cal, protein, fat, carbs: Math.max(0, carbs) };
}

export function lbToKg(lb: number): number {
  return lb * 0.45359237;
}

export function ftInToCm(ft: number, inches: number): number {
  return (ft * 12 + +inches) * 2.54;
}

export function weightDisplay(w: number, def: ExerciseConfig): string {
  if (def.bw) {
    if (w <= 0) return "BW";
    return `BW+${w}`;
  }
  return `${w}`;
}
