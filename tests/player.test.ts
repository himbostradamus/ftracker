import { describe, expect, it } from 'vitest';
import { buildTimeline, routineTotals } from '../src/mobility/lib/timeline';
import * as P from '../src/mobility/lib/player';

const T = { prepSec: 5, transitionSec: 5, switchSec: 4 };
// forward-fold: 40 s both sides; lunge: per side; cat-cow: 8 reps at 6 s
const routine = { id: 'r1', name: 'Test', items: [{ ex: 'forward-fold', dose: 30 }, { ex: 'lunge', dose: 20 }, { ex: 'cat-cow', dose: 8 }] };
const run = (s: P.PlayerState, from: number, ms: number, step = 250) => {
  const cues: P.Cue[] = [];
  for (let t = from + step; t <= from + ms; t += step) { const r = P.tick(s, t); s = r.state; cues.push(...r.cues); }
  return { s, cues, now: from + ms };
};

describe('timeline', () => {
  it('expands sides, transitions and repetition estimates', () => {
    const segs = buildTimeline(routine.items, T);
    expect(segs.map(s => `${s.kind}:${s.side}:${s.dur}`)).toEqual([
      'prep:both:5', 'work:both:30',
      'transition:both:5', 'work:left:20', 'switch:right:4', 'work:right:20',
      'transition:both:5', 'work:both:48',
    ]);
    const tot = routineTotals(routine, T);
    expect(tot.total).toBe(137);
    expect(tot.work).toBe(118);
    expect(tot.estimated).toBe(true);
  });

  it('honours a per-transition override', () => {
    const segs = buildTimeline([{ ex: 'forward-fold', dose: 30 }, { ex: 'childs-pose', dose: 30, before: 15 }], T);
    expect(segs[2]).toMatchObject({ kind: 'transition', dur: 15 });
  });
});

describe('session engine', () => {
  it('runs to completion on the clock and credits active time exactly', () => {
    let s = P.start(P.createSession(routine, T, 0, 'a'), 0);
    const r = run(s, 0, 137000);
    expect(r.s.finished).toBe(true);
    const rec = P.toRecord(r.s, r.now, 'UTC');
    expect(rec.activeSec).toBe(118);
    expect(rec.completed).toBe(3);
    expect(rec.skipped).toBe(0);
    expect(r.cues.filter(c => c.type === 'finish')).toHaveLength(1);
  });

  it('is unaffected by uneven or late timer callbacks', () => {
    let s = P.start(P.createSession(routine, T, 0, 'a'), 0);
    for (const t of [900, 1000, 3900, 4100, 7700, 9000]) s = P.tick(s, t).state;
    // 9 s in: 5 s of preparation, then 4 s into the first movement.
    expect(s.idx).toBe(1);
    expect(s.elapsedMs).toBe(4000);
    expect(s.workMs[0]).toBe(4000);
  });

  it('plays three countdown cues before each exercise ends', () => {
    let s = P.start(P.createSession({ id: null as any, name: 'x', items: [{ ex: 'forward-fold', dose: 10 }] }, { ...T, prepSec: 0 }, 0, 'a'), 0);
    const { cues } = run(s, 0, 10000);
    expect(cues.filter(c => c.type === 'count').map(c => (c as any).n)).toEqual([3, 2, 1]);
  });

  it('keeps the remaining time when paused, including during a transition', () => {
    let s = P.start(P.createSession(routine, T, 0, 'a'), 0);
    s = run(s, 0, 2000).s;
    s = P.pause(s, 2000);
    expect(P.position(s).remainingMs).toBe(3000);
    s = P.tick(s, 60000).state;          // time passes while paused
    expect(P.position(s).remainingMs).toBe(3000);
    s = P.start(s, 60000);
    s = run(s, 60000, 1000).s;
    expect(P.position(s).remainingMs).toBe(2000);
    expect(s.interrupted).toBeNull();
  });

  it('gives a full transition after a skip and records the skip', () => {
    let s = P.start(P.createSession(routine, T, 0, 'a'), 0);
    s = run(s, 0, 8000).s;                // 3 s into forward fold
    s = P.next(s, 8000);
    const pos = P.position(s);
    expect(pos.seg.kind).toBe('transition');
    expect(pos.remainingMs).toBe(5000);
    expect(s.skipped).toEqual([0]);
    const end = run(s, 8000, 200000).s;
    const rec = P.toRecord(end, 300000, 'UTC');
    expect(rec.items[0].status).toBe('skipped');
    expect(rec.completed).toBe(2);
    expect(rec.activeSec).toBe(3 + 40 + 48);
  });

  it('counts a mostly finished movement as partial rather than skipped', () => {
    let s = P.start(P.createSession(routine, T, 0, 'a'), 0);
    s = run(s, 0, 25000).s;               // 20 s of a 30 s hold
    s = P.next(s, 25000);
    expect(P.itemResults(s)[0]).toMatchObject({ status: 'partial', activeSec: 20 });
  });

  it('can go back and restart a movement', () => {
    let s = P.start(P.createSession(routine, T, 0, 'a'), 0);
    s = run(s, 0, 50000).s;               // inside lunge, left side
    expect(s.segs[s.idx]).toMatchObject({ item: 1, side: 'left' });
    s = run(s, 50000, 20000).s;           // now on the right side
    expect(s.segs[s.idx]).toMatchObject({ item: 1, side: 'right' });
    s = P.restartCurrent(s, 70000);
    expect(s.segs[s.idx]).toMatchObject({ item: 1, side: 'left', kind: 'work' });
    expect(s.elapsedMs).toBe(0);
    s = P.previous(s, 70000);
    expect(s.segs[s.idx]).toMatchObject({ item: 0, kind: 'prep' });
    expect(s.doneSegs).toEqual([]);
  });

  it('detects a suspension instead of silently playing through it', () => {
    let s = P.start(P.createSession(routine, T, 0, 'a'), 0);
    s = run(s, 0, 7000).s;                // 2 s into forward fold
    const r = P.tick(s, 67000);           // a minute with no ticks (locked phone)
    expect(r.cues).toEqual([]);
    expect(r.state.running).toBe(false);
    expect(r.state.interrupted?.gapMs).toBe(60000);
    expect(r.state.elapsedMs).toBe(2000);

    const resumed = P.resolveInterruption(r.state, 'resume', 67000);
    expect(resumed.running).toBe(true);
    expect(P.position(resumed).remainingMs).toBe(28000);

    const counted = P.resolveInterruption(r.state, 'elapsed', 67000);
    // 60 s later: 28 s fold, 5 s transition, 20 s left side, 4 s switch, 3 s right side
    expect(counted.segs[counted.idx]).toMatchObject({ item: 1, side: 'right', kind: 'work' });
    expect(counted.elapsedMs).toBe(3000);
  });

  it('treats a reload the same way', () => {
    let s = P.start(P.createSession(routine, T, 0, 'a'), 0);
    s = run(s, 0, 7000).s;
    const restored: P.PlayerState = JSON.parse(JSON.stringify(s));
    const r = P.tick(restored, 7000 + 10 * 60000);
    expect(r.state.interrupted?.gapMs).toBe(600000);
    expect(r.state.finished).toBe(false);
  });

  it('records a session once even if saved repeatedly', () => {
    let s = P.start(P.createSession(routine, T, 0, 'same-id'), 0);
    s = run(s, 0, 137000).s;
    const rec = P.toRecord(s, 137000, 'UTC');
    let history = P.upsertRecord([], rec);
    history = P.upsertRecord(history, { ...rec, note: 'felt good' });
    history = P.upsertRecord(history, P.toRecord(s, 140000, 'UTC'));
    expect(history).toHaveLength(1);
  });

  it('ending early records what was actually done', () => {
    let s = P.start(P.createSession(routine, T, 0, 'a'), 0);
    s = run(s, 0, 40000).s;               // fold finished, lunge not started
    s = P.endSession(s, 40000);
    const rec = P.toRecord(s, 40000, 'UTC');
    expect(rec.completed).toBe(1);
    expect(rec.skipped).toBe(2);
    expect(rec.activeSec).toBe(30);
  });
});
