import { Area, Category, Caution, Difficulty, Equipment, Exercise, Position, Routine, RoutineItem } from '../types';
import { EXERCISES } from '../data/catalog';
import { routineTotals, TimingOpts } from './timeline';
import { hash } from '../art/Figure';

// Rule-based routine planner. It reads a plain request, turns it into
// explicit constraints, and builds a sequence from the catalog. It never
// invents exercises and never relaxes a constraint without saying so.

export type MoveType = 'stretch' | 'mobility' | 'strength' | 'yoga' | 'balance';
export const TYPE_CATS: Record<MoveType, Category[]> = {
  stretch: ['static', 'yoga'], mobility: ['dynamic'], strength: ['hold', 'reps'], yoga: ['yoga'], balance: ['balance', 'hold'],
};

export interface Constraints {
  minutes: number;
  level: Difficulty;
  positions: Position[];      // empty = any
  areas: Area[];              // empty = whole body
  types: MoveType[];          // empty = any
  equipment: Equipment[];     // equipment that is available (besides none)
  exclude: string[];          // exercise ids
  cautions: Caution[];
}

export interface Parsed { patch: Partial<Constraints>; understood: string[]; unknown: string[] }

const NUM: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, ten: 10, twelve: 12,
  fifteen: 15, twenty: 20, 'twenty-five': 25, thirty: 30,
};

const AREA_WORDS: [RegExp, Area[], string][] = [
  [/\bneck\b/, ['neck'], 'neck'],
  [/\bshoulders?\b/, ['shoulders'], 'shoulders'],
  [/\b(chest|pecs?)\b/, ['chest'], 'chest'],
  [/\b(arms?|triceps?|biceps?)\b/, ['arms'], 'arms'],
  [/\b(wrists?|forearms?|hands?)\b/, ['wrists'], 'wrists'],
  [/\b(upper back|mid back|thoracic|shoulder blades?)\b/, ['upper-back'], 'upper back'],
  [/\b(lower back|low back|lumbar)\b/, ['lower-back'], 'lower back'],
  [/\bback\b/, ['lower-back', 'upper-back'], 'back'],
  [/\b(core|abs|abdominals?|trunk)\b/, ['core'], 'core'],
  [/\bhips?\b|\bhip flexors?\b/, ['hips'], 'hips'],
  [/\b(glutes?|butt|piriformis)\b/, ['glutes'], 'glutes'],
  [/\b(groin|inner thighs?|adductors?)\b/, ['groin'], 'inner thighs'],
  [/\b(hamstrings?|hammies)\b/, ['hamstrings'], 'hamstrings'],
  [/\b(quads?|quadriceps|thighs?)\b/, ['quads'], 'quads'],
  [/\b(calves|calf|achilles)\b/, ['calves'], 'calves'],
  [/\b(feet|foot|ankles?|toes?|shins?)\b/, ['feet'], 'feet and ankles'],
  [/\blegs?\b|\blower body\b/, ['hamstrings', 'quads', 'calves', 'hips'], 'legs'],
  [/\bupper body\b/, ['shoulders', 'chest', 'upper-back', 'neck'], 'upper body'],
];

const AVOID = /\b(avoid|no|without|skip|not|don'?t)\b[\w\s-]{0,24}?/;
const avoid = (word: string) => new RegExp(AVOID.source + word, 'i');

export function parseRequest(text: string): Parsed {
  const t = ` ${text.toLowerCase().replace(/[.,;!?]/g, ' ')} `;
  const patch: Partial<Constraints> = {};
  const understood: string[] = [];
  let rest = t;
  const take = (re: RegExp) => { const m = rest.match(re); if (m) rest = rest.replace(re, ' '); return m; };

  // Duration
  let m = take(/(\d{1,3})\s*-?\s*(min(ute)?s?|m)\b/);
  if (m) patch.minutes = Number(m[1]);
  else {
    m = take(new RegExp(`\\b(${Object.keys(NUM).join('|')})\\s*-?\\s*min(ute)?s?\\b`));
    if (m) patch.minutes = NUM[m[1]];
    else if (take(/\b(quick|short|brief)\b/)) patch.minutes = 5;
    else if (take(/\b(long|thorough|extended)\b/)) patch.minutes = 20;
  }
  if (patch.minutes !== undefined) {
    patch.minutes = Math.min(45, Math.max(2, patch.minutes));
    understood.push(`${patch.minutes} minutes`);
  }

  // Avoidances first, so "avoid kneeling" is not read as a wish to kneel.
  const cautions: Caution[] = [];
  const caution = (re: RegExp, c: Caution, label: string) => { if (take(re)) { cautions.push(c); understood.push(label); } };
  caution(avoid('(kneel(ing)?|knees? down)'), 'kneeling', 'no kneeling');
  caution(avoid('(floor|ground|mat|lying)'), 'floor', 'no floor work');
  caution(/\bfloor-?free\b/, 'floor', 'no floor work');
  caution(avoid('(jump(ing|s)?|impact|running on the spot)'), 'impact', 'no jumping');
  caution(/\b(quiet|low-?impact)\b/, 'impact', 'no jumping');
  caution(avoid('(wrists?|hands on the floor|planks?)'), 'wrists', 'no weight on the wrists');
  caution(avoid('(deep knee|squat(s|ting)?|deep squats?)'), 'deep-knee', 'no deep knee bending');
  caution(avoid('(inversions?|upside[- ]down|head below)'), 'inversion', 'no inversions');
  caution(avoid('(back ?bends?|arching)'), 'backbend', 'no backbends');
  caution(avoid('(balanc(e|ing)|one leg|single[- ]leg)'), 'balance', 'no balancing');
  if (cautions.length) patch.cautions = cautions;
  if (take(avoid('(equipment|props?|wall|chair)'))) { patch.equipment = []; understood.push('no equipment'); }

  // Level
  if (take(/\b(beginner|gentle|easy|basic|novice)\b/)) { patch.level = 'beginner'; understood.push('beginner'); }
  else if (take(/\b(intermediate|moderate)\b/)) { patch.level = 'intermediate'; understood.push('intermediate'); }
  else if (take(/\b(advanced|hard|challenging|intense)\b/)) { patch.level = 'advanced'; understood.push('advanced'); }

  // Position
  const positions: Position[] = [];
  if (take(/\b(seated|sitting|chair|desk|office|car|driv(e|ing)|plane|flight)\b/)) { positions.push('chair'); understood.push('seated on a chair'); }
  if (take(/\b(standing|stand(-| )up|on my feet|upright)\b/)) { positions.push('standing'); understood.push('standing'); }
  if (take(/\b(in bed|lying|lie down|on my back|supine)\b/)) { positions.push('lying'); understood.push('lying down'); }
  if (take(/\b(floor|mat)\b/)) { positions.push('seated', 'kneeling', 'lying', 'support'); understood.push('on the floor'); }
  if (positions.length) patch.positions = [...new Set(positions)];

  // Movement type and purpose
  const types: MoveType[] = [];
  if (take(/\b(warm[- ]?up|dynamic|mobility|mobili[sz]e|loosen|before (a |my )?(walk(ing)?|run(ning)?|workout|training|sport|gym|hike|ride))\b/)) { types.push('mobility'); understood.push('dynamic mobility'); }
  if (take(/\b(strength(en(ing)?)?|strong|workout|planks?|holds?|tone)\b/)) { types.push('strength'); understood.push('strength'); }
  if (take(/\b(yoga)\b/)) { types.push('yoga'); understood.push('yoga positions'); }
  if (take(/\b(balance|stability)\b/)) { types.push('balance'); understood.push('balance'); }
  if (take(/\b(stretch(es|ing)?|flexibility|cool[- ]?down|relax(ing|ation)?|wind[- ]?down|unwind|bed(time)?|sleep|recovery|after (a |my )?(long )?(walk|run|workout|ride|drive|flight|day))\b/)) { types.push('stretch'); understood.push('stretching'); }
  if (types.length) patch.types = [...new Set(types)];

  // Areas
  const areas: Area[] = [];
  for (const [re, as, label] of AREA_WORDS) {
    if (take(re)) { areas.push(...as); understood.push(label); }
  }
  if (take(/\b(full[- ]?body|whole body|everything|all over)\b/)) understood.push('whole body');
  if (take(/\b(posture)\b/)) { areas.push('neck', 'chest', 'upper-back', 'core'); understood.push('posture'); }
  if (areas.length) patch.areas = [...new Set(areas)];

  const filler = new Set(['a', 'an', 'the', 'of', 'for', 'my', 'me', 'i', 'to', 'and', 'with', 'some', 'please', 'routine', 'session', 'want', 'need', 'give', 'make', 'on', 'in', 'at', 'after', 'before', 'that', 'is', 'are', 'tight', 'stiff', 'sore', 'minutes', 'minute', 'min', 'do', 'can', 'you', 'just', 'something', 'only', 'but', 'so', 'it', 'long', 'day', 'work', 'from', 'up', 'feel', 'feeling', 'get', 'help', 'bit', 'little', 'really', 'very', 'while', 'when', 'or', 'not', 'no', 'avoid', 'without', 'focus', 'focused', 'mostly', 'mainly', 'more', 'like', 'would', 'about']);
  const unknown = rest.split(/\s+/).filter(w => w.length > 2 && !filler.has(w) && !/^\d+$/.test(w));
  return { patch, understood, unknown: [...new Set(unknown)] };
}

const LEVEL_RANK: Record<Difficulty, number> = { beginner: 0, intermediate: 1, advanced: 2 };
// Order that avoids needless standing-to-floor changes.
const POS_RANK: Record<Position, number> = { standing: 0, chair: 1, kneeling: 2, support: 3, seated: 4, lying: 5 };
const AREA_RANK: Area[] = ['neck', 'shoulders', 'chest', 'arms', 'wrists', 'upper-back', 'core', 'lower-back', 'hips', 'glutes', 'groin', 'quads', 'hamstrings', 'calves', 'feet'];

type Filter = { name: string; label: string; adjust: string; test: (e: Exercise, c: Constraints) => boolean };
const FILTERS: Filter[] = [
  { name: 'level', label: 'difficulty level', adjust: 'allow a higher difficulty level',
    test: (e, c) => LEVEL_RANK[e.difficulty] <= LEVEL_RANK[c.level] },
  { name: 'positions', label: 'position', adjust: 'allow more positions',
    test: (e, c) => !c.positions.length || c.positions.includes(e.position) || e.alsoIn.some(p => c.positions.includes(p)) },
  { name: 'equipment', label: 'available equipment', adjust: 'allow a wall or a chair',
    test: (e, c) => e.equipment === 'none' || c.equipment.includes(e.equipment) || (e.equipment === 'chair' && e.position === 'chair' && c.positions.includes('chair')) },
  { name: 'cautions', label: 'things to avoid', adjust: 'remove one of the avoid preferences',
    test: (e, c) => !e.flags.some(f => c.cautions.includes(f)) },
  { name: 'types', label: 'movement type', adjust: 'allow other movement types',
    test: (e, c) => !c.types.length || c.types.some(t => TYPE_CATS[t].includes(e.category)) },
  { name: 'areas', label: 'body areas', adjust: 'add another body area',
    test: (e, c) => !c.areas.length || e.primary.some(a => c.areas.includes(a)) },
  { name: 'exclude', label: 'excluded movements', adjust: 'exclude fewer movements',
    test: (e, c) => !c.exclude.includes(e.id) },
];

export function eligible(c: Constraints, skip?: string): Exercise[] {
  return EXERCISES.filter(e => FILTERS.every(f => f.name === skip || f.test(e, c)));
}

export interface PlanResult {
  routine: Routine | null;
  notes: string[];          // plain statements about how the request was met
  problem?: string;         // why no routine could be built
  suggestion?: string;      // one specific adjustment
  eligibleCount: number;
}

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

export function planRoutine(c: Constraints, timing: TimingOpts, seed = 0): PlanResult {
  const pool = eligible(c);
  if (pool.length === 0) {
    // Find the single constraint whose removal would help the most.
    const best = FILTERS.map(f => ({ f, n: eligible(c, f.name).length })).sort((a, b) => b.n - a.n)[0];
    const problem = best.n > 0
      ? `No movements match all of these settings. The ${best.f.label} setting is what rules out the rest.`
      : 'No movements match these settings; more than one of them conflicts.';
    return { routine: null, notes: [], problem, suggestion: best.n > 0 ? `Try this: ${best.f.adjust} (${best.n} movements would then match).` : 'Try removing the position or avoid settings first.', eligibleCount: 0 };
  }

  const target = c.minutes * 60;
  const order = (e: Exercise) => hash(`${seed}:${e.id}`);
  const perItem = (e: Exercise) => (e.unit === 'sec' ? e.dose : e.dose * e.secPerRep) * (e.sides === 'each' ? 2 : 1) + timing.transitionSec + (e.sides === 'each' ? timing.switchSec : 0);

  // Take turns between requested areas (or all areas) so the result is balanced.
  const wanted = c.areas.length ? c.areas : AREA_RANK;
  const buckets = wanted.map(a => pool.filter(e => e.primary[0] === a || (c.areas.length > 0 && e.primary.includes(a))).sort((x, y) => order(x) - order(y)));
  const chosen: Exercise[] = [];
  let est = timing.prepSec;
  let guard = 0;
  while (est < target && guard++ < 400) {
    let added = false;
    for (const b of buckets) {
      const e = b.find(x => !chosen.includes(x));
      if (!e) continue;
      if (est + perItem(e) > target * 1.12 && chosen.length >= 2) continue;
      chosen.push(e); est += perItem(e); added = true;
      if (est >= target) break;
    }
    if (!added) break;
  }
  if (chosen.length === 0) chosen.push([...pool].sort((x, y) => order(x) - order(y))[0]);

  // Dynamic movement first, then by position, then head to toe.
  const dyn = (e: Exercise) => (e.category === 'dynamic' ? 0 : e.category === 'hold' || e.category === 'reps' || e.category === 'balance' ? 1 : 2);
  chosen.sort((a, b) => POS_RANK[a.position] - POS_RANK[b.position] || dyn(a) - dyn(b) ||
    AREA_RANK.indexOf(a.primary[0]) - AREA_RANK.indexOf(b.primary[0]) || (a.id < b.id ? -1 : 1));

  // Stretch or shrink the doses to land on the requested time.
  let items: RoutineItem[] = chosen.map(e => ({ ex: e.id, dose: e.dose }));
  const fixed = routineTotals({ items }, timing);
  const overhead = fixed.total - fixed.work;
  const scale = Math.min(2, Math.max(0.6, (target - overhead) / Math.max(1, fixed.work)));
  items = chosen.map(e => ({
    ex: e.id,
    dose: e.unit === 'sec' ? Math.min(240, round5(e.dose * scale)) : Math.max(4, Math.round(e.dose * Math.min(1.5, Math.max(0.7, scale)))),
  }));

  const totals = routineTotals({ items }, timing);
  const notes: string[] = [];
  if (totals.total < target * 0.8) {
    notes.push(`Only ${pool.length} movement${pool.length === 1 ? '' : 's'} match these settings, so this runs about ${Math.round(totals.total / 60)} min instead of ${c.minutes}.`);
  }
  if (totals.estimated) notes.push('Repetition-based movements make the total an estimate.');

  const words: string[] = [`${c.minutes}-minute`];
  if (c.level !== 'beginner') words.push(c.level);
  if (c.positions.length === 1) words.push({ chair: 'seated', standing: 'standing', lying: 'lying', seated: 'floor', kneeling: 'kneeling', support: 'floor' }[c.positions[0]]);
  const areaWord = c.areas.length && c.areas.length <= 2 ? c.areas.map(a => a.replace('-', ' ')).join(' and ') : c.areas.length ? 'mixed' : 'full-body';
  words.push(areaWord);
  words.push(c.types.length === 1 ? { stretch: 'stretch', mobility: 'mobility', strength: 'strength', yoga: 'yoga', balance: 'balance' }[c.types[0]] : 'session');
  const name = words.join(' ').replace(/^./, ch => ch.toUpperCase());

  return {
    routine: {
      id: `gen-${hash(JSON.stringify(c) + seed).toString(36)}`, name, family: 'mixed', difficulty: c.level,
      purpose: 'Built by the rule-based planner from your settings.', items, custom: true, generated: true,
    },
    notes, eligibleCount: pool.length,
  };
}

export function defaultConstraints(level: Difficulty, cautions: Caution[]): Constraints {
  return { minutes: 10, level, positions: [], areas: [], types: [], equipment: ['wall', 'chair', 'doorway'], exclude: [], cautions: [...cautions] };
}
