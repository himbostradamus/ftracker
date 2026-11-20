import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../mobility.css';
import { getState, update, useMobility, uid } from '../lib/store';
import { createSession, PlayerState, start } from '../lib/player';
import { loadSession, saveSession } from '../lib/session';
import { findRoutine, timingOf } from '../lib/routines';
import { dueReminders, Due, markFired, showSystemNotification } from '../lib/reminders';
import { unlockAudio } from '../lib/audio';
import { Btn, Nav, Screen } from './common';
import { Today } from './Today';
import { Library } from './Library';
import { Create } from './Create';
import { Progress } from './Progress';
import { SettingsView } from './SettingsView';
import { ExerciseDetail, RoutineDetail, SeriesView } from './Details';
import { Builder } from './Builder';
import { Player } from './Player';
import { t } from '../i18n';
import { Routine } from '../types';

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'library', label: 'Library' },
  { id: 'create', label: 'Create' },
  { id: 'settings', label: 'Settings' },
] as const;

export default function MobilityApp({ initialRoutine, progress = false }: { initialRoutine?: string; progress?: boolean }) {
  const st = useMobility();
  const s = st.settings;
  const [tab, setTab] = useState<string>('today');
  const [stack, setStack] = useState<Screen[]>(() => initialRoutine ? [{ type: 'routine', id: initialRoutine }] : []);
  const [session, setSession] = useState<PlayerState | null>(() => loadSession());
  const [playing, setPlaying] = useState(false);
  const [toast, setToast] = useState<{ text: string; undo?: () => void; key: number } | null>(null);
  const [due, setDue] = useState<Due[]>([]);
  const toastTimer = useRef(0);

  // In-app reminders, checked while the app is open.
  useEffect(() => {
    const check = () => {
      const cur = getState();
      const list = dueReminders(cur, new Date());
      if (!list.length) return;
      update(x => markFired(x, list.map(d => d.id), new Date()));
      setDue(d => [...d, ...list]);
      if (cur.settings.notifications) list.forEach(d => void showSystemNotification(t(d.title), t('Open the app to start.'), d.id));
    };
    check();
    const id = window.setInterval(check, 30000);
    document.addEventListener('visibilitychange', check);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', check); };
  }, []);

  const showToast = useCallback((text: string, undo?: () => void) => {
    window.clearTimeout(toastTimer.current);
    setToast({ text, undo, key: Date.now() });
    toastTimer.current = window.setTimeout(() => setToast(null), undo ? 7000 : 3500);
  }, []);

  const nav: Nav = useMemo(() => ({
    push: sc => { setStack(x => [...x, sc]); window.scrollTo(0, 0); },
    pop: () => setStack(x => x.slice(0, -1)),
    start: (r: Routine) => {
      unlockAudio();
      const now = Date.now();
      const fresh = start(createSession(r, timingOf(getState().settings), now, `s-${uid()}`), now);
      if (fresh.finished) { showToast(t('This routine has no movements.')); return; }
      saveSession(fresh); setSession(fresh); setPlaying(true);
    },
    toast: showToast,
    goTab: id => { setStack([]); setTab(id); window.scrollTo(0, 0); },
  }), [showToast]);

  const top = stack[stack.length - 1];
  let body: React.ReactNode;
  if (top?.type === 'routine') body = <RoutineDetail key={top.id} id={top.id} given={top.routine} nav={nav} />;
  else if (top?.type === 'exercise') body = <ExerciseDetail key={top.id} id={top.id} nav={nav} />;
  else if (top?.type === 'builder') body = <Builder key={top.routine?.id ?? 'new'} initial={top.routine} nav={nav} />;
  else if (top?.type === 'series') body = <SeriesView key={top.id} id={top.id} nav={nav} />;
  else if (tab === 'library') body = <Library nav={nav} />;
  else if (tab === 'create') body = <Create nav={nav} />;
  else if (progress) body = <Progress nav={nav} />;
  else if (tab === 'settings') body = <SettingsView nav={nav} />;
  else body = <Today nav={nav} unfinished={session && !playing ? session : null} onResume={() => { unlockAudio(); setPlaying(true); }} onDiscard={() => { saveSession(null); setSession(null); }} />;

  const hideNav = progress || top?.type === 'builder';
  return (
    <div className="mob" data-rm={s.reduceMotion === 'on' ? 'on' : 'off'}>
      <a href="#mob-main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-m-surface focus:p-2">{t('Skip to content')}</a>
      {!hideNav && <nav aria-label={t('Stretching sections')} className="stretch-tabs">
        {TABS.map(({ id, label }) => (
          <button type="button" key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => nav.goTab(id)}>{t(label)}</button>
        ))}
      </nav>}
      <main id="mob-main">
        <div>
          {due.length > 0 && (
            <div className="m-card p-4 mb-4" role="status">
              {due.map(d => {
                const r = findRoutine(d.routineId, st);
                return (
                  <div key={d.id} className="flex items-center gap-3 py-1">
                    <p className="flex-1 font-semibold">{t(d.title)}</p>
                    {r && <Btn onClick={() => { setDue(x => x.filter(y => y.id !== d.id)); nav.push({ type: 'routine', id: r.id }); }}>{r.name}</Btn>}
                    <Btn kind="ghost" onClick={() => setDue(x => x.filter(y => y.id !== d.id))}>{t('Dismiss')}</Btn>
                  </div>
                );
              })}
            </div>
          )}
          {body}
        </div>
      </main>

      {playing && session && <Player session={session} setSession={setSession} onClose={() => setPlaying(false)} />}

      {toast && (
        <div key={toast.key} role="status" className="m-fade fixed z-[60] left-1/2 -translate-x-1/2 bottom-[calc(84px+env(safe-area-inset-bottom))] md:bottom-6 flex items-center gap-3 rounded-xl bg-m-text text-m-canvas px-4 py-2.5 shadow-lg max-w-[92vw]">
          <span>{toast.text}</span>
          {toast.undo && <button type="button" className="font-bold underline underline-offset-2 min-h-[36px]" onClick={() => { toast.undo!(); setToast(null); }}>{t('Undo')}</button>}
        </div>
      )}
    </div>
  );
}
