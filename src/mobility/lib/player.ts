import { Routine, RoutineItem, SessionItemResult, SessionRecord } from '../types';
import { buildTimeline, Segment, TimingOpts } from './timeline';
import { dateKeyInTz } from './dates';

// Session engine. Pure functions over a serialisable state, driven by wall
// clock timestamps: a late or missing timer callback never loses time, and a
// long gap (backgrounded tab, locked phone, reload) is detected rather than
// silently "played through".

// Short stalls (a slow frame, a brief app switch) are simply counted on the
// clock; only a longer gap stops the session and asks what to do.
export const SUSPEND_MS = 10000;

export interface PlayerState {
  sessionId: string;
  routineId: string | null;
  routineName: string;
  items: RoutineItem[];
  segs: Segment[];
  idx: number;
  elapsedMs: number;          // time already spent in the current segment
  running: boolean;
  lastTick: number;           // epoch ms of the last processed tick
  workMs: number[];           // active exercise time per item
  doneSegs: number[];         // indices of work segments that ran to the end
  skipped: number[];          // item indices the person skipped
  startedAt: number;
  finished: boolean;
  interrupted: { gapMs: number } | null;
}

export type Cue =
  | { type: 'segment'; seg: Segment; index: number }
  | { type: 'count'; n: number }
  | { type: 'finish' };

export function createSession(routine: Pick<Routine, 'id' | 'name' | 'items'>, timing: TimingOpts, now: number, sessionId: string): PlayerState {
  const segs = buildTimeline(routine.items, timing);
  return {
    sessionId, routineId: routine.id ?? null, routineName: routine.name,
    items: routine.items.map(i => ({ ...i })), segs,
    idx: 0, elapsedMs: 0, running: false, lastTick: now,
    workMs: routine.items.map(() => 0), doneSegs: [], skipped: [],
    startedAt: now, finished: segs.length === 0, interrupted: null,
  };
}

// Consume `ms` of running time, moving through segments as they complete.
function advance(s: PlayerState, ms: number, cues: Cue[] | null, countFrom = 3): PlayerState {
  let { idx, elapsedMs } = s;
  const workMs = [...s.workMs];
  const doneSegs = [...s.doneSegs];
  let finished = s.finished;
  let left = ms;
  while (left > 0 && !finished) {
    const seg = s.segs[idx];
    const durMs = seg.dur * 1000;
    const use = Math.min(durMs - elapsedMs, left);
    if (cues && countFrom > 0) {
      // Countdown beeps for the final seconds of every segment, so there is a
      // warning both before a movement ends and before the next one begins.
      const before = Math.ceil((durMs - elapsedMs) / 1000);
      const after = Math.ceil((durMs - elapsedMs - use) / 1000);
      for (let n = Math.min(before - 1, countFrom); n >= Math.max(after, 1); n--) cues.push({ type: 'count', n });
    }
    if (seg.kind === 'work') workMs[seg.item] += use;
    elapsedMs += use;
    left -= use;
    if (elapsedMs >= durMs) {
      if (seg.kind === 'work' && !doneSegs.includes(idx)) doneSegs.push(idx);
      idx += 1; elapsedMs = 0;
      if (idx >= s.segs.length) { finished = true; idx = s.segs.length - 1; cues?.push({ type: 'finish' }); }
      else cues?.push({ type: 'segment', seg: s.segs[idx], index: idx });
    }
  }
  return { ...s, idx, elapsedMs, workMs, doneSegs, finished, running: finished ? false : s.running };
}

export function tick(s: PlayerState, now: number, countFrom = 3): { state: PlayerState; cues: Cue[] } {
  if (!s.running || s.finished || s.interrupted) return { state: s, cues: [] };
  const dt = now - s.lastTick;
  if (dt <= 0) return { state: s, cues: [] };
  if (dt > SUSPEND_MS) {
    // The app was not running for a while. Stop at the last known position
    // and let the person decide how to account for the gap.
    return { state: { ...s, running: false, interrupted: { gapMs: dt }, lastTick: now }, cues: [] };
  }
  const cues: Cue[] = [];
  const state = advance(s, dt, cues, countFrom);
  return { state: { ...state, lastTick: now }, cues };
}

export function start(s: PlayerState, now: number): PlayerState {
  return s.finished ? s : { ...s, running: true, lastTick: now, interrupted: null };
}

export function pause(s: PlayerState, now: number): PlayerState {
  if (!s.running) return s;
  const t = tick(s, now).state;
  return { ...t, running: false };
}

// 'resume' continues from where the timer stopped; 'elapsed' counts the time
// away as if the session had kept running (without any cues being played).
export function resolveInterruption(s: PlayerState, mode: 'resume' | 'elapsed', now: number): PlayerState {
  if (!s.interrupted) return s;
  const base = { ...s, interrupted: null, running: true, lastTick: now };
  return mode === 'resume' ? base : advance(base, s.interrupted.gapMs, null);
}

const firstSegOf = (s: PlayerState, item: number) => s.segs.findIndex(g => g.item === item);
const curItem = (s: PlayerState) => s.segs[s.idx]?.item ?? 0;
const itemDone = (s: PlayerState, item: number) =>
  s.segs.every((g, i) => g.item !== item || g.kind !== 'work' || s.doneSegs.includes(i));

function jump(s: PlayerState, idx: number, now: number): PlayerState {
  return { ...s, idx, elapsedMs: 0, lastTick: now };
}

// Skip to the next movement. The new movement begins with its transition,
// so there is always time to get into position.
export function next(s: PlayerState, now: number): PlayerState {
  if (s.finished) return s;
  const t = s.running ? tick(s, now).state : s;
  if (t.finished || t.interrupted) return t;
  const item = curItem(t);
  const skipped = itemDone(t, item) || t.skipped.includes(item) ? t.skipped : [...t.skipped, item];
  const idx = firstSegOf(t, item + 1);
  if (idx < 0) return { ...t, skipped, finished: true, running: false, lastTick: now };
  return jump({ ...t, skipped }, idx, now);
}

export function previous(s: PlayerState, now: number): PlayerState {
  if (s.finished) return s;
  const t = s.running ? tick(s, now).state : s;
  const target = Math.max(0, curItem(t) - 1);
  const idx = firstSegOf(t, target);
  return jump({
    ...t,
    doneSegs: t.doneSegs.filter(i => i < idx),
    skipped: t.skipped.filter(i => i < target),
  }, idx, now);
}

// Restart the current movement from its first side, without a transition:
// the person is already in position.
export function restartCurrent(s: PlayerState, now: number): PlayerState {
  if (s.finished) return s;
  const t = s.running ? tick(s, now).state : s;
  const item = curItem(t);
  const idx = t.segs.findIndex(g => g.item === item && g.kind === 'work');
  return jump({ ...t, doneSegs: t.doneSegs.filter(i => t.segs[i].item !== item), skipped: t.skipped.filter(i => i !== item) }, idx, now);
}

export function endSession(s: PlayerState, now: number): PlayerState {
  const t = s.running ? tick(s, now).state : s;
  return { ...t, finished: true, running: false, interrupted: null, lastTick: now };
}

export function position(s: PlayerState) {
  const seg = s.segs[s.idx];
  const remainingMs = seg ? Math.max(0, seg.dur * 1000 - s.elapsedMs) : 0;
  const totalMs = s.segs.reduce((a, g) => a + g.dur * 1000, 0);
  const doneMs = s.segs.slice(0, s.idx).reduce((a, g) => a + g.dur * 1000, 0) + s.elapsedMs;
  // While waiting in a transition, show the movement that is coming up.
  return { seg, remainingMs, progress: totalMs ? Math.min(1, doneMs / totalMs) : 1, item: seg?.item ?? 0 };
}

export function itemResults(s: PlayerState): SessionItemResult[] {
  return s.items.map((it, i) => {
    const activeSec = Math.round(s.workMs[i] / 1000);
    const status: SessionItemResult['status'] = itemDone(s, i) ? 'completed' : activeSec >= 5 ? 'partial' : 'skipped';
    return { ex: it.ex, status, activeSec };
  });
}

export function toRecord(s: PlayerState, now: number, tz: string, extra: { note?: string; effort?: number } = {}): SessionRecord {
  const items = itemResults(s);
  return {
    id: s.sessionId, routineId: s.routineId, routineName: s.routineName,
    startedAt: new Date(s.startedAt).toISOString(), endedAt: new Date(now).toISOString(),
    dateKey: dateKeyInTz(new Date(s.startedAt), tz), tz,
    activeSec: Math.round(s.workMs.reduce((a, b) => a + b, 0) / 1000),
    completed: items.filter(i => i.status === 'completed').length,
    skipped: items.filter(i => i.status === 'skipped').length,
    total: items.length, items, source: 'session',
    ...(extra.note ? { note: extra.note } : {}), ...(extra.effort ? { effort: extra.effort } : {}),
  };
}

// Saving the same session twice replaces the earlier record, so reloads and
// repeated taps cannot create duplicates.
export function upsertRecord(history: SessionRecord[], rec: SessionRecord): SessionRecord[] {
  const i = history.findIndex(h => h.id === rec.id);
  if (i < 0) return [...history, rec];
  const copy = [...history]; copy[i] = rec; return copy;
}
