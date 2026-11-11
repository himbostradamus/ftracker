import { MobilityState, Routine, RoutineItem, SessionRecord } from '../types';
import { EX } from '../data/catalog';
import { ROUTINE_BY_ID } from '../data/routines';
import { normalizeState, SCHEMA, uid } from './store';
import { isDateKey } from './dates';

// Manual file backup, routine files and CSV export. Everything imported is
// validated before anything is written.

export const BACKUP_APP = 'ftracker-mobility';
export const ROUTINE_FILE = 'mobility-routine';

const isObj = (v: unknown): v is Record<string, any> => v !== null && typeof v === 'object' && !Array.isArray(v);

export function exportMobility(state: MobilityState, now = new Date()) {
  return { app: BACKUP_APP, schema: SCHEMA, exportedAt: now.toISOString(), data: state };
}

export interface ValidatedItems { items: RoutineItem[]; dropped: string[] }
export function validateItems(raw: unknown): ValidatedItems {
  const items: RoutineItem[] = [], dropped: string[] = [];
  for (const it of Array.isArray(raw) ? raw : []) {
    if (!isObj(it) || typeof it.ex !== 'string' || !EX[it.ex]) { dropped.push(isObj(it) ? String(it.ex) : 'invalid entry'); continue; }
    const dose = Number(it.dose);
    if (!Number.isFinite(dose) || dose <= 0) { dropped.push(it.ex); continue; }
    const item: RoutineItem = { ex: it.ex, dose: Math.min(1800, Math.round(dose)) };
    if (it.unit === 'sec' || it.unit === 'reps') item.unit = it.unit;
    if (Number.isFinite(it.before) && it.before >= 0) item.before = Math.min(300, Math.round(it.before));
    items.push(item);
  }
  return { items, dropped };
}

function cleanRoutine(r: Record<string, any>): { routine: Routine | null; dropped: string[] } {
  const { items, dropped } = validateItems(r.items);
  if (typeof r.name !== 'string' || !r.name.trim() || items.length === 0) return { routine: null, dropped };
  const cover = isObj(r.cover) && typeof r.cover.color === 'string'
    ? { color: r.cover.color.slice(0, 20), ...(typeof r.cover.ex === 'string' && EX[r.cover.ex] ? { ex: r.cover.ex } : {}), ...(typeof r.cover.image === 'string' && r.cover.image.startsWith('data:image/') && r.cover.image.length < 400000 ? { image: r.cover.image } : {}) }
    : undefined;
  return {
    routine: {
      id: typeof r.id === 'string' && r.id ? r.id : `custom-${uid()}`,
      name: r.name.trim().slice(0, 80),
      purpose: typeof r.purpose === 'string' ? r.purpose.slice(0, 300) : '',
      family: 'mixed',
      difficulty: ['beginner', 'intermediate', 'advanced'].includes(r.difficulty) ? r.difficulty : 'beginner',
      items, custom: true, cover,
      createdAt: typeof r.createdAt === 'string' ? r.createdAt : undefined,
      updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : undefined,
    },
    dropped,
  };
}

function cleanRecord(h: Record<string, any>): SessionRecord | null {
  if (typeof h.id !== 'string' || !isDateKey(h.dateKey)) return null;
  if (typeof h.activeSec !== 'number' || !Number.isFinite(h.activeSec) || h.activeSec < 0) return null;
  if (Number.isNaN(Date.parse(h.startedAt))) return null;
  const items = (Array.isArray(h.items) ? h.items : []).filter((i: any) => isObj(i) && typeof i.ex === 'string' && typeof i.activeSec === 'number');
  return {
    id: h.id, routineId: typeof h.routineId === 'string' ? h.routineId : null,
    routineName: typeof h.routineName === 'string' ? h.routineName : 'Session',
    startedAt: h.startedAt, endedAt: Number.isNaN(Date.parse(h.endedAt)) ? h.startedAt : h.endedAt,
    dateKey: h.dateKey, tz: typeof h.tz === 'string' ? h.tz : 'UTC',
    activeSec: Math.round(h.activeSec), completed: Number(h.completed) || 0, skipped: Number(h.skipped) || 0,
    total: Number(h.total) || items.length, items,
    source: h.source === 'manual' ? 'manual' : 'session',
    ...(typeof h.note === 'string' && h.note ? { note: h.note.slice(0, 500) } : {}),
    ...(Number.isFinite(h.effort) ? { effort: Math.min(5, Math.max(1, Math.round(h.effort))) } : {}),
    ...(h.edited ? { edited: true } : {}), ...(h.repair ? { repair: true } : {}),
  };
}

export interface BackupCheck {
  ok: boolean;
  error?: string;
  state?: MobilityState;
  summary?: { routines: number; sessions: number; favorites: number; reminders: number; warnings: string[] };
}

// Accepts a mobility backup, or a full app backup that contains one.
export function validateBackup(parsed: unknown): BackupCheck {
  if (!isObj(parsed)) return { ok: false, error: 'This file is not a backup.' };
  const wrapper = isObj(parsed.mobility) ? parsed.mobility : parsed;
  if (wrapper.app !== BACKUP_APP || !isObj(wrapper.data)) return { ok: false, error: 'This file has no stretching data in it.' };
  if (typeof wrapper.schema === 'number' && wrapper.schema > SCHEMA) return { ok: false, error: 'This backup was made by a newer version of the app.' };
  const base = normalizeState(wrapper.data);
  const warnings: string[] = [];

  const routines: Routine[] = [];
  for (const r of base.customRoutines as any[]) {
    const { routine, dropped } = cleanRoutine(r);
    if (dropped.length) warnings.push(`"${r.name ?? 'Routine'}": ${dropped.length} unknown movement${dropped.length === 1 ? '' : 's'} removed.`);
    if (routine) routines.push(routine); else warnings.push(`A routine with no usable movements was left out.`);
  }
  const history: SessionRecord[] = [];
  const seen = new Set<string>();
  let badRecords = 0;
  for (const h of base.history as any[]) {
    const rec = cleanRecord(h);
    if (!rec || seen.has(rec.id)) { badRecords++; continue; }
    seen.add(rec.id); history.push(rec);
  }
  if (badRecords) warnings.push(`${badRecords} damaged or duplicate history entr${badRecords === 1 ? 'y was' : 'ies were'} left out.`);

  // Keep references intact: favourites and reminders may only point at
  // routines and exercises that exist after the import.
  const known = (id: string) => !!ROUTINE_BY_ID[id] || routines.some(r => r.id === id);
  const state: MobilityState = {
    ...base, customRoutines: routines, history,
    favorites: { routines: base.favorites.routines.filter(known), exercises: base.favorites.exercises.filter(id => !!EX[id]) },
    reminders: base.reminders.map(r => (r.routineId && !known(r.routineId) ? { ...r, routineId: undefined } : r)),
    recent: base.recent.filter(known),
  };
  return {
    ok: true, state,
    summary: { routines: routines.length, sessions: history.length, favorites: state.favorites.routines.length + state.favorites.exercises.length, reminders: state.reminders.length, warnings },
  };
}

export function exportRoutineFile(r: Routine) {
  return { type: ROUTINE_FILE, version: 1, routine: { name: r.name, purpose: r.purpose, difficulty: r.difficulty, items: r.items, cover: r.cover } };
}

export function validateRoutineFile(parsed: unknown): { ok: boolean; error?: string; routine?: Routine; dropped?: string[] } {
  if (!isObj(parsed) || parsed.type !== ROUTINE_FILE || !isObj(parsed.routine)) return { ok: false, error: 'This is not a routine file.' };
  const { routine, dropped } = cleanRoutine({ ...parsed.routine, id: `custom-${uid()}` });
  if (!routine) return { ok: false, error: 'The routine has no movements this app recognises.', dropped };
  return { ok: true, routine, dropped };
}

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function historyCsv(history: SessionRecord[]): string {
  const head = ['date', 'started_at_utc', 'timezone', 'routine', 'active_seconds', 'movements_completed', 'movements_skipped', 'movements_total', 'source', 'edited', 'effort', 'note'];
  const rows = [...history].sort((a, b) => a.startedAt.localeCompare(b.startedAt)).map(h =>
    [h.dateKey, h.startedAt, h.tz, h.routineName, h.activeSec, h.completed, h.skipped, h.total, h.source, h.edited ? 'yes' : 'no', h.effort ?? '', h.note ?? ''].map(csvCell).join(','));
  return [head.join(','), ...rows].join('\n') + '\n';
}

export function downloadFile(name: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readJsonFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { try { resolve(JSON.parse(String(r.result))); } catch { reject(new Error('The file is not valid JSON.')); } };
    r.onerror = () => reject(new Error('The file could not be read.'));
    r.readAsText(file);
  });
}
