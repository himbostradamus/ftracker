import { Goal, SessionRecord, Settings } from '../types';
import { addDays, diffDays, mondayOf, monthOf, weekdayOf } from './dates';
import { EX } from '../data/catalog';

export interface DayTotal { activeSec: number; sessions: number; manual: boolean }

export function dayTotals(history: SessionRecord[]): Map<string, DayTotal> {
  const m = new Map<string, DayTotal>();
  for (const h of history) {
    const d = m.get(h.dateKey) ?? { activeSec: 0, sessions: 0, manual: false };
    d.activeSec += h.activeSec; d.sessions += 1; d.manual = d.manual || h.source === 'manual';
    m.set(h.dateKey, d);
  }
  return m;
}

// A day counts as active once its total active time reaches the threshold.
export function activeDays(history: SessionRecord[], thresholdMin: number): Set<string> {
  const out = new Set<string>();
  for (const [k, v] of dayTotals(history)) if (v.activeSec >= thresholdMin * 60) out.add(k);
  return out;
}

// The current streak stays alive through today: it only breaks once a whole
// calendar day has passed with no activity.
export function streaks(days: Set<string>, today: string): { current: number; longest: number } {
  let current = 0;
  let cursor = days.has(today) ? today : addDays(today, -1);
  while (days.has(cursor)) { current++; cursor = addDays(cursor, -1); }
  let longest = 0;
  for (const d of days) {
    if (days.has(addDays(d, -1))) continue;   // only count from the first day of each run
    let n = 1; let c = addDays(d, 1);
    while (days.has(c)) { n++; c = addDays(c, 1); }
    longest = Math.max(longest, n);
  }
  return { current, longest: Math.max(longest, current) };
}

export const WINDOW_DAYS = 21;

export interface Consistency {
  pct: number | null;     // null when no scheduled day is eligible yet
  done: number;
  scheduled: number;
  windowDays: number;     // eligible calendar days actually considered
  partial: boolean;       // true while fewer than 21 days of use exist
}

// Adherence, not flexibility: of the scheduled practice days in the last 21
// days, how many reached the daily threshold. Days before first use are not
// counted, and today only counts once it has been completed.
export function consistency(history: SessionRecord[], s: Pick<Settings, 'scheduleDays' | 'dayThresholdMin' | 'firstUseDate'>, today: string): Consistency {
  const days = activeDays(history, s.dayThresholdMin);
  const firstRecorded = history.reduce<string | null>((a, h) => (!a || h.dateKey < a ? h.dateKey : a), null);
  const first = [s.firstUseDate, firstRecorded].filter(Boolean).sort()[0] ?? today;
  let done = 0, scheduled = 0, windowDays = 0;
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const d = addDays(today, -i);
    if (d < first) break;
    windowDays++;
    if (!s.scheduleDays.includes(weekdayOf(d))) continue;
    if (d === today && !days.has(d)) continue;
    scheduled++;
    if (days.has(d)) done++;
  }
  return { pct: scheduled ? Math.round((done / scheduled) * 100) : null, done, scheduled, windowDays, partial: windowDays < WINDOW_DAYS };
}

export function goalProgress(history: SessionRecord[], goal: Goal, thresholdMin: number, today: string): { done: number; target: number; label: string } | null {
  if (goal.kind === 'none') return null;
  if (goal.kind === 'sessions-week') {
    const mon = mondayOf(today);
    const done = history.filter(h => h.dateKey >= mon && h.dateKey <= addDays(mon, 6)).length;
    return { done, target: goal.target, label: 'sessions this week' };
  }
  const month = monthOf(today);
  const done = [...activeDays(history, thresholdMin)].filter(d => monthOf(d) === month).length;
  return { done, target: goal.target, label: 'active days this month' };
}

export function totals(history: SessionRecord[]) {
  return {
    sessions: history.length,
    activeSec: history.reduce((a, h) => a + h.activeSec, 0),
    manual: history.filter(h => h.source === 'manual').length,
  };
}

export function breakdown(history: SessionRecord[], by: 'area' | 'category'): { key: string; sec: number }[] {
  const acc: Record<string, number> = {};
  for (const h of history) for (const it of h.items ?? []) {
    const ex = EX[it.ex];
    if (!ex || !it.activeSec) continue;
    const keys = by === 'area' ? ex.primary : [ex.category];
    for (const k of keys) acc[k] = (acc[k] ?? 0) + it.activeSec / keys.length;
  }
  return Object.entries(acc).map(([key, sec]) => ({ key, sec: Math.round(sec) })).sort((a, b) => b.sec - a.sec);
}

export const daysSince = (a: string, b: string) => diffDays(a, b);
