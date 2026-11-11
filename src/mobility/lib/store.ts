import { useSyncExternalStore } from 'react';
import { MobilityState, Settings } from '../types';

// Storage for the stretching section. It owns exactly two localStorage keys
// and never reads or writes the lift tracker's keys.
export const MOBILITY_KEY = 'mobility-v1';
export const SESSION_KEY = 'mobility-session-v1';
export const SCHEMA = 1;

export const DEFAULT_SETTINGS: Settings = {
  appearance: 'system', textSize: 'normal', reduceMotion: 'system',
  sounds: true, speakNames: false, speakSides: false, volume: 0.7, countdownBeeps: 3,
  prepSec: 5, transitionSec: 5, switchSec: 4, pauseOnInfo: true, keepAwake: true,
  level: 'beginner', cautions: [], timezone: 'auto',
  scheduleDays: [0, 1, 2, 3, 4, 5, 6], dayThresholdMin: 2, showGauge: true,
  goal: { kind: 'none', target: 3 },
  streakReminder: false, streakReminderTime: '19:00',
  quietStart: '22:00', quietEnd: '07:00', quietEnabled: false,
  notifications: false, backupReminder: true,
};

export function defaultState(): MobilityState {
  return {
    schema: SCHEMA, settings: { ...DEFAULT_SETTINGS }, customRoutines: [],
    favorites: { routines: [], exercises: [] }, history: [], reminders: [], series: null, recent: [], fired: {},
  };
}

const isObj = (v: unknown): v is Record<string, any> => v !== null && typeof v === 'object' && !Array.isArray(v);

// Bring any stored or imported value up to the current shape. Unknown fields
// are dropped, missing ones take defaults, and nothing throws.
export function normalizeState(raw: unknown): MobilityState {
  const d = defaultState();
  if (!isObj(raw)) return d;
  const s = isObj(raw.settings) ? raw.settings : {};
  const settings = { ...d.settings } as Record<string, any>;
  for (const k of Object.keys(d.settings) as (keyof Settings)[]) {
    const v = s[k];
    if (v !== undefined && typeof v === typeof (d.settings as any)[k] && Array.isArray(v) === Array.isArray((d.settings as any)[k])) settings[k] = v;
  }
  for (const k of ['lastBackupAt', 'firstUseDate', 'lastSection'] as const) if (typeof s[k] === 'string') settings[k] = s[k];
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  const fav = isObj(raw.favorites) ? raw.favorites : {};
  return {
    schema: SCHEMA,
    settings: settings as Settings,
    customRoutines: arr(raw.customRoutines).filter(r => isObj(r) && typeof r.id === 'string' && Array.isArray(r.items)),
    favorites: {
      routines: arr(fav.routines).filter((x: unknown) => typeof x === 'string'),
      exercises: arr(fav.exercises).filter((x: unknown) => typeof x === 'string'),
    },
    history: arr(raw.history).filter(h => isObj(h) && typeof h.id === 'string' && typeof h.dateKey === 'string' && typeof h.activeSec === 'number'),
    reminders: arr(raw.reminders).filter(r => isObj(r) && typeof r.id === 'string' && typeof r.time === 'string'),
    series: isObj(raw.series) && typeof raw.series.seriesId === 'string' && Array.isArray(raw.series.days) ? (raw.series as any) : null,
    recent: arr(raw.recent).filter((x: unknown) => typeof x === 'string').slice(0, 12),
    fired: isObj(raw.fired) ? Object.fromEntries(Object.entries(raw.fired).filter(([, v]) => typeof v === 'string')) as Record<string, string> : {},
  };
}

let cache: MobilityState | null = null;
const listeners = new Set<() => void>();

export function loadRawMobility(): unknown {
  try {
    const raw = localStorage.getItem(MOBILITY_KEY);
    return raw === null ? null : JSON.parse(raw);
  } catch { return null; }
}

export function getState(): MobilityState {
  if (!cache) cache = normalizeState(loadRawMobility());
  return cache;
}

export function setState(next: MobilityState) {
  cache = next;
  try { localStorage.setItem(MOBILITY_KEY, JSON.stringify(next)); } catch { /* storage full or blocked */ }
  listeners.forEach(l => l());
}

export function update(fn: (s: MobilityState) => MobilityState) { setState(fn(getState())); }
export function updateSettings(patch: Partial<Settings>) {
  update(s => ({ ...s, settings: { ...s.settings, ...patch } }));
}
export function resetCache() { cache = null; }
export function clearMobilityData() {
  localStorage.removeItem(MOBILITY_KEY);
  localStorage.removeItem(SESSION_KEY);
  cache = null;
  listeners.forEach(l => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export function useMobility(): MobilityState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
