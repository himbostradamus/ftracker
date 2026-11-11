import { beforeEach, describe, expect, it } from 'vitest';
import { exportMobility, exportRoutineFile, historyCsv, validateBackup, validateRoutineFile } from '../src/mobility/lib/backup';
import { clearMobilityData, defaultState, getState, MOBILITY_KEY, normalizeState, resetCache, SESSION_KEY, setState, update } from '../src/mobility/lib/store';
import { buildFullBackup } from '../src/lib/fullBackup';
import { loadData, loadConfigs, loadWeightLog, loadNutrProfile, loadUIPrefs } from '../src/lib/storage';
import { MobilityState } from '../src/mobility/types';

const sample = (): MobilityState => ({
  ...defaultState(),
  settings: { ...defaultState().settings, level: 'intermediate', cautions: ['kneeling'], timezone: 'Europe/Berlin', firstUseDate: '2026-10-01' },
  customRoutines: [{ id: 'custom-1', name: 'My hips', purpose: 'mine', family: 'mixed', difficulty: 'beginner', custom: true, cover: { color: '#83A58D', ex: 'pigeon' }, items: [{ ex: 'lunge', dose: 30 }, { ex: 'butterfly', dose: 45, before: 12 }] }],
  favorites: { routines: ['custom-1', 'morning-mobility'], exercises: ['pigeon'] },
  history: [{ id: 's1', routineId: 'custom-1', routineName: 'My hips', startedAt: '2026-11-09T18:00:00.000Z', endedAt: '2026-11-09T18:06:00.000Z', dateKey: '2026-11-09', tz: 'Europe/Berlin', activeSec: 300, completed: 2, skipped: 0, total: 2, items: [{ ex: 'lunge', status: 'completed', activeSec: 60 }], source: 'session', note: 'tight, "left" side', effort: 3 }],
  reminders: [{ id: 'r1', title: 'Evening', time: '20:30', days: [0, 2, 4], enabled: true, routineId: 'custom-1' }],
  recent: ['custom-1'],
});

// A realistic snapshot of the lift tracker's five keys.
const TRACKER = {
  'workout-tracker-v6': JSON.stringify({
    'week-lifts-2026-11-09': { 0: 'Push', 1: 'Pull', 2: 'None', 3: 'Legs', 4: 'None', 5: 'None', 6: 'None' },
    'week-activities-2026-11-09': { 0: ['bend-full'], 1: [], 2: ['run'], 3: [], 4: [], 5: [], 6: ['meditate'] },
    'lift-2026-11-09-0-Incline Bench': { weight: 140, grid: [[true, true, true, true, true, true, true, true]], prescribedSets: 4, prescribedReps: 8 },
    '2026-11-09-0-item-lift-Push': true,
    '2026-11-09-0-item-bend-full': true,
    '2026-11-09-2-custom': [{ id: 1, label: 'Sauna', done: true }],
  }),
  'exercise-config-v1': JSON.stringify({ 'Incline Bench': { sets: 4, reps: 8, w: 140, inc: 5, bw: false, rest: 90 } }),
  'nutrition-v1': JSON.stringify({ sex: 'm', age: 30, ft: 5, inches: 10, weight: 180, goalWeight: 175, startWeight: 185, activity: 'moderate', goal: 'cut', weightKg: 81.6, heightCm: 177.8 }),
  'weight-log-v1': JSON.stringify([{ date: '2026-11-08', weight: 181.2 }, { date: '2026-11-09', weight: 180.8 }]),
  'ui-prefs-v1': JSON.stringify({ hideNutrition: false }),
};
const seedTracker = () => { for (const [k, v] of Object.entries(TRACKER)) localStorage.setItem(k, v); };
const trackerSnapshot = () => Object.fromEntries(Object.keys(TRACKER).map(k => [k, localStorage.getItem(k)]));

beforeEach(() => { localStorage.clear(); resetCache(); });

describe('existing lift-tracker data is never touched', () => {
  it('survives every stretching storage operation byte for byte', () => {
    seedTracker();
    getState();                                   // first load of the new section
    setState(sample());                           // saving sessions, routines, settings
    update(s => ({ ...s, recent: ['morning-mobility'] }));
    localStorage.setItem(SESSION_KEY, '{"x":1}'); // an in-progress session
    expect(trackerSnapshot()).toEqual(TRACKER);
    clearMobilityData();                          // "Delete stretching data"
    expect(trackerSnapshot()).toEqual(TRACKER);
    expect(localStorage.getItem(MOBILITY_KEY)).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('uses only its own two storage keys', () => {
    setState(sample());
    localStorage.setItem(SESSION_KEY, '{}');
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).sort();
    expect(keys).toEqual([SESSION_KEY, MOBILITY_KEY].sort());
  });

  it('still loads the tracker data exactly as before', () => {
    seedTracker();
    setState(sample());
    expect(loadData()).toEqual(JSON.parse(TRACKER['workout-tracker-v6']));
    expect(loadConfigs()).toEqual(JSON.parse(TRACKER['exercise-config-v1']));
    expect(loadNutrProfile()).toEqual(JSON.parse(TRACKER['nutrition-v1']));
    expect(loadWeightLog()).toEqual(JSON.parse(TRACKER['weight-log-v1']));
    expect(loadUIPrefs()).toEqual(JSON.parse(TRACKER['ui-prefs-v1']));
  });

  it('puts both the tracker data and the stretching data in one backup file', () => {
    seedTracker();
    setState(sample());
    const full = JSON.parse(JSON.stringify(buildFullBackup(new Date('2026-11-10T10:00:00Z'))));
    expect(full.checklist).toEqual(JSON.parse(TRACKER['workout-tracker-v6']));
    expect(full.weightLog).toHaveLength(2);
    expect(full.version).toBe(9);
    const check = validateBackup(full);
    expect(check.ok).toBe(true);
    expect(check.state).toEqual(sample());
    expect(trackerSnapshot()).toEqual(TRACKER);   // exporting changes nothing
  });
});

describe('stretching backup and restore', () => {
  it('restores exactly what was exported', () => {
    const file = JSON.parse(JSON.stringify(exportMobility(sample())));
    const check = validateBackup(file);
    expect(check.ok).toBe(true);
    expect(check.state).toEqual(sample());
    expect(check.summary).toMatchObject({ routines: 1, sessions: 1, reminders: 1, warnings: [] });
    setState(check.state!);
    resetCache();
    expect(getState()).toEqual(sample());         // survives a reload
  });

  it('rejects files that are not backups, and newer schemas', () => {
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup([1, 2]).ok).toBe(false);
    expect(validateBackup({ checklist: {} }).ok).toBe(false);
    expect(validateBackup({ app: 'ftracker-mobility', schema: 99, data: {} }).ok).toBe(false);
  });

  it('drops damaged entries and dangling references instead of failing or corrupting', () => {
    const s = sample() as any;
    s.customRoutines[0].items.push({ ex: 'not-a-real-exercise', dose: 30 }, { ex: 'lunge', dose: -5 });
    s.customRoutines.push({ id: 'custom-2', name: 'Broken', items: [{ ex: 'nope', dose: 10 }] });
    s.history.push({ id: 's2', dateKey: '2026-13-45', activeSec: 10, startedAt: 'x' }, { ...s.history[0] });
    s.favorites.routines.push('custom-2', 'gone');
    s.favorites.exercises.push('nope');
    s.reminders.push({ id: 'r2', title: 'x', time: '08:00', days: [0], enabled: true, routineId: 'custom-2' });
    const check = validateBackup(JSON.parse(JSON.stringify(exportMobility(s))));
    expect(check.ok).toBe(true);
    expect(check.state!.customRoutines).toHaveLength(1);
    expect(check.state!.customRoutines[0].items.map(i => i.ex)).toEqual(['lunge', 'butterfly']);
    expect(check.state!.history).toHaveLength(1);
    expect(check.state!.favorites).toEqual({ routines: ['custom-1', 'morning-mobility'], exercises: ['pigeon'] });
    expect(check.state!.reminders[1].routineId).toBeUndefined();
    expect(check.summary!.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('fills defaults for anything missing and never throws on junk', () => {
    for (const junk of [undefined, null, 5, 'x', [], { settings: 7, history: 'no', favorites: [] }]) {
      expect(normalizeState(junk)).toEqual(defaultState());
    }
    const partial = normalizeState({ settings: { prepSec: 10, volume: 'loud', cautions: ['wrists'] } });
    expect(partial.settings.prepSec).toBe(10);
    expect(partial.settings.volume).toBe(0.7);
    expect(partial.settings.cautions).toEqual(['wrists']);
  });

  it('round-trips a routine file and gives the copy a new id', () => {
    const r = sample().customRoutines[0];
    const res = validateRoutineFile(JSON.parse(JSON.stringify(exportRoutineFile(r))));
    expect(res.ok).toBe(true);
    expect(res.routine!.id).not.toBe(r.id);
    expect(res.routine).toMatchObject({ name: r.name, items: r.items, cover: r.cover });
    expect(validateRoutineFile({ type: 'something-else' }).ok).toBe(false);
    expect(validateRoutineFile({ type: 'mobility-routine', routine: { name: 'x', items: [{ ex: 'nope', dose: 3 }] } }).ok).toBe(false);
  });

  it('writes history as CSV with quoting', () => {
    const csv = historyCsv(sample().history);
    const [head, row] = csv.trim().split('\n');
    expect(head.split(',')).toHaveLength(12);
    expect(row).toContain('2026-11-09,2026-11-09T18:00:00.000Z,Europe/Berlin,My hips,300,2,0,2,session,no,3,');
    expect(row).toContain('"tight, ""left"" side"');
  });
});
