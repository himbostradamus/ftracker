import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Info, Pause, Play, RotateCcw, Volume2, VolumeX, X } from 'lucide-react';
import * as P from '../lib/player';
import { EX } from '../data/catalog';
import { updateSettings, useMobility } from '../lib/store';
import { recordSession, saveSession } from '../lib/session';
import { audioReady, audioSupported, playSound, releaseWake, requestWake, speak, speechSupported, stopSpeech, unlockAudio, wakeLockSupported } from '../lib/audio';
import { fmtDuration } from '../lib/dates';
import { Art, Btn, IconBtn, Sheet, Toggle, inputCls } from './common';
import { ExerciseBody } from './Details';
import { t } from '../i18n';

const SIDE_TEXT: Record<string, string> = { left: 'Left side', right: 'Right side', alternate: 'Alternating sides', both: '' };

export function Player({ session, setSession, onClose }: { session: P.PlayerState; setSession: (s: P.PlayerState | null) => void; onClose: () => void }) {
  const st = useMobility();
  const set = st.settings;
  const ref = useRef(session);
  ref.current = session;
  const settingsRef = useRef(set);
  settingsRef.current = set;
  const [, force] = useState(0);
  const [info, setInfo] = useState(false);
  const [sound, setSound] = useState(false);
  const [ending, setEnding] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [awake, setAwake] = useState<boolean | null>(null);
  const resumeAfterInfo = useRef(false);
  const lastSave = useRef(0);
  const closed = useRef(false);

  const commit = useCallback((s: P.PlayerState, persist = true) => {
    ref.current = s;
    setSession(s);
    if (persist) { saveSession(s); lastSave.current = Date.now(); }
  }, [setSession]);

  const handleCues = useCallback((cues: P.Cue[], s: P.PlayerState) => {
    const o = settingsRef.current;
    for (const c of cues) {
      if (c.type === 'count') { if (o.sounds) playSound('count', o.volume); continue; }
      if (c.type === 'finish') { if (o.sounds) playSound('finish', o.volume); setAnnounce(t('Session complete')); continue; }
      const ex = EX[s.items[c.seg.item].ex];
      if (c.seg.kind === 'work') {
        if (o.sounds) playSound('start', o.volume);
        const side = t(SIDE_TEXT[c.seg.side]);
        if (o.speakSides && (c.seg.side === 'left' || c.seg.side === 'right')) speak(side, o.volume);
        setAnnounce(`${ex.name}${side ? `, ${side}` : ''}`);
      } else {
        if (o.sounds) playSound('change', o.volume);
        if (c.seg.kind === 'switch') { if (o.speakSides) speak(t('Switch sides'), o.volume); setAnnounce(t('Switch sides')); }
        else { if (o.speakNames) speak(t('Next: {name}', { name: ex.name }), o.volume); setAnnounce(t('Next: {name}', { name: ex.name })); }
      }
    }
  }, []);

  // The clock. Position is always derived from timestamps, so a late
  // callback only delays the display, never the session.
  useEffect(() => {
    const step = () => {
      const cur = ref.current;
      if (!cur.running) return;
      const { state, cues } = P.tick(cur, Date.now());
      const structural = state.idx !== cur.idx || state.finished !== cur.finished || !!state.interrupted !== !!cur.interrupted;
      ref.current = state;
      if (structural) commit(state);
      else {
        if (Date.now() - lastSave.current > 1000) { saveSession(state); lastSave.current = Date.now(); }
        force(n => n + 1);
      }
      if (cues.length) handleCues(cues, state);
    };
    const id = window.setInterval(step, 200);
    const onVis = () => {
      if (document.visibilityState === 'hidden') saveSession(ref.current);
      else { step(); if (ref.current.running && settingsRef.current.keepAwake) void requestWake().then(setAwake); }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onVis);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', onVis); if (!closed.current) { setSession(ref.current); saveSession(ref.current); } };
  }, [commit, handleCues, setSession]);

  useEffect(() => {
    if (session.running && set.keepAwake) void requestWake().then(setAwake);
    else releaseWake();
    return () => { releaseWake(); };
  }, [session.running, set.keepAwake]);
  useEffect(() => () => stopSpeech(), []);

  const now = () => Date.now();
  const act = (fn: (s: P.PlayerState, n: number) => P.PlayerState) => { unlockAudio(); commit(fn(ref.current, now())); };
  const begin = () => {
    unlockAudio();
    const s = ref.current;
    const first = s.idx === 0 && s.elapsedMs === 0;
    commit(P.start(s, now()));
    if (first && set.speakNames) speak(EX[s.items[0].ex].name, set.volume);
  };
  const openInfo = () => {
    resumeAfterInfo.current = set.pauseOnInfo && ref.current.running;
    if (resumeAfterInfo.current) commit(P.pause(ref.current, now()));
    setInfo(true);
  };
  const closeInfo = () => {
    setInfo(false);
    if (resumeAfterInfo.current) { resumeAfterInfo.current = false; commit(P.start(ref.current, now())); }
  };

  const s = ref.current;
  if (s.finished) return <Summary session={s} onDone={() => { closed.current = true; saveSession(null); setSession(null); onClose(); }} />;

  const pos = P.position(s);
  const seg = pos.seg;
  const item = s.items[seg.item];
  const ex = EX[item.ex];
  const isWork = seg.kind === 'work';
  const remaining = Math.ceil(pos.remainingMs / 1000);
  const nextItem = s.items[seg.item + 1];
  const phase = seg.kind === 'prep' ? t('Get ready') : seg.kind === 'transition' ? t('Next up') : seg.kind === 'switch' ? t('Switch sides') : t(SIDE_TEXT[seg.side]);
  const notStarted = !s.running && s.idx === 0 && s.elapsedMs === 0;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-m-canvas text-m-text pt-[max(8px,env(safe-area-inset-top))] pb-[max(12px,env(safe-area-inset-bottom))] px-4">
      <div className="flex items-center gap-2">
        <IconBtn label={t('End session')} onClick={() => setEnding(true)}><X size={24} /></IconBtn>
        <div className="flex-1">
          <div className="h-2 rounded-full bg-m-line overflow-hidden" role="progressbar" aria-label={t('Session progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pos.progress * 100)}>
            <div className="h-full bg-m-accent transition-[width] duration-200" style={{ width: `${pos.progress * 100}%` }} />
          </div>
          <p className="text-sm text-m-muted mt-1 text-center">{t('{i} of {n}', { i: seg.item + 1, n: s.items.length })} · {s.routineName}</p>
        </div>
        <IconBtn label={t('Sound options')} onClick={() => setSound(true)}>{set.sounds ? <Volume2 size={22} /> : <VolumeX size={22} />}</IconBtn>
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row items-center justify-center gap-2 md:gap-10">
        <div className="min-h-0 flex-1 md:flex-none w-full md:w-[42vh] max-w-[46vh] grid place-items-center">
          <Art id={ex.id} size="100%" className={`h-auto max-h-full w-auto max-w-full aspect-square ${isWork ? '' : 'opacity-60'}`} />
        </div>
        <div className="text-center md:text-left">
          <p className="text-lg font-semibold text-m-accent min-h-[1.75rem]">
            {phase}{isWork && (seg.side === 'left' || seg.side === 'right') ? <span aria-hidden="true"> {seg.side === 'left' ? '◀' : '▶'}</span> : null}
          </p>
          <h1 className="text-[1.9rem] md:text-[2.4rem] font-bold leading-tight">{ex.name}</h1>
          <p className="text-[5.5rem] md:text-[7rem] font-bold leading-none tabular-nums my-1" role="timer" aria-label={t('{n} seconds remaining', { n: remaining })}>
            {fmtDuration(remaining)}
          </p>
          <p className="text-lg text-m-muted min-h-[1.75rem]">
            {isWork && seg.reps ? t('{n} repetitions, at your own pace', { n: seg.reps }) + (seg.side === 'alternate' ? ` (${t('total')})` : '')
              : !isWork && seg.kind !== 'switch' ? t('Get into position') : s.running ? '' : t('Paused')}
          </p>
          <p className="text-sm text-m-muted mt-1">{nextItem && EX[nextItem.ex] ? t('Then: {name}', { name: EX[nextItem.ex].name }) : t('Last movement')}</p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 md:gap-4 mt-2">
        <IconBtn label={t('Previous movement')} onClick={() => act(P.previous)} className="h-14 w-14 border border-m-line bg-m-surface"><ChevronLeft size={26} /></IconBtn>
        <IconBtn label={t('Restart this movement')} onClick={() => act(P.restartCurrent)} className="h-14 w-14 border border-m-line bg-m-surface"><RotateCcw size={22} /></IconBtn>
        {s.running ? (
          <button type="button" onClick={() => act(P.pause)} className="h-[72px] w-[72px] rounded-full bg-m-accent text-m-ink grid place-items-center" aria-label={t('Pause')}><Pause size={30} fill="currentColor" /></button>
        ) : (
          <button type="button" onClick={begin} className="h-[72px] w-[72px] rounded-full bg-m-accent text-m-ink grid place-items-center" aria-label={notStarted ? t('Start') : t('Resume')}><Play size={30} fill="currentColor" /></button>
        )}
        <IconBtn label={t('Instructions')} onClick={openInfo} className="h-14 w-14 border border-m-line bg-m-surface"><Info size={22} /></IconBtn>
        <IconBtn label={t('Next movement')} onClick={() => act(P.next)} className="h-14 w-14 border border-m-line bg-m-surface"><ChevronRight size={26} /></IconBtn>
      </div>
      <p className="sr-only" aria-live="polite">{announce}</p>

      {s.interrupted && (
        <Sheet title={t('The timer was interrupted')} onClose={() => commit(P.resolveInterruption(ref.current, 'resume', now()))}>
          <p className="mb-2">{t('The app was in the background or closed for {d}. The timer and its sound cues did not run during that time.', { d: fmtDuration(s.interrupted.gapMs / 1000) })}</p>
          <p className="mb-4 text-m-muted">{t('Choose how to continue.')}</p>
          <div className="grid gap-2">
            <Btn onClick={() => { unlockAudio(); commit(P.resolveInterruption(ref.current, 'resume', now())); }}>{t('Resume where it stopped')}</Btn>
            <Btn kind="secondary" onClick={() => { unlockAudio(); commit(P.resolveInterruption(ref.current, 'elapsed', now())); }}>{t('I kept going: count that time')}</Btn>
            <Btn kind="ghost" onClick={() => commit(P.endSession({ ...ref.current, interrupted: null }, ref.current.lastTick))}>{t('End the session here')}</Btn>
          </div>
        </Sheet>
      )}

      {info && (
        <Sheet title={ex.name} onClose={closeInfo} wide>
          <p className="text-sm text-m-muted mb-3">{resumeAfterInfo.current ? t('The timer is paused while you read and resumes when you close this.') : s.running ? t('The timer is still running.') : t('The timer is paused.')}</p>
          <ExerciseBody id={ex.id} />
        </Sheet>
      )}

      {sound && (
        <Sheet title={t('Sound and screen')} onClose={() => setSound(false)}>
          <Toggle label={t('Sound cues')} hint={t('Beeps for the last three seconds and at each change')} checked={set.sounds} onChange={v => { unlockAudio(); updateSettings({ sounds: v }); }} />
          <Toggle label={t('Speak exercise names')} checked={set.speakNames} onChange={v => updateSettings({ speakNames: v })} />
          <Toggle label={t('Speak side changes')} checked={set.speakSides} onChange={v => updateSettings({ speakSides: v })} />
          {!speechSupported() && <p className="text-sm text-m-muted">{t('This browser has no speech synthesis, so spoken prompts are unavailable.')}</p>}
          <label className="block py-2"><span className="font-medium">{t('Volume')}</span>
            <input type="range" min={0.1} max={1} step={0.1} value={set.volume} onChange={e => updateSettings({ volume: Number(e.target.value) })} className="w-full" />
          </label>
          <Btn kind="secondary" className="w-full mb-3" onClick={() => { unlockAudio(); window.setTimeout(() => playSound('change', set.volume), 60); }}>{t('Test sound')}</Btn>
          <p className="text-sm text-m-muted mb-2">
            {!audioSupported() ? t('This browser cannot play generated sounds.')
              : audioReady() ? t('Sound is ready. Your phone\'s silent switch and volume still apply, and other audio keeps playing.')
              : t('Browsers only allow sound after you tap something. Tap Test sound or any player control once.')}
          </p>
          <p className="text-sm text-m-muted">
            {!set.keepAwake ? t('Keeping the screen awake is turned off in Settings.')
              : !wakeLockSupported() ? t('This browser cannot keep the screen awake. Set a longer auto-lock time on your device if the screen dims.')
              : awake ? t('The screen will stay awake while the timer runs.') : t('The screen is kept awake while the timer runs, when the device allows it.')}
          </p>
        </Sheet>
      )}

      {ending && (
        <Sheet title={t('End this session?')} onClose={() => setEnding(false)}>
          <p className="mb-4 text-m-muted">{t('What you have done so far will be saved to your history.')}</p>
          <div className="grid gap-2">
            <Btn onClick={() => { setEnding(false); commit(P.endSession(ref.current, now())); }}>{t('End and save')}</Btn>
            <Btn kind="secondary" onClick={() => { commit(P.pause(ref.current, now())); setEnding(false); onClose(); }}>{t('Leave it paused for later')}</Btn>
            <Btn kind="ghost" onClick={() => setEnding(false)}>{t('Keep going')}</Btn>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function Summary({ session, onDone }: { session: P.PlayerState; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [effort, setEffort] = useState(0);
  const saved = useRef(false);
  const results = P.itemResults(session);
  const activeSec = Math.round(session.workMs.reduce((a, b) => a + b, 0) / 1000);
  const recorded = activeSec >= 5;

  // Saved as soon as the summary appears, so closing the app here loses
  // nothing. Saving again with a note updates the same entry.
  useEffect(() => { if (!saved.current) { saved.current = true; recordSession(session); } }, [session]);
  const finish = () => { if (recorded && (note.trim() || effort)) recordSession(session, { note: note.trim() || undefined, effort: effort || undefined }); onDone(); };

  const count = (st: string) => results.filter(r => r.status === st).length;
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-m-canvas text-m-text px-4 pt-[max(20px,env(safe-area-inset-top))] pb-[max(20px,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-lg m-fade">
        <h1 className="text-[1.6rem] font-bold">{recorded ? t('Session saved') : t('Nothing to save')}</h1>
        <p className="text-m-muted mb-5">{session.routineName}</p>
        {!recorded && <p className="mb-5">{t('The session ended before any movement was done, so nothing was added to your history.')}</p>}
        {recorded && (
          <>
            <dl className="m-card grid grid-cols-3 text-center p-4 mb-5">
              <div><dt className="text-sm text-m-muted">{t('Active time')}</dt><dd className="text-2xl font-bold tabular-nums">{fmtDuration(activeSec)}</dd></div>
              <div><dt className="text-sm text-m-muted">{t('Completed')}</dt><dd className="text-2xl font-bold tabular-nums">{count('completed')}</dd></div>
              <div><dt className="text-sm text-m-muted">{t('Skipped')}</dt><dd className="text-2xl font-bold tabular-nums">{count('skipped')}</dd></div>
            </dl>
            {count('partial') > 0 && <p className="text-sm text-m-muted mb-4">{t('Started but not finished: {n}', { n: count('partial') })}</p>}
            <fieldset className="mb-4">
              <legend className="font-medium mb-2">{t('How hard did it feel? (optional)')}</legend>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" aria-pressed={effort === n} onClick={() => setEffort(effort === n ? 0 : n)}
                    className={`m-tap flex-1 rounded-xl border py-2 font-semibold ${effort === n ? 'border-m-accent bg-m-accent text-m-ink' : 'border-m-line bg-m-surface'}`}>
                    {n}<span className="sr-only"> {t('of 5')}</span>
                  </button>
                ))}
              </div>
              <p className="flex justify-between text-sm text-m-muted mt-1"><span>{t('Very easy')}</span><span>{t('Very hard')}</span></p>
            </fieldset>
            <label className="block mb-5"><span className="block font-medium mb-1">{t('Note (optional)')}</span>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={500} className={inputCls} placeholder={t('Anything worth remembering')} />
            </label>
          </>
        )}
        <Btn className="w-full text-base py-3" onClick={finish}>{t('Done')}</Btn>
      </div>
    </div>
  );
}
