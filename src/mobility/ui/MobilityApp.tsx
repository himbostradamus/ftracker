import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, CalendarDays, LibraryBig, PlusCircle, Settings as Cog, Dumbbell } from 'lucide-react';
import '../mobility.css';
import { getState, update, updateSettings, useMobility, uid } from '../lib/store';
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
  { id: 'today', label: 'Today', Icon: CalendarDays },
  { id: 'library', label: 'Library', Icon: LibraryBig },
  { id: 'create', label: 'Create', Icon: PlusCircle },
  { id: 'progress', label: 'Progress', Icon: BarChart3 },
  { id: 'settings', label: 'Settings', Icon: Cog },
] as const;

export default function MobilityApp({ onExit }: { onExit: () => void }) {
  const st = useMobility();
  const s = st.settings;
  const [tab, setTab] = useState<string>('today');
  const [stack, setStack] = useState<Screen[]>([]);
  const [session, setSession] = useState<PlayerState | null>(() => loadSession());
  const [playing, setPlaying] = useState(false);
  const [toast, setToast] = useState<{ text: string; undo?: () => void; key: number } | null>(null);
  const [due, setDue] = useState<Due[]>([]);
  const [sysDark, setSysDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const toastTimer = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const h = (e: MediaQueryListEvent) => setSysDark(e.matches);
    mq?.addEventListener?.('change', h);
    return () => mq?.removeEventListener?.('change', h);
  }, []);
  const dark = s.appearance === 'dark' || (s.appearance === 'system' && sysDark);

  // The page behind the app (overscroll, status bar) follows the theme, and
  // text scaling applies to the root so every rem-based size grows with it.
  useEffect(() => {
    const root = document.documentElement, meta = document.querySelector('meta[name="theme-color"]');
    const prevBg = document.body.style.background, prevMeta = meta?.getAttribute('content') ?? '', prevSize = root.style.fontSize;
    const bg = dark ? '#151614' : '#FAFAF8';
    document.body.style.background = bg; root.style.background = bg;
    meta?.setAttribute('content', bg);
    root.style.fontSize = { normal: '100%', large: '112.5%', larger: '125%' }[s.textSize];
    return () => { document.body.style.background = prevBg; root.style.background = ''; meta?.setAttribute('content', prevMeta); root.style.fontSize = prevSize; };
  }, [dark, s.textSize]);

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
    exitToTracker: () => { updateSettings({ lastSection: 'tracker' }); onExit(); },
  }), [onExit, showToast]);

  const top = stack[stack.length - 1];
  let body: React.ReactNode;
  if (top?.type === 'routine') body = <RoutineDetail key={top.id} id={top.id} given={top.routine} nav={nav} />;
  else if (top?.type === 'exercise') body = <ExerciseDetail key={top.id} id={top.id} nav={nav} />;
  else if (top?.type === 'builder') body = <Builder key={top.routine?.id ?? 'new'} initial={top.routine} nav={nav} />;
  else if (top?.type === 'series') body = <SeriesView key={top.id} id={top.id} nav={nav} />;
  else if (tab === 'library') body = <Library nav={nav} />;
  else if (tab === 'create') body = <Create nav={nav} />;
  else if (tab === 'progress') body = <Progress nav={nav} />;
  else if (tab === 'settings') body = <SettingsView nav={nav} />;
  else body = <Today nav={nav} unfinished={session && !playing ? session : null} onResume={() => { unlockAudio(); setPlaying(true); }} onDiscard={() => { saveSession(null); setSession(null); }} />;

  const hideNav = top?.type === 'builder';
  return (
    <div className="mob min-h-screen" data-theme={dark ? 'dark' : 'light'} data-rm={s.reduceMotion === 'on' ? 'on' : 'off'}>
      <a href="#mob-main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-m-surface focus:p-2">{t('Skip to content')}</a>
      <nav aria-label={t('Stretching sections')} className={`fixed z-30 bg-m-surface border-m-line bottom-0 inset-x-0 border-t pb-[env(safe-area-inset-bottom)] md:inset-y-0 md:right-auto md:w-56 md:border-t-0 md:border-r md:pb-0 md:pt-6 ${hideNav ? 'hidden md:block' : ''}`}>
        <p className="hidden md:block px-6 pb-4 text-lg font-bold">{t('Stretch')}</p>
        <ul className="flex md:flex-col md:gap-1 md:px-3">
          {TABS.map(({ id, label, Icon }) => {
            const on = tab === id;
            return (
              <li key={id} className="flex-1 md:flex-none">
                <button type="button" aria-current={on ? 'page' : undefined} onClick={() => nav.goTab(id)}
                  className={`flex w-full flex-col md:flex-row items-center gap-0.5 md:gap-3 py-2 md:px-3 md:py-2.5 md:rounded-xl min-h-[56px] md:min-h-[44px] text-[0.72rem] md:text-[0.95rem] ${on ? 'text-m-accent font-bold md:bg-m-soft' : 'text-m-muted font-medium'}`}>
                  <Icon size={22} strokeWidth={on ? 2.4 : 1.8} aria-hidden="true" />
                  <span className={on ? 'underline underline-offset-4 md:no-underline' : ''}>{t(label)}</span>
                </button>
              </li>
            );
          })}
          <li className="hidden md:block mt-4 border-t border-m-line pt-3">
            <button type="button" onClick={nav.exitToTracker} className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-m-muted font-medium min-h-[44px]"><Dumbbell size={22} strokeWidth={1.8} aria-hidden="true" />{t('Training tracker')}</button>
          </li>
        </ul>
      </nav>

      <main id="mob-main" className="mx-auto max-w-3xl px-4 pt-[max(16px,env(safe-area-inset-top))] pb-28 md:pb-10 md:pl-[15.5rem] md:pr-6 md:max-w-none">
        <div className="mx-auto max-w-3xl">
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
