import { describe, expect, it } from 'vitest';
import { addDays, dateKeyInTz, diffDays, isDateKey, weekdayOf } from '../src/mobility/lib/dates';
import { activeDays, consistency, goalProgress, streaks } from '../src/mobility/lib/stats';
import { SessionRecord } from '../src/mobility/types';

const rec = (dateKey: string, min = 5, extra: Partial<SessionRecord> = {}): SessionRecord => ({
  id: `${dateKey}-${Math.random()}`, routineId: null, routineName: 'x', startedAt: `${dateKey}T12:00:00.000Z`, endedAt: `${dateKey}T12:10:00.000Z`,
  dateKey, tz: 'UTC', activeSec: min * 60, completed: 1, skipped: 0, total: 1, items: [], source: 'session', ...extra,
});

describe('calendar dates', () => {
  it('assigns an instant to the local date of the chosen timezone', () => {
    const late = new Date('2026-03-01T04:30:00Z');   // 23:30 on 28 Feb in New York
    expect(dateKeyInTz(late, 'America/New_York')).toBe('2026-02-28');
    expect(dateKeyInTz(late, 'Europe/Berlin')).toBe('2026-03-01');
    expect(dateKeyInTz(late, 'Asia/Tokyo')).toBe('2026-03-01');
  });

  it('handles midnight exactly', () => {
    expect(dateKeyInTz(new Date('2026-06-10T03:59:59Z'), 'America/New_York')).toBe('2026-06-09');
    expect(dateKeyInTz(new Date('2026-06-10T04:00:00Z'), 'America/New_York')).toBe('2026-06-10');
  });

  it('steps across daylight-saving changes without skipping or repeating a date', () => {
    // US spring forward 8 Mar 2026, fall back 1 Nov 2026.
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
    expect(diffDays('2026-11-02', '2026-10-31')).toBe(2);
    // 23:30 local on the short day still belongs to that day.
    expect(dateKeyInTz(new Date('2026-03-09T03:30:00Z'), 'America/New_York')).toBe('2026-03-08');
    expect(dateKeyInTz(new Date('2026-11-02T04:30:00Z'), 'America/New_York')).toBe('2026-11-01');
  });

  it('knows weekdays and rejects impossible dates', () => {
    expect(weekdayOf('2026-11-09')).toBe(0);  // Monday
    expect(weekdayOf('2026-11-15')).toBe(6);  // Sunday
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-02-28')).toBe(true);
  });
});

describe('streaks', () => {
  it('counts consecutive days and survives an unfinished today', () => {
    const days = new Set(['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-09']);
    expect(streaks(days, '2026-11-09')).toEqual({ current: 1, longest: 3 });
    expect(streaks(days, '2026-11-08')).toEqual({ current: 3, longest: 3 });
    expect(streaks(days, '2026-11-10')).toEqual({ current: 1, longest: 3 });
    expect(streaks(days, '2026-11-11')).toEqual({ current: 0, longest: 3 });
  });

  it('runs straight through a daylight-saving weekend', () => {
    const days = new Set(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(streaks(days, '2026-11-02').current).toBe(4);
  });

  it('only counts days that reach the threshold, summing sessions', () => {
    const h = [rec('2026-11-01', 1), rec('2026-11-01', 1.5), rec('2026-11-02', 1)];
    expect([...activeDays(h, 2)]).toEqual(['2026-11-01']);
  });

  it('a missed day ends the current streak but keeps the longest', () => {
    const days = new Set(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-10']);
    expect(streaks(days, '2026-01-10')).toEqual({ current: 1, longest: 4 });
  });
});

describe('consistency gauge', () => {
  const base = { scheduleDays: [0, 1, 2, 3, 4, 5, 6], dayThresholdMin: 2, firstUseDate: '2026-01-01' };

  it('is the share of scheduled days completed in the last 21 days', () => {
    const h = Array.from({ length: 14 }, (_, i) => rec(addDays('2026-11-10', -i)));
    const c = consistency(h, base, '2026-11-10');
    expect(c).toMatchObject({ done: 14, scheduled: 21, pct: 67, partial: false });
  });

  it('does not count days before the person started', () => {
    const h = [rec('2026-11-08'), rec('2026-11-09'), rec('2026-11-10')];
    const c = consistency(h, { ...base, firstUseDate: '2026-11-08' }, '2026-11-10');
    expect(c).toMatchObject({ done: 3, scheduled: 3, pct: 100, partial: true, windowDays: 3 });
  });

  it('does not penalise today until today is over', () => {
    const h = [rec('2026-11-08'), rec('2026-11-09')];
    const c = consistency(h, { ...base, firstUseDate: '2026-11-08' }, '2026-11-10');
    expect(c).toMatchObject({ done: 2, scheduled: 2, pct: 100 });
  });

  it('follows the chosen schedule', () => {
    // Mondays, Wednesdays and Fridays only; done every Monday and Wednesday.
    const h: SessionRecord[] = [];
    for (let i = 0; i < 21; i++) { const d = addDays('2026-11-15', -i); if ([0, 2].includes(weekdayOf(d))) h.push(rec(d)); }
    const c = consistency(h, { ...base, scheduleDays: [0, 2, 4] }, '2026-11-15');
    expect(c).toMatchObject({ done: 6, scheduled: 9, pct: 67 });
    // Extra sessions on unscheduled days do not push it past 100.
    const all = Array.from({ length: 21 }, (_, i) => rec(addDays('2026-11-15', -i)));
    expect(consistency(all, { ...base, scheduleDays: [0, 2, 4] }, '2026-11-15').pct).toBe(100);
  });

  it('reports nothing rather than a made-up number when no day is eligible', () => {
    expect(consistency([], { ...base, firstUseDate: '2026-11-10' }, '2026-11-10').pct).toBeNull();
  });

  it('tracks weekly and monthly goals', () => {
    const h = [rec('2026-11-09'), rec('2026-11-10'), rec('2026-11-10'), rec('2026-11-02')];
    expect(goalProgress(h, { kind: 'sessions-week', target: 3 }, 2, '2026-11-10')).toMatchObject({ done: 3, target: 3 });
    expect(goalProgress(h, { kind: 'days-month', target: 20 }, 2, '2026-11-10')).toMatchObject({ done: 3, target: 20 });
    expect(goalProgress(h, { kind: 'none', target: 0 }, 2, '2026-11-10')).toBeNull();
  });
});
