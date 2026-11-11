import { Exercise, Routine, RoutineItem, Unit } from '../types';
import { EX } from '../data/catalog';

// A routine is flattened into a linear list of timed segments. The player
// only ever walks this list, which keeps pause, skip and recovery simple.

export type SegKind = 'prep' | 'transition' | 'switch' | 'work';
export type Side = 'left' | 'right' | 'both' | 'alternate';

export interface Segment {
  kind: SegKind;
  item: number;       // index into routine.items
  side: Side;
  dur: number;        // seconds
  reps?: number;      // set for repetition-based work
}

export interface TimingOpts { prepSec: number; transitionSec: number; switchSec: number }
export const DEFAULT_TIMING: TimingOpts = { prepSec: 5, transitionSec: 5, switchSec: 4 };

export const unitOf = (item: RoutineItem, ex: Exercise): Unit => item.unit ?? ex.unit;

// Seconds for one side (or the whole movement when it is not per-side).
export function sideSeconds(item: RoutineItem, ex: Exercise): number {
  return unitOf(item, ex) === 'sec' ? item.dose : Math.round(item.dose * ex.secPerRep);
}

export function itemSeconds(item: RoutineItem, ex: Exercise): number {
  return sideSeconds(item, ex) * (ex.sides === 'each' ? 2 : 1);
}

export function buildTimeline(items: RoutineItem[], o: TimingOpts): Segment[] {
  const segs: Segment[] = [];
  items.forEach((item, i) => {
    const ex = EX[item.ex];
    if (!ex) return;
    const lead = i === 0 ? o.prepSec : item.before ?? o.transitionSec;
    if (lead > 0) segs.push({ kind: i === 0 ? 'prep' : 'transition', item: i, side: 'both', dur: lead });
    const dur = sideSeconds(item, ex);
    const reps = unitOf(item, ex) === 'reps' ? item.dose : undefined;
    if (ex.sides === 'each') {
      segs.push({ kind: 'work', item: i, side: 'left', dur, reps });
      if (o.switchSec > 0) segs.push({ kind: 'switch', item: i, side: 'right', dur: o.switchSec });
      segs.push({ kind: 'work', item: i, side: 'right', dur, reps });
    } else {
      segs.push({ kind: 'work', item: i, side: ex.sides === 'alt' ? 'alternate' : 'both', dur, reps });
    }
  });
  return segs;
}

export interface RoutineTotals {
  total: number;       // seconds including preparation, transitions and side changes
  work: number;        // seconds of exercise time
  estimated: boolean;  // true when any item is repetition-based
  count: number;
}

export function routineTotals(routine: Pick<Routine, 'items'>, o: TimingOpts): RoutineTotals {
  const segs = buildTimeline(routine.items, o);
  let total = 0, work = 0;
  for (const s of segs) { total += s.dur; if (s.kind === 'work') work += s.dur; }
  const estimated = routine.items.some(it => EX[it.ex] && unitOf(it, EX[it.ex]) === 'reps');
  return { total, work, estimated, count: routine.items.length };
}

export function doseLabel(item: RoutineItem, ex: Exercise): string {
  const u = unitOf(item, ex);
  const per = ex.sides === 'each' ? ' per side' : '';
  return u === 'sec' ? `${item.dose} sec${per}` : `${item.dose} reps${per}`;
}

export const routineEquipment = (r: Pick<Routine, 'items'>) =>
  [...new Set(r.items.map(i => EX[i.ex]?.equipment).filter(e => e && e !== 'none'))] as string[];

export const routineAreas = (r: Pick<Routine, 'items'>) => {
  const n: Record<string, number> = {};
  for (const it of r.items) for (const a of EX[it.ex]?.primary ?? []) n[a] = (n[a] ?? 0) + 1;
  return Object.entries(n).sort((a, b) => b[1] - a[1]).map(e => e[0]);
};
