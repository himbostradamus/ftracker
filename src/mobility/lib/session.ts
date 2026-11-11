import { PlayerState, toRecord, upsertRecord } from './player';
import { getState, SESSION_KEY, update } from './store';
import { dateKeyInTz, resolveTz } from './dates';

// The in-progress session is persisted so a reload or a closed tab can be
// resumed. It lives under its own key, separate from saved history.
export function loadSession(): PlayerState | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s.sessionId !== 'string' || !Array.isArray(s.segs) || !Array.isArray(s.items) || !Array.isArray(s.workMs)) return null;
    return s as PlayerState;
  } catch { return null; }
}

export function saveSession(s: PlayerState | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
}

// Write (or rewrite) the history entry for a finished session. Keyed by the
// session id, so calling this any number of times leaves exactly one entry.
export function recordSession(s: PlayerState, extra: { note?: string; effort?: number } = {}) {
  const st = getState();
  const tz = resolveTz(st.settings.timezone);
  const rec = toRecord(s, s.lastTick, tz, extra);
  if (rec.activeSec < 5) return null;
  const today = dateKeyInTz(new Date(s.startedAt), tz);
  update(cur => ({
    ...cur,
    history: upsertRecord(cur.history, rec),
    recent: s.routineId && !s.routineId.startsWith('single-') && !s.routineId.startsWith('gen-')
      ? [s.routineId, ...cur.recent.filter(x => x !== s.routineId)].slice(0, 12) : cur.recent,
    settings: cur.settings.firstUseDate ? cur.settings : { ...cur.settings, firstUseDate: today },
    series: cur.series ? {
      ...cur.series,
      days: (() => {
        if (cur.series!.days.some(d => d.sessionId === rec.id)) return cur.series!.days;
        const i = cur.series!.days.findIndex(d => !d.sessionId && d.routine === s.routineId && d.date <= today);
        return i < 0 ? cur.series!.days : cur.series!.days.map((d, j) => (j === i ? { ...d, sessionId: rec.id } : d));
      })(),
    } : null,
  }));
  return rec;
}
