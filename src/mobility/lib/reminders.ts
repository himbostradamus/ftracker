import { MobilityState } from '../types';
import { dateKeyInTz, hhmmToMinutes, minutesInTz, resolveTz, weekdayOf } from './dates';
import { activeDays, streaks } from './stats';

// Reminders are checked only while the app is open. Nothing here can wake a
// closed app: that would need a push server, which this app does not have.

export interface Due { id: string; title: string; routineId?: string; kind: 'reminder' | 'streak' }
const GRACE_MIN = 90;

export function inQuietHours(minutes: number, s: MobilityState['settings']): boolean {
  if (!s.quietEnabled) return false;
  const a = hhmmToMinutes(s.quietStart), b = hhmmToMinutes(s.quietEnd);
  if (a === b) return false;
  return a < b ? minutes >= a && minutes < b : minutes >= a || minutes < b;
}

export function dueReminders(st: MobilityState, now: Date): Due[] {
  const tz = resolveTz(st.settings.timezone);
  const today = dateKeyInTz(now, tz);
  const minutes = minutesInTz(now, tz);
  if (inQuietHours(minutes, st.settings)) return [];
  const wd = weekdayOf(today);
  const within = (time: string) => { const m = hhmmToMinutes(time); return minutes >= m && minutes - m <= GRACE_MIN; };
  const out: Due[] = [];
  for (const r of st.reminders) {
    if (r.enabled && r.days.includes(wd) && within(r.time) && st.fired[r.id] !== today) out.push({ id: r.id, title: r.title || 'Time to stretch', routineId: r.routineId, kind: 'reminder' });
  }
  if (st.settings.streakReminder && within(st.settings.streakReminderTime) && st.fired.streak !== today) {
    const days = activeDays(st.history, st.settings.dayThresholdMin);
    const s = streaks(days, today);
    if (!days.has(today) && s.current > 0) out.push({ id: 'streak', title: `Keep your ${s.current}-day streak going`, kind: 'streak' });
  }
  return out;
}

export function markFired(st: MobilityState, ids: string[], now: Date): MobilityState {
  const today = dateKeyInTz(now, resolveTz(st.settings.timezone));
  const fired = { ...st.fired };
  for (const id of ids) fired[id] = today;
  // Forget reminders that no longer exist.
  for (const k of Object.keys(fired)) if (k !== 'streak' && !st.reminders.some(r => r.id === k)) delete fired[k];
  return { ...st, fired };
}

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const isStandalone = () => typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);

export async function showSystemNotification(title: string, body: string, tag: string): Promise<boolean> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) { await reg.showNotification(title, { body, tag }); return true; }
    new Notification(title, { body, tag });
    return true;
  } catch { return false; }
}
