import React, { useState } from 'react';
import { Play, RotateCcw } from 'lucide-react';
import { useMobility } from '../lib/store';
import { ROUTINES, SERIES, SERIES_BY_ID } from '../data/routines';
import { allRoutines, findRoutine, recommend, timingOf, withinLevel } from '../lib/routines';
import { routineAreas, routineTotals } from '../lib/timeline';
import { dateKeyInTz, diffDays, formatDateKey, resolveTz } from '../lib/dates';
import { activeDays, streaks } from '../lib/stats';
import { Art, Btn, Chip, durationText, Nav, RoutineRow, Section } from './common';
import { AREA_LABEL, DIFFICULTY_LABEL, t } from '../i18n';
import { PlayerState } from '../lib/player';
import { Area } from '../types';

const BROWSE_AREAS: Area[] = ['neck', 'shoulders', 'chest', 'upper-back', 'lower-back', 'hips', 'hamstrings', 'quads', 'core', 'calves', 'feet'];

export function Today({ nav, unfinished, onResume, onDiscard }: { nav: Nav; unfinished: PlayerState | null; onResume: () => void; onDiscard: () => void }) {
  const st = useMobility();
  const now = new Date();
  const tz = resolveTz(st.settings.timezone);
  const today = dateKeyInTz(now, tz);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: tz }).format(now));
  const rec = recommend(st, hour, today);
  const [useAlt, setUseAlt] = useState(false);
  const routine = useAlt && rec.alternative ? rec.alternative : rec.routine;
  const [area, setArea] = useState<Area | null>(null);

  const days = activeDays(st.history, st.settings.dayThresholdMin);
  const streak = streaks(days, today);
  const doneToday = days.has(today);
  const favs = st.favorites.routines.map(id => findRoutine(id, st)).filter(Boolean).slice(0, 3) as ReturnType<typeof allRoutines>;
  const recents = st.recent.map(id => findRoutine(id, st)).filter(r => r && !st.favorites.routines.includes(r.id)).slice(0, 3) as ReturnType<typeof allRoutines>;
  const areaRoutines = area
    ? ROUTINES.filter(r => routineAreas(r)[0] === area || (r.family === 'target' && routineAreas(r).slice(0, 2).includes(area)))
        .filter(r => withinLevel(r.difficulty, st.settings.level)).slice(0, 6)
    : [];
  const backupDue = st.settings.backupReminder && st.history.length >= 3 &&
    (!st.settings.lastBackupAt || diffDays(today, st.settings.lastBackupAt.slice(0, 10)) >= 30);

  return (
    <div className="m-fade">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-m-muted">{formatDateKey(today, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className="text-[1.6rem] font-bold leading-tight">{t('Today')}</h1>
        </div>
        <p className="text-sm text-m-muted text-right pt-1">
          {streak.current > 0 ? t('{n}-day streak', { n: streak.current }) : t('No streak yet')}<br />
          {doneToday ? t('Done today ✓') : t('Not yet today')}
        </p>
      </header>

      {unfinished && (
        <div className="m-card p-4 mb-4 flex items-center gap-3" role="region" aria-label={t('Unfinished session')}>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{t('Unfinished session')}</p>
            <p className="text-sm text-m-muted truncate">{unfinished.routineName}</p>
          </div>
          <Btn kind="ghost" onClick={onDiscard}>{t('Discard')}</Btn>
          <Btn onClick={onResume}><RotateCcw size={18} />{t('Resume')}</Btn>
        </div>
      )}

      <div className="m-card p-5 mb-3">
        <p className="text-sm text-m-muted mb-1">{useAlt ? t('Alternative') : t(rec.reason)}</p>
        <h2 className="text-[1.35rem] font-bold leading-tight">{routine.name}</h2>
        <p className="text-m-muted mt-0.5">
          {durationText(routine, st.settings)} · {t('{n} movements', { n: routine.items.length })} · {t(DIFFICULTY_LABEL[routine.difficulty])}
        </p>
        <div className="flex -space-x-3 my-4" aria-hidden="true">
          {routine.items.slice(0, 5).map((it, i) => <Art key={i} id={it.ex} size={64} className="rounded-full ring-2 ring-m-surface" />)}
          {routine.items.length > 5 && <span className="grid h-16 w-16 place-items-center rounded-full bg-m-soft ring-2 ring-m-surface text-sm font-semibold text-m-muted">+{routine.items.length - 5}</span>}
        </div>
        <div className="flex gap-2">
          <Btn className="flex-1 text-base py-3" onClick={() => nav.start(routine)}><Play size={18} fill="currentColor" />{t('Start')}</Btn>
          <Btn kind="secondary" onClick={() => nav.push({ type: 'routine', id: routine.id })}>{t('Details')}</Btn>
        </div>
      </div>
      {rec.alternative && (
        <p className="mb-6 text-sm">
          <button type="button" className="text-m-accent font-medium underline underline-offset-2 min-h-[40px]" onClick={() => setUseAlt(!useAlt)}>
            {useAlt ? t('Back to the suggestion: {name}', { name: rec.routine.name }) : t('Something else: {name}', { name: rec.alternative.name })}
          </button>
        </p>
      )}

      {backupDue && (
        <div className="m-card p-4 mb-6 flex items-center gap-3">
          <p className="flex-1 text-sm">{t('Your history is stored only in this browser. It has been a while since the last backup file.')}</p>
          <Btn kind="secondary" onClick={() => nav.goTab('settings')}>{t('Back up')}</Btn>
        </div>
      )}

      <Section title={t('Browse by area')}>
        <div className="m-scroll-x flex gap-2 pb-1 -mx-4 px-4">
          {BROWSE_AREAS.map(a => <Chip key={a} on={area === a} onClick={() => setArea(area === a ? null : a)}>{t(AREA_LABEL[a])}</Chip>)}
        </div>
        {area && (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {areaRoutines.map(r => <RoutineRow key={r.id} routine={r} settings={st.settings} onOpen={() => nav.push({ type: 'routine', id: r.id })} />)}
            {areaRoutines.length === 0 && <p className="text-m-muted">{t('No routines at your level for this area. Raise the level in Settings to see more.')}</p>}
          </div>
        )}
      </Section>

      {st.series && SERIES_BY_ID[st.series.seriesId] && (
        <Section title={SERIES_BY_ID[st.series.seriesId].name} action={<button type="button" className="text-sm font-medium text-m-accent min-h-[40px]" onClick={() => nav.push({ type: 'series', id: st.series!.seriesId })}>{t('Schedule')}</button>}>
          <p className="text-sm text-m-muted">
            {t('{done} of {total} days done', { done: st.series.days.filter(d => d.sessionId).length, total: st.series.days.filter(d => d.routine).length })}
          </p>
        </Section>
      )}

      {favs.length > 0 && (
        <Section title={t('Favorites')}>
          <div className="grid gap-2 md:grid-cols-2">{favs.map(r => <RoutineRow key={r.id} routine={r} settings={st.settings} onOpen={() => nav.push({ type: 'routine', id: r.id })} />)}</div>
        </Section>
      )}
      {recents.length > 0 && (
        <Section title={t('Recently used')}>
          <div className="grid gap-2 md:grid-cols-2">{recents.map(r => <RoutineRow key={r.id} routine={r} settings={st.settings} onOpen={() => nav.push({ type: 'routine', id: r.id })} />)}</div>
        </Section>
      )}

      {!st.series && (
        <Section title={t('Weekly series')}>
          <div className="grid gap-2 md:grid-cols-2">
            {SERIES.filter(s => withinLevel(s.difficulty, st.settings.level)).slice(0, 4).map(s => (
              <button key={s.id} type="button" onClick={() => nav.push({ type: 'series', id: s.id })} className="m-card p-3.5 text-left min-h-[64px]">
                <span className="block font-semibold">{s.name}</span>
                <span className="block text-sm text-m-muted">{s.purpose}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      <p className="text-sm text-m-muted">
        <button type="button" className="underline underline-offset-2 min-h-[40px]" onClick={nav.exitToTracker}>{t('Open the training tracker')}</button>
      </p>
    </div>
  );
}
