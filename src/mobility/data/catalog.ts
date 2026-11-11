import { Exercise, CatalogGroup } from '../types';
import { NECK } from './exercises/neck';
import { SHOULDERS, WRISTS } from './exercises/shoulders';
import { SPINE } from './exercises/spine';
import { HIPS } from './exercises/hips';
import { HAMSTRINGS, QUADS, LOWER_LEG, YOGA } from './exercises/lower';
import { DYNAMIC } from './exercises/dynamic';
import { PLANKS, CORE, LEGS } from './exercises/strength';

export const EXERCISES: Exercise[] = [
  ...NECK, ...SHOULDERS, ...WRISTS, ...SPINE, ...HIPS, ...HAMSTRINGS, ...QUADS,
  ...LOWER_LEG, ...YOGA, ...DYNAMIC, ...PLANKS, ...CORE, ...LEGS,
];

export const EX: Record<string, Exercise> = Object.fromEntries(EXERCISES.map(e => [e.id, e]));

export const GROUP_LABELS: Record<CatalogGroup, string> = {
  neck: 'Neck',
  shoulders: 'Shoulders, chest and arms',
  wrists: 'Wrists and forearms',
  spine: 'Spine, trunk and rotation',
  hips: 'Hips, glutes, groin and splits',
  hamstrings: 'Hamstrings and forward folds',
  quads: 'Quadriceps',
  'lower-leg': 'Calves, shins, feet and ankles',
  yoga: 'Yoga, backbends and floor positions',
  dynamic: 'Dynamic mobility and warm-ups',
  planks: 'Planks and upper-body holds',
  core: 'Core, back and glute strength',
  legs: 'Leg strength and balance',
};

// Related movements default to the closest entries by shared target area and
// group, unless an entry lists its own.
for (const e of EXERCISES) {
  if (e.related.length) continue;
  const score = (o: Exercise) =>
    (o.group === e.group ? 2 : 0) +
    o.primary.filter(a => e.primary.includes(a)).length * 2 +
    o.secondary.filter(a => e.primary.includes(a)).length +
    (o.position === e.position ? 1 : 0) + (o.category === e.category ? 1 : 0);
  e.related = EXERCISES.filter(o => o.id !== e.id)
    .map(o => [score(o), o.id] as const)
    .sort((a, b) => b[0] - a[0] || (a[1] < b[1] ? -1 : 1))
    .slice(0, 4).map(x => x[1]);
}
