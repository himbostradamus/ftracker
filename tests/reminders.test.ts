import { describe, expect, it } from 'vitest';
import { dueReminders, inQuietHours, markFired } from '../src/mobility/lib/reminders';
import { defaultState } from '../src/mobility/lib/store';
import { MobilityState } from '../src/mobility/types';

const base = (): MobilityState => ({
  ...defaultState(),
  settings: { ...defaultState().settings, timezone: 'UTC' },
  reminders: [{ id: 'a', title: 'Morning', time: '07:30', days: [0, 1, 2, 3, 4], enabled: true, routineId: 'morning-mobility' }],
});
// 2026-11-09 is a Monday.
const at = (iso: string) => new Date(iso);

describe('reminders', () => {
  it('fires at its time on a selected weekday, once', () => {
    let st = base();
    expect(dueReminders(st, at('2026-11-09T07:29:00Z'))).toHaveLength(0);
    const due = dueReminders(st, at('2026-11-09T07:31:00Z'));
    expect(due.map(d => d.id)).toEqual(['a']);
    st = markFired(st, ['a'], at('2026-11-09T07:31:00Z'));
    expect(dueReminders(st, at('2026-11-09T07:45:00Z'))).toHaveLength(0);
    expect(dueReminders(st, at('2026-11-10T07:31:00Z'))).toHaveLength(1);
  });

  it('skips unselected weekdays, disabled reminders and stale times', () => {
    const st = base();
    expect(dueReminders(st, at('2026-11-14T07:31:00Z'))).toHaveLength(0);          // Saturday
    expect(dueReminders({ ...st, reminders: [{ ...st.reminders[0], enabled: false }] }, at('2026-11-09T07:31:00Z'))).toHaveLength(0);
    expect(dueReminders(st, at('2026-11-09T12:00:00Z'))).toHaveLength(0);          // opened hours later
  });

  it('respects quiet hours, including ones that cross midnight', () => {
    const s = { ...base().settings, quietEnabled: true, quietStart: '22:00', quietEnd: '08:00' };
    expect(inQuietHours(23 * 60, s)).toBe(true);
    expect(inQuietHours(7 * 60 + 31, s)).toBe(true);
    expect(inQuietHours(12 * 60, s)).toBe(false);
    expect(dueReminders({ ...base(), settings: s }, at('2026-11-09T07:31:00Z'))).toHaveLength(0);
  });

  it('uses the configured timezone', () => {
    const st = { ...base(), settings: { ...base().settings, timezone: 'America/New_York' } };
    expect(dueReminders(st, at('2026-11-09T07:31:00Z'))).toHaveLength(0);          // 02:31 in New York
    expect(dueReminders(st, at('2026-11-09T12:31:00Z'))).toHaveLength(1);          // 07:31 in New York
  });

  it('sends the streak reminder only when there is a streak to keep and today is not done', () => {
    const rec = (dateKey: string) => ({ id: dateKey, routineId: null, routineName: 'x', startedAt: `${dateKey}T10:00:00Z`, endedAt: `${dateKey}T10:10:00Z`, dateKey, tz: 'UTC', activeSec: 600, completed: 1, skipped: 0, total: 1, items: [], source: 'session' as const });
    const st: MobilityState = { ...base(), reminders: [], settings: { ...base().settings, streakReminder: true, streakReminderTime: '19:00' } };
    expect(dueReminders(st, at('2026-11-09T19:05:00Z'))).toHaveLength(0);
    expect(dueReminders({ ...st, history: [rec('2026-11-08')] }, at('2026-11-09T19:05:00Z')).map(d => d.kind)).toEqual(['streak']);
    expect(dueReminders({ ...st, history: [rec('2026-11-08'), rec('2026-11-09')] }, at('2026-11-09T19:05:00Z'))).toHaveLength(0);
  });
});
