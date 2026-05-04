import { ExerciseConfig, NutritionProfile, DaySchedule } from '../types';
import { LIFT_ROTATION } from '../constants';

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

export function getWeekTemplate(wid: string, data: any): DaySchedule[] {
  const wn = parseInt(wid.split("-W")[1], 10);
  const base: DaySchedule[] = [
    { day: 0, items: [{ type: 'lift', liftType: 'Legs' }, { type: 'hiit' }] },
    { day: 1, items: [{ type: 'lift', liftType: 'Push' }, { type: 'run' }] },
    { day: 2, items: [{ type: 'lift', liftType: 'Legs' }, { type: 'hiit' }] },
    { day: 3, items: [{ type: 'lift', liftType: 'Push' }, { type: 'run' }] },
    { day: 4, items: [{ type: 'lift', liftType: 'Pull' }, { type: 'hiit' }] },
    { day: 5, items: [{ type: 'run' }] },
    { day: 6, items: [{ type: 'walk' }] }
  ];
  
  if (wn % 2 === 0) {
    base[4].items = base[4].items.map(i => i.type === 'hiit' ? { type: 'core' } : i);
  } else {
    base[5].items = [{ type: 'core' }];
  }

  const currentLifts = LIFT_ROTATION[getRotationIndex(wn)].lifts;
  const customLifts = data[`week-lifts-${wid}`];
  
  if (customLifts) {
    // If we have any custom lift assignment for this week, apply it.
    base.forEach(s => {
      // Remove any existing lift items from this day
      s.items = s.items.filter(i => i.type !== 'lift');
      
      const customVal = customLifts[s.day];
      if (customVal && customVal !== 'None') {
        s.items.unshift({ type: 'lift', liftType: customVal as any });
      }
    });
  } else {
    // Apply default lifting rotation correctly
    let liftIdx = 0;
    base.forEach(s => {
      s.items.forEach(item => {
        if (item.type === 'lift') {
          item.liftType = currentLifts[liftIdx] as any;
          liftIdx++;
        }
      });
    });
  }
  
  return base;
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
