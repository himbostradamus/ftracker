// Text lookup for the stretching section. English strings are the keys, so
// components stay readable; another language is added by registering a
// dictionary that maps those keys to translations. Only English is shipped,
// and no other language is claimed.
const dictionaries: Record<string, Record<string, string>> = { en: {} };
let active = 'en';

export function registerLocale(code: string, dict: Record<string, string>) { dictionaries[code] = dict; }
export function setLocale(code: string) { if (dictionaries[code]) active = code; }

export function t(text: string, vars?: Record<string, string | number>): string {
  let out = dictionaries[active]?.[text] ?? text;
  if (vars) for (const k of Object.keys(vars)) out = out.split(`{${k}}`).join(String(vars[k]));
  return out;
}

export const plural = (n: number, one: string, many: string) => t(n === 1 ? one : many, { n });

export const AREA_LABEL: Record<string, string> = {
  neck: 'Neck', shoulders: 'Shoulders', chest: 'Chest', arms: 'Arms', wrists: 'Wrists', 'upper-back': 'Upper back',
  'lower-back': 'Lower back', core: 'Core', hips: 'Hips', glutes: 'Glutes', groin: 'Inner thighs',
  hamstrings: 'Hamstrings', quads: 'Quads', calves: 'Calves', feet: 'Feet and ankles',
};
export const CATEGORY_LABEL: Record<string, string> = {
  static: 'Static stretch', dynamic: 'Dynamic mobility', yoga: 'Yoga position', hold: 'Strength hold', reps: 'Strength repetitions', balance: 'Balance',
};
export const DIFFICULTY_LABEL: Record<string, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
export const POSITION_LABEL: Record<string, string> = {
  standing: 'Standing', chair: 'Seated on a chair', seated: 'Seated on the floor', kneeling: 'Kneeling or all fours', lying: 'Lying down', support: 'On hands and feet',
};
export const EQUIPMENT_LABEL: Record<string, string> = { none: 'No equipment', wall: 'Wall', chair: 'Chair', doorway: 'Doorway' };
export const SPACE_LABEL: Record<string, string> = { spot: 'Standing room', mat: 'Mat-sized floor space', room: 'A few steps of open floor' };
export const CAUTION_LABEL: Record<string, string> = {
  kneeling: 'Kneeling', wrists: 'Weight on the wrists', impact: 'Jumping and impact', 'deep-knee': 'Deep knee bending',
  inversion: 'Inversions', backbend: 'Backbends', balance: 'Balancing on one leg', 'neck-load': 'Weight on the neck', floor: 'Getting down on the floor',
};
export const SIDES_LABEL: Record<string, string> = { both: 'Both sides together', each: 'One side at a time', alt: 'Alternating sides' };
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
