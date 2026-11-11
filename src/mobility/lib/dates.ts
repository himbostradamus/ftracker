// Calendar-date helpers. A "date key" is a local calendar date, YYYY-MM-DD.
// Sessions store both the UTC instant and the date key that was current in
// the chosen timezone when they were recorded, so later travel or a changed
// timezone setting never rewrites history.

export function resolveTz(setting: string): string {
  if (setting && setting !== 'auto') return setting;
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

export function isValidTz(tz: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

export function dateKeyInTz(d: Date, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(d);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return dateKeyInTz(d, 'UTC');
  }
}

export function minutesInTz(d: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}

// Date-key arithmetic is done on UTC noon so daylight-saving changes (23- or
// 25-hour local days) can never skip or repeat a calendar date.
const toUtc = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 12);
};
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const isDateKey = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && fromUtc(toUtc(s)) === s;

export const addDays = (key: string, n: number) => fromUtc(toUtc(key) + n * 86400000);
export const diffDays = (a: string, b: string) => Math.round((toUtc(a) - toUtc(b)) / 86400000);
// 0 = Monday .. 6 = Sunday
export const weekdayOf = (key: string) => (new Date(toUtc(key)).getUTCDay() + 6) % 7;
export const mondayOf = (key: string) => addDays(key, -weekdayOf(key));
export const monthOf = (key: string) => key.slice(0, 7);

export function formatDateKey(key: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }): string {
  return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: 'UTC' }).format(new Date(toUtc(key)));
}

export const hhmmToMinutes = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function fmtMinutes(sec: number): string {
  if (sec < 90) return `${Math.max(1, Math.round(sec / 60))} min`;
  return `${Math.round(sec / 60)} min`;
}
