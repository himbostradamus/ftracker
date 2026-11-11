import { describe, expect, it } from 'vitest';
import { Constraints, defaultConstraints, eligible, parseRequest, planRoutine, TYPE_CATS } from '../src/mobility/lib/planner';
import { EX } from '../src/mobility/data/catalog';
import { routineTotals, DEFAULT_TIMING } from '../src/mobility/lib/timeline';

const T = DEFAULT_TIMING;
const C = (patch: Partial<Constraints> = {}): Constraints => ({ ...defaultConstraints('beginner', []), ...patch });
const fromText = (text: string, base = C()) => ({ ...base, ...parseRequest(text).patch });

describe('request parsing', () => {
  it('reads "five minutes seated after a long drive"', () => {
    const p = parseRequest('five minutes seated after a long drive');
    expect(p.patch.minutes).toBe(5);
    expect(p.patch.positions).toEqual(['chair']);
    expect(p.patch.types).toContain('stretch');
  });

  it('reads "ten minutes of beginner hip mobility"', () => {
    const p = parseRequest('ten minutes of beginner hip mobility');
    expect(p.patch).toMatchObject({ minutes: 10, level: 'beginner', areas: ['hips'], types: ['mobility'] });
  });

  it('reads "standing warm-up before walking; avoid kneeling"', () => {
    const p = parseRequest('standing warm-up before walking; avoid kneeling');
    expect(p.patch.positions).toEqual(['standing']);
    expect(p.patch.types).toEqual(['mobility']);
    expect(p.patch.cautions).toEqual(['kneeling']);
  });

  it('treats an avoidance as an avoidance, not a request', () => {
    const p = parseRequest('15 min stretch, no floor work and no jumping');
    expect(p.patch.cautions).toEqual(expect.arrayContaining(['floor', 'impact']));
    expect(p.patch.positions).toBeUndefined();
  });

  it('reports words it did not understand', () => {
    const p = parseRequest('10 minutes for my hips with kettlebells');
    expect(p.unknown).toContain('kettlebells');
    expect(p.understood).toEqual(expect.arrayContaining(['10 minutes', 'hips']));
  });
});

describe('planning', () => {
  const check = (c: Constraints, seed = 0) => {
    const res = planRoutine(c, T, seed);
    expect(res.routine, res.problem).toBeTruthy();
    const rank = { beginner: 0, intermediate: 1, advanced: 2 };
    for (const it of res.routine!.items) {
      const e = EX[it.ex];
      expect(e, it.ex).toBeTruthy();                                   // never invents ids
      expect(rank[e.difficulty]).toBeLessThanOrEqual(rank[c.level]);   // difficulty
      if (c.positions.length) expect(c.positions.includes(e.position) || e.alsoIn.some(p => c.positions.includes(p)), `${it.ex} position`).toBe(true);
      for (const f of e.flags) expect(c.cautions.includes(f), `${it.ex} flag ${f}`).toBe(false);
      expect(c.exclude.includes(e.id)).toBe(false);
      if (e.equipment !== 'none' && !(e.equipment === 'chair' && c.positions.includes('chair'))) expect(c.equipment).toContain(e.equipment);
      if (c.types.length) expect(c.types.some(t => TYPE_CATS[t].includes(e.category)), `${it.ex} type`).toBe(true);
      if (c.areas.length) expect(e.primary.some(a => c.areas.includes(a)), `${it.ex} area`).toBe(true);
    }
    return res;
  };

  it('lands close to the requested duration', () => {
    for (const minutes of [3, 5, 10, 20, 30]) {
      const res = check(C({ minutes }));
      const total = routineTotals(res.routine!, T).total / 60;
      expect(Math.abs(total - minutes) / minutes, `${minutes} min -> ${total.toFixed(1)}`).toBeLessThan(0.2);
    }
  });

  it('respects every constraint for the three example requests', () => {
    check(fromText('five minutes seated after a long drive'));
    check(fromText('ten minutes of beginner hip mobility'));
    const res = check(fromText('standing warm-up before walking; avoid kneeling'));
    expect(res.routine!.items.every(i => EX[i.ex].position === 'standing' || EX[i.ex].alsoIn.includes('standing'))).toBe(true);
  });

  it('respects exclusions, equipment and caution preferences together', () => {
    const c = C({ minutes: 12, areas: ['hips', 'hamstrings', 'calves'], equipment: [], cautions: ['kneeling', 'deep-knee', 'balance'], exclude: ['forward-fold', 'butterfly'] });
    const res = check(c);
    expect(res.routine!.items.some(i => EX[i.ex].equipment !== 'none')).toBe(false);
  });

  it('keeps advanced movements out unless the level allows them', () => {
    for (let seed = 0; seed < 8; seed++) {
      const res = check(C({ minutes: 30, level: 'intermediate' }), seed);
      expect(res.routine!.items.some(i => EX[i.ex].difficulty === 'advanced')).toBe(false);
    }
  });

  it('is deterministic, and regenerating changes the selection', () => {
    const a = planRoutine(C(), T, 1).routine!.items.map(i => i.ex).join();
    const b = planRoutine(C(), T, 1).routine!.items.map(i => i.ex).join();
    const c = planRoutine(C(), T, 2).routine!.items.map(i => i.ex).join();
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('orders standing work before floor work', () => {
    const rank = { standing: 0, chair: 1, kneeling: 2, support: 3, seated: 4, lying: 5 };
    const items = planRoutine(C({ minutes: 20 }), T).routine!.items.map(i => rank[EX[i.ex].position]);
    expect([...items].sort((x, y) => x - y)).toEqual(items);
  });

  it('explains an impossible request and names the blocking setting', () => {
    const res = planRoutine(C({ positions: ['chair'], areas: ['calves'], types: ['strength'] }), T);
    expect(res.routine).toBeNull();
    expect(res.problem).toMatch(/No movements match/);
    expect(res.suggestion).toMatch(/Try/);
    expect(eligible(C({ positions: ['chair'], areas: ['calves'], types: ['strength'] }))).toHaveLength(0);
  });

  it('says so when too few movements match to fill the time', () => {
    const res = planRoutine(C({ minutes: 30, areas: ['wrists'], positions: ['chair'] }), T);
    expect(res.routine).toBeTruthy();
    expect(res.notes.join(' ')).toMatch(/instead of 30/);
  });
});
