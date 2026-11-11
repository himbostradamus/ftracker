import { Caution, Difficulty, Exercise, MobilityState, Routine, Settings } from '../types';
import { EX, EXERCISES } from '../data/catalog';
import { ROUTINES, ROUTINE_BY_ID, SERIES_BY_ID } from '../data/routines';
import { TimingOpts } from './timeline';
import { addDays } from './dates';
import { uid } from './store';

export const timingOf = (s: Settings): TimingOpts => ({ prepSec: s.prepSec, transitionSec: s.transitionSec, switchSec: s.switchSec });
export const allRoutines = (st: MobilityState): Routine[] => [...st.customRoutines, ...ROUTINES];
export const findRoutine = (id: string | null | undefined, st: MobilityState): Routine | undefined =>
  id ? st.customRoutines.find(r => r.id === id) ?? ROUTINE_BY_ID[id] : undefined;

const RANK: Record<Difficulty, number> = { beginner: 0, intermediate: 1, advanced: 2 };
export const withinLevel = (d: Difficulty, level: Difficulty) => RANK[d] <= RANK[level];

// Movements in a routine that touch one of the person's avoid preferences.
export function conflicts(r: Pick<Routine, 'items'>, cautions: Caution[]): { ex: Exercise; flags: Caution[] }[] {
  const seen = new Set<string>();
  const out: { ex: Exercise; flags: Caution[] }[] = [];
  for (const it of r.items) {
    const ex = EX[it.ex];
    if (!ex || seen.has(ex.id)) continue;
    const flags = ex.flags.filter(f => cautions.includes(f));
    if (flags.length) { seen.add(ex.id); out.push({ ex, flags }); }
  }
  return out;
}

// The closest movement that avoids the flagged preferences, or null.
export function alternativeFor(ex: Exercise, cautions: Caution[], level: Difficulty): Exercise | null {
  const ok = (e: Exercise) => e.id !== ex.id && !e.flags.some(f => cautions.includes(f)) && withinLevel(e.difficulty, level);
  const score = (e: Exercise) =>
    e.primary.filter(a => ex.primary.includes(a)).length * 3 + (e.category === ex.category ? 2 : 0) +
    (ex.related.includes(e.id) ? 2 : 0) + (e.sides === ex.sides ? 1 : 0) + (e.unit === ex.unit ? 1 : 0);
  const best = EXERCISES.filter(ok).map(e => [score(e), e] as const).filter(x => x[0] >= 3).sort((a, b) => b[0] - a[0] || (a[1].id < b[1].id ? -1 : 1))[0];
  return best ? best[1] : null;
}

export function adaptedCopy(r: Routine, cautions: Caution[], level: Difficulty): { routine: Routine; swapped: number; removed: number } {
  let swapped = 0, removed = 0;
  const items = r.items.flatMap(it => {
    const ex = EX[it.ex];
    if (!ex || !ex.flags.some(f => cautions.includes(f))) return [it];
    const alt = alternativeFor(ex, cautions, level);
    if (!alt) { removed++; return []; }
    swapped++;
    return [{ ...it, ex: alt.id, dose: alt.unit === ex.unit ? it.dose : alt.dose, unit: undefined }];
  });
  return { routine: customCopy({ ...r, items }, `${r.name} (adapted)`), swapped, removed };
}

export function customCopy(r: Routine, name = `${r.name} (copy)`): Routine {
  const now = new Date().toISOString();
  return {
    id: `custom-${uid()}`, name, purpose: r.purpose, family: 'mixed', difficulty: r.difficulty,
    items: r.items.map(i => ({ ...i })), custom: true, cover: r.cover ? { ...r.cover } : undefined,
    createdAt: now, updatedAt: now,
  };
}

export const routineDifficulty = (items: { ex: string }[]): Difficulty =>
  items.reduce<Difficulty>((d, it) => (EX[it.ex] && RANK[EX[it.ex].difficulty] > RANK[d] ? EX[it.ex].difficulty : d), 'beginner');

const suitable = (r: Routine, st: MobilityState) =>
  withinLevel(r.difficulty, st.settings.level) && conflicts(r, st.settings.cautions).length === 0;

export type DayPart = 'morning' | 'midday' | 'evening';
export const dayPart = (hour: number): DayPart => (hour < 11 ? 'morning' : hour < 17 ? 'midday' : 'evening');

// Today's suggestion: the active series' day if there is one, otherwise a
// daily routine that fits the time of day, level and avoid preferences.
export function recommend(st: MobilityState, hour: number, today: string): { routine: Routine; reason: string; alternative?: Routine } {
  const part = dayPart(hour);
  const pick = (ids: string[]) => ids.map(id => ROUTINE_BY_ID[id]).filter(r => r && suitable(r, st));
  const byPart: Record<DayPart, string[]> = {
    morning: ['morning-mobility', 'standing-wake-up', 'quick-stretch', 'two-minute-reset'],
    midday: ['midday-reset', 'standing-desk', 'seated-desk', 'floor-free-break', 'two-minute-reset'],
    evening: ['evening-wind-down', 'before-bed', 'full-body-stretch', 'quick-stretch', 'two-minute-reset'],
  };
  const options = pick(byPart[part]);
  const fallback = ROUTINES.find(r => suitable(r, st)) ?? ROUTINE_BY_ID['two-minute-reset'];
  const timed = options[0] ?? fallback;
  const reason = { morning: 'Suggested for the morning', midday: 'Suggested for the middle of the day', evening: 'Suggested for the evening' }[part];

  const day = st.series?.days.find(d => d.date === today && d.routine && !d.sessionId);
  const seriesRoutine = day ? findRoutine(day.routine, st) : undefined;
  if (seriesRoutine && st.series) {
    return { routine: seriesRoutine, reason: `Today in ${SERIES_BY_ID[st.series.seriesId]?.name ?? 'your series'}`, alternative: timed };
  }
  return { routine: timed, reason, alternative: options[1] ?? (fallback.id !== timed.id ? fallback : undefined) };
}

export function startSeries(seriesId: string, today: string) {
  const s = SERIES_BY_ID[seriesId];
  return { seriesId, startedAt: new Date().toISOString(), days: s.days.map((d, i) => ({ date: addDays(today, i), routine: d.routine })) };
}

export function coverOf(r: Routine): { color: string; ex: string; image?: string } {
  const palette = ['#DDE9E0', '#F3E3C3', '#F0D5CB', '#F1DCE2', '#D9E8EE', '#E3E6D8'];
  let h = 0; for (const c of r.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { color: r.cover?.color ?? palette[h % palette.length], ex: r.cover?.ex ?? r.items[Math.min(1, r.items.length - 1)]?.ex ?? r.items[0]?.ex, image: r.cover?.image };
}
