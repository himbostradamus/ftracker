import {
  Area, Category, Caution, CatalogGroup, Difficulty, Equipment, Exercise,
  Position, Sides, Space, Unit,
} from '../../types';

// Compact authoring format for catalog entries. The spec string is
// "category difficulty position[+also] equipment space sides".
export interface Text {
  a?: string[];   // aliases
  d: string;      // short description
  s: string[];    // steps
  b?: string;     // breathing cue
  e: string[];    // common errors
  m: string;      // easier modification
  c?: string;     // caution
  f?: string;     // caution flags, space separated
  r?: string[];   // related exercise ids
  alt: string;    // illustration alternative text
}

const DIFF: Record<string, Difficulty> = { beg: 'beginner', int: 'intermediate', adv: 'advanced' };

export function ex(
  id: string, name: string, group: CatalogGroup, spec: string, areas: string, dose: string, t: Text,
): Exercise {
  const [category, diff, pos, equipment, space, sides] = spec.split(' ');
  const [position, ...alsoIn] = pos.split('+') as Position[];
  const [primary, secondary = ''] = areas.split('|');
  const m = dose.match(/^(\d+)(s|r)(?:@(\d+(?:\.\d+)?))?$/);
  if (!m || !DIFF[diff] || !sides) throw new Error(`Bad catalog entry: ${id}`);
  const flags = (t.f ? t.f.split(' ') : []) as Caution[];
  if (position !== 'standing' && position !== 'chair' && !flags.includes('floor')) flags.push('floor');
  return {
    id, name, group, aliases: t.a ?? [], desc: t.d,
    primary: primary.split(',').filter(Boolean) as Area[],
    secondary: secondary.split(',').filter(Boolean) as Area[],
    category: category as Category, difficulty: DIFF[diff],
    position, alsoIn, equipment: equipment as Equipment, space: space as Space,
    sides: sides as Sides, unit: (m[2] === 's' ? 'sec' : 'reps') as Unit,
    dose: Number(m[1]), secPerRep: m[3] ? Number(m[3]) : 3,
    steps: t.s, breath: t.b, errors: t.e, easier: t.m, caution: t.c,
    flags, related: t.r ?? [], alt: t.alt, demo: { status: 'none' },
  };
}
