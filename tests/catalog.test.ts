import { describe, expect, it } from 'vitest';
import { EXERCISES, EX } from '../src/mobility/data/catalog';
import { POSES } from '../src/mobility/data/poses';
import { ROUTINES, SERIES, ROUTINE_BY_ID } from '../src/mobility/data/routines';
import { routineTotals, DEFAULT_TIMING } from '../src/mobility/lib/timeline';
import { solve } from '../src/mobility/art/pose';

describe('exercise catalog', () => {
  it('has the 193 required entries with unique ids and names', () => {
    expect(EXERCISES).toHaveLength(193);
    expect(new Set(EXERCISES.map(e => e.id)).size).toBe(193);
    expect(new Set(EXERCISES.map(e => e.name)).size).toBe(193);
  });

  it('matches the group sizes in the specification', () => {
    const n: Record<string, number> = {};
    EXERCISES.forEach(e => (n[e.group] = (n[e.group] ?? 0) + 1));
    expect(n).toEqual({ neck: 10, shoulders: 20, wrists: 3, spine: 12, hips: 22, hamstrings: 11, quads: 5, 'lower-leg': 10, yoga: 12, dynamic: 36, planks: 23, core: 15, legs: 14 });
  });

  it('gives every entry complete content', () => {
    for (const e of EXERCISES) {
      expect(e.desc.length, e.id).toBeGreaterThan(15);
      expect(e.steps.length, e.id).toBeGreaterThanOrEqual(3);
      expect(e.errors.length, e.id).toBeGreaterThanOrEqual(1);
      expect(e.easier.length, e.id).toBeGreaterThan(5);
      expect(e.alt.length, e.id).toBeGreaterThan(20);
      expect(e.primary.length, e.id).toBeGreaterThanOrEqual(1);
      expect(e.aliases.length, e.id).toBeGreaterThanOrEqual(1);
      expect(e.dose, e.id).toBeGreaterThan(0);
      expect(e.related.every(r => EX[r] && r !== e.id), e.id).toBe(true);
    }
  });

  it('has a solvable illustration for every entry and no orphans', () => {
    expect(Object.keys(POSES).sort()).toEqual(EXERCISES.map(e => e.id).sort());
    for (const id of Object.keys(POSES)) {
      const s = solve(POSES[id]);
      for (const p of [s.head, s.pelvis, ...s.armN, ...s.legN]) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y), id).toBe(true);
      }
    }
  });

  it('labels inversions and other advanced movements as advanced', () => {
    for (const id of ['plow', 'shoulder-stand', 'front-split', 'wall-handstand', 'pistol-squat-hold', 'saddle-pose']) {
      expect(EX[id].difficulty, id).toBe('advanced');
    }
  });

  it('keeps the similarly named neck and quad entries distinct', () => {
    expect(EX['neck-flex'].category).toBe('static');
    expect(EX['neck-flexion'].category).toBe('dynamic');
    expect(EX['quad-stretch'].position).toBe('seated');
    expect(EX['lying-quad-stretch'].position).toBe('lying');
    expect(EX['reverse-lunge'].position).toBe('kneeling');
    expect(EX['reverse-lunge'].primary).toContain('hamstrings');
  });
});

describe('prepared routines', () => {
  it('offers roughly one hundred routines with unique ids, names and sequences', () => {
    expect(ROUTINES.length).toBeGreaterThanOrEqual(95);
    expect(new Set(ROUTINES.map(r => r.id)).size).toBe(ROUTINES.length);
    expect(new Set(ROUTINES.map(r => r.name)).size).toBe(ROUTINES.length);
    expect(new Set(ROUTINES.map(r => r.items.map(i => `${i.ex}:${i.dose}`).join(' '))).size).toBe(ROUTINES.length);
  });

  it('covers every family', () => {
    const fams = new Set(ROUTINES.map(r => r.family));
    for (const f of ['daily', 'work', 'target', 'posture', 'prep', 'recovery', 'flexibility', 'strength', 'mixed']) expect(fams.has(f as any), f).toBe(true);
  });

  it('never puts a harder movement in an easier routine', () => {
    const rank = { beginner: 0, intermediate: 1, advanced: 2 };
    for (const r of ROUTINES) for (const it of r.items) {
      expect(rank[EX[it.ex].difficulty], `${r.id} / ${it.ex}`).toBeLessThanOrEqual(rank[r.difficulty]);
    }
  });

  it('spans short to long sessions', () => {
    const mins = ROUTINES.map(r => routineTotals(r, DEFAULT_TIMING).total / 60);
    expect(Math.min(...mins)).toBeLessThan(3);
    expect(Math.max(...mins)).toBeGreaterThan(25);
    expect(Math.max(...mins)).toBeLessThan(40);
  });

  it('has seven-day series that reference real routines', () => {
    expect(SERIES.length).toBeGreaterThanOrEqual(6);
    for (const s of SERIES) {
      expect(s.days).toHaveLength(7);
      for (const d of s.days) if (d.routine) expect(ROUTINE_BY_ID[d.routine], `${s.id}/${d.routine}`).toBeTruthy();
    }
  });
});
