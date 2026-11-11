import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { clearMobilityData, getState, setState, update, updateSettings, useMobility, uid } from '../lib/store';
import { allRoutines } from '../lib/routines';
import { downloadFile, exportMobility, historyCsv, readJsonFile, validateBackup, BackupCheck } from '../lib/backup';
import { buildFullBackup } from '../../lib/fullBackup';
import { saveSession } from '../lib/session';
import { isStandalone, notificationsSupported } from '../lib/reminders';
import { isValidTz, resolveTz, dateKeyInTz } from '../lib/dates';
import { playSound, unlockAudio, speechSupported, wakeLockSupported } from '../lib/audio';
import { Btn, Chip, Field, Header, IconBtn, Nav, Section, Select, Sheet, Stepper, Toggle, inputCls } from './common';
import { CAUTION_LABEL, DIFFICULTY_LABEL, t, WEEKDAYS } from '../i18n';
import { Caution, Difficulty, Goal, Reminder, Settings } from '../types';

const stamp = () => dateKeyInTz(new Date(), resolveTz(getState().settings.timezone));
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

export function SettingsView({ nav }: { nav: Nav }) {
  const st = useMobility();
  const s = st.settings;
  const set = (p: Partial<Settings>) => updateSettings(p);
  const [restore, setRestore] = useState<BackupCheck | null>(null);
  const [wipe, setWipe] = useState(false);
  const [editRem, setEditRem] = useState<Reminder | null>(null);
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [perm, setPerm] = useState(notificationsSupported() ? Notification.permission : 'unsupported');
  const zones: string[] = (() => { try { return (Intl as any).supportedValuesOf('timeZone'); } catch { return []; } })();

  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  const backedUp = () => set({ lastBackupAt: new Date().toISOString() });
  const fullBackup = () => { downloadFile(`training-backup-${stamp()}.json`, JSON.stringify(buildFullBackup(), null, 2)); backedUp(); nav.toast(t('Backup file downloaded')); };
  const mobBackup = () => { downloadFile(`stretching-backup-${stamp()}.json`, JSON.stringify(exportMobility(getState()), null, 2)); backedUp(); nav.toast(t('Backup file downloaded')); };
  const onRestoreFile = async (f: File) => {
    try { setRestore(validateBackup(await readJsonFile(f))); } catch (e) { setRestore({ ok: false, error: (e as Error).message }); }
  };
  const enableNotifications = async (on: boolean) => {
    if (!on) { set({ notifications: false }); return; }
    if (!notificationsSupported()) { nav.toast(t('This browser does not support notifications.')); return; }
    const p = await Notification.requestPermission();
    setPerm(p);
    set({ notifications: p === 'granted' });
    if (p !== 'granted') nav.toast(t('Notifications were not allowed. In-app reminders still work.'));
  };

  return (
    <div className="m-fade">
      <Header title={t('Settings')} />

      <Section title={t('Appearance')}>
        <div className="m-card px-4 py-1">
          <Select label={t('Theme')} value={s.appearance} onChange={v => set({ appearance: v })} options={[['system', t('Match device')], ['light', t('Light')], ['dark', t('Dark')]]} />
          <Select label={t('Text size')} value={s.textSize} onChange={v => set({ textSize: v })} options={[['normal', t('Normal')], ['large', t('Large')], ['larger', t('Larger')]]} />
        </div>
      </Section>

      <Section title={t('Accessibility')}>
        <div className="m-card px-4 py-1">
          <Toggle label={t('Reduce motion')} hint={t('Also follows your device setting automatically')} checked={s.reduceMotion === 'on'} onChange={v => set({ reduceMotion: v ? 'on' : 'system' })} />
          <Toggle label={t('Pause the timer while reading instructions')} checked={s.pauseOnInfo} onChange={v => set({ pauseOnInfo: v })} />
        </div>
      </Section>

      <Section title={t('Audio')}>
        <div className="m-card px-4 py-1">
          <Toggle label={t('Sound cues')} hint={t('Countdown beeps and a tone at each change')} checked={s.sounds} onChange={v => set({ sounds: v })} />
          <Toggle label={t('Speak exercise names')} checked={s.speakNames} onChange={v => set({ speakNames: v })} />
          <Toggle label={t('Speak side changes')} checked={s.speakSides} onChange={v => set({ speakSides: v })} />
          {!speechSupported() && <p className="text-sm text-m-muted pb-2">{t('This browser has no speech synthesis, so spoken prompts are unavailable.')}</p>}
          <label className="block py-2"><span className="font-medium">{t('Volume')}</span>
            <input type="range" min={0.1} max={1} step={0.1} value={s.volume} onChange={e => set({ volume: Number(e.target.value) })} className="w-full" /></label>
          <Btn kind="secondary" className="mb-3" onClick={() => { unlockAudio(); window.setTimeout(() => playSound('change', s.volume), 60); }}>{t('Test sound')}</Btn>
          <p className="text-sm text-m-muted pb-3">{t('Browsers only allow sound after a tap, and your phone\'s silent switch still applies. The app never starts music and does not stop audio from other apps.')}</p>
        </div>
      </Section>

      <Section title={t('Timing')}>
        <div className="m-card px-4 py-1">
          <Stepper label={t('Countdown before the first movement')} value={s.prepSec} min={0} max={30} onChange={v => set({ prepSec: v })} suffix={t('sec')} />
          <Stepper label={t('Between movements')} value={s.transitionSec} min={0} max={60} onChange={v => set({ transitionSec: v })} suffix={t('sec')} />
          <Stepper label={t('Between sides')} value={s.switchSec} min={0} max={30} onChange={v => set({ switchSec: v })} suffix={t('sec')} />
          <Toggle label={t('Keep the screen awake during a session')} hint={wakeLockSupported() ? undefined : t('Not supported by this browser')} checked={s.keepAwake} onChange={v => set({ keepAwake: v })} />
        </div>
      </Section>

      <Section title={t('Preferences')}>
        <div className="m-card px-4 py-2">
          <Select label={t('Level')} value={s.level} onChange={v => set({ level: v as Difficulty })} options={Object.entries(DIFFICULTY_LABEL) as [Difficulty, string][]} />
          <p className="text-sm text-m-muted pb-2">{t('Suggestions and the planner stay at or below this level. Everything remains available in the Library.')}</p>
          <p className="font-medium mb-1.5">{t('Prefer to avoid')}</p>
          <div className="flex flex-wrap gap-1.5 mb-2">{(Object.keys(CAUTION_LABEL) as Caution[]).map(k => <Chip key={k} on={s.cautions.includes(k)} onClick={() => set({ cautions: toggle(s.cautions, k) })}>{t(CAUTION_LABEL[k])}</Chip>)}</div>
          <p className="text-sm text-m-muted pb-2">{t('These steer suggestions and flag movements in routines. They are preferences, not a medical assessment.')}</p>
          <p className="font-medium mb-1.5">{t('Days you plan to practise')}</p>
          <div className="flex flex-wrap gap-1.5 mb-2">{WEEKDAYS.map((d, i) => <Chip key={d} on={s.scheduleDays.includes(i)} onClick={() => set({ scheduleDays: toggle(s.scheduleDays, i).sort() })}>{t(d)}</Chip>)}</div>
          <Stepper label={t('Active minutes for a day to count')} value={s.dayThresholdMin} min={1} max={30} onChange={v => set({ dayThresholdMin: v })} suffix={t('min')} />
          <Toggle label={t('Show the consistency gauge')} checked={s.showGauge} onChange={v => set({ showGauge: v })} />
          <Select label={t('Goal')} value={s.goal.kind} onChange={v => set({ goal: { kind: v as Goal['kind'], target: v === 'days-month' ? 20 : 3 } })} options={[['none', t('No goal')], ['sessions-week', t('Sessions per week')], ['days-month', t('Active days per month')]]} />
          {s.goal.kind !== 'none' && <Stepper label={t('Target')} value={s.goal.target} min={1} max={s.goal.kind === 'days-month' ? 31 : 21} onChange={v => set({ goal: { ...s.goal, target: v } })} />}
          <label className="flex items-center justify-between gap-3 py-2">
            <span className="font-medium">{t('Timezone')}</span>
            {zones.length ? (
              <select className="m-tap max-w-[60%] rounded-lg border border-m-line bg-m-surface px-3 py-2" value={s.timezone} onChange={e => set({ timezone: e.target.value })}>
                <option value="auto">{t('Device ({tz})', { tz: resolveTz('auto') })}</option>
                {zones.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            ) : (
              <input className={inputCls + ' max-w-[60%]'} defaultValue={s.timezone} onBlur={e => { const v = e.target.value.trim() || 'auto'; if (v === 'auto' || isValidTz(v)) set({ timezone: v }); else nav.toast(t('Unknown timezone')); }} />
            )}
          </label>
          <p className="text-sm text-m-muted pb-2">{t('Used to decide which calendar day a session belongs to. Past sessions keep the day they were recorded on.')}</p>
        </div>
      </Section>

      <Section title={t('Reminders')} action={<Btn kind="ghost" onClick={() => setEditRem({ id: `rem-${uid()}`, title: '', time: '08:00', days: [0, 1, 2, 3, 4, 5, 6], enabled: true })}><Plus size={18} />{t('Add')}</Btn>}>
        <div className="m-card px-4 py-2">
          <p className="text-sm text-m-muted py-1">{t('Reminders appear while this app is open, in a banner and, if allowed, as a notification. A web app cannot wake itself when it is closed, so do not rely on these as an alarm.')}</p>
          {st.reminders.map(r => (
            <div key={r.id} className="flex items-center gap-2 border-t border-m-line py-2">
              <button type="button" className="flex-1 text-left min-h-[44px]" onClick={() => setEditRem(r)}>
                <span className="block font-medium">{r.time} · {r.title || t('Time to stretch')}</span>
                <span className="block text-sm text-m-muted">{r.days.length === 7 ? t('Every day') : r.days.map(d => t(WEEKDAYS[d])).join(', ')}</span>
              </button>
              <Toggle label="" checked={r.enabled} onChange={v => update(x => ({ ...x, reminders: x.reminders.map(y => (y.id === r.id ? { ...y, enabled: v } : y)) }))} />
            </div>
          ))}
          <div className="border-t border-m-line">
            <Toggle label={t('Streak reminder')} hint={t('Only when you have a streak and have not practised yet that day')} checked={s.streakReminder} onChange={v => set({ streakReminder: v })} />
            {s.streakReminder && <Field label={t('Streak reminder time')}><input type="time" className={inputCls} value={s.streakReminderTime} onChange={e => set({ streakReminderTime: e.target.value })} /></Field>}
            <Toggle label={t('Quiet hours')} checked={s.quietEnabled} onChange={v => set({ quietEnabled: v })} />
            {s.quietEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('From')}><input type="time" className={inputCls} value={s.quietStart} onChange={e => set({ quietStart: e.target.value })} /></Field>
                <Field label={t('Until')}><input type="time" className={inputCls} value={s.quietEnd} onChange={e => set({ quietEnd: e.target.value })} /></Field>
              </div>
            )}
            <Toggle label={t('Also show a system notification')} hint={perm === 'unsupported' ? t('Not supported by this browser') : perm === 'denied' ? t('Blocked in your browser settings') : t('On iPhone this needs the app added to the Home Screen')} checked={s.notifications && perm === 'granted'} onChange={enableNotifications} />
          </div>
        </div>
      </Section>

      <Section title={t('Add to Home Screen')}>
        <div className="m-card p-4 text-sm">
          {isStandalone() ? <p>{t('The app is installed and running from your Home Screen.')}</p> : (
            <>
              <p className="mb-2">{t('Installing adds an app icon and lets the app open without the browser bars. It works offline once it has been opened online one time.')}</p>
              <ul className="list-disc pl-5 text-m-muted space-y-1 mb-2">
                <li>{t('iPhone or iPad (Safari): tap Share, then Add to Home Screen.')}</li>
                <li>{t('Android (Chrome): open the menu, then Install app or Add to Home screen.')}</li>
                <li>{t('Desktop Chrome or Edge: use the install icon in the address bar.')}</li>
              </ul>
              <p className="text-m-muted mb-2">{t('On iPhone, a Home Screen app keeps its own separate storage. Make a backup file first and restore it inside the installed app.')}</p>
              {installEvt && <Btn onClick={async () => { await installEvt.prompt(); setInstallEvt(null); }}>{t('Install')}</Btn>}
            </>
          )}
        </div>
      </Section>

      <Section title={t('Data')}>
        <div className="m-card p-4">
          <p className="text-sm text-m-muted mb-3">{t('Everything is stored in this browser on this device only. It is not a backup: clearing site data, or the browser doing so, erases it. A backup file is the only copy you control.')}</p>
          <p className="text-sm mb-3">{s.lastBackupAt ? t('Last backup file: {d}', { d: s.lastBackupAt.slice(0, 10) }) : t('No backup file made yet.')}</p>
          <div className="grid gap-2">
            <Btn onClick={fullBackup}>{t('Back up everything (stretching and training)')}</Btn>
            <Btn kind="secondary" onClick={mobBackup}>{t('Back up stretching data only')}</Btn>
            <label className="m-tap inline-flex items-center justify-center rounded-xl border border-m-line bg-m-surface px-4 py-2.5 font-semibold cursor-pointer">
              {t('Restore stretching data from a file')}
              <input type="file" accept=".json,application/json" className="sr-only" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void onRestoreFile(f); }} />
            </label>
            <Btn kind="secondary" onClick={() => downloadFile(`stretching-history-${stamp()}.csv`, historyCsv(st.history), 'text/csv')}>{t('Export history as CSV')}</Btn>
          </div>
          <p className="text-sm text-m-muted mt-3">{t('Training tracker data is restored from its own Data tab, which accepts the same backup file.')}</p>
          <Toggle label={t('Remind me to back up')} hint={t('A note on Today when the last backup is over 30 days old')} checked={s.backupReminder} onChange={v => set({ backupReminder: v })} />
          <Btn kind="danger" className="mt-2" onClick={() => setWipe(true)}><Trash2 size={16} />{t('Delete stretching data')}</Btn>
        </div>
      </Section>

      <Section title={t('Help')}>
        <div className="m-card px-4 py-2 text-sm">
          {([
            ['Starting a session', 'Tap Start on any routine. The player counts down, shows each movement and its side, and beeps for the last three seconds. Pause, go back, restart a movement or skip at any time.'],
            ['If the phone locks or you switch apps', 'Browsers stop timers and sound in the background. When you come back, the app tells you how long it was away and asks whether to resume or count that time. Keeping the screen awake avoids this.'],
            ['Streaks and the consistency gauge', 'A day counts when its active time reaches your threshold. The gauge is the share of your scheduled days completed in the last 21 days. Neither measures flexibility.'],
            ['Making your own routine', 'Create has two ways: build one movement by movement, or describe what you want and let the rule-based planner assemble it. Both can be edited, saved and exported.'],
            ['Videos', 'There are no demonstration videos yet. Each movement has an illustration and written steps.'],
            ['About the guidance', 'This is general exercise information, not medical advice. Stop if something hurts, and ask a professional about injuries or conditions.'],
          ] as [string, string][]).map(([q, a]) => (
            <details key={q} className="border-b border-m-line last:border-0 py-2.5"><summary className="font-medium cursor-pointer min-h-[28px]">{t(q)}</summary><p className="text-m-muted mt-1.5">{t(a)}</p></details>
          ))}
        </div>
      </Section>

      <Btn kind="secondary" className="w-full" onClick={nav.exitToTracker}>{t('Open the training tracker')}</Btn>

      {restore && (
        <Sheet title={t('Restore stretching data')} onClose={() => setRestore(null)}>
          {!restore.ok ? <><p className="mb-4" role="alert">{t(restore.error ?? 'This file could not be used.')}</p><Btn className="w-full" onClick={() => setRestore(null)}>{t('Close')}</Btn></> : (
            <>
              <p className="mb-2">{t('The file contains {s} sessions, {r} custom routines, {f} favorites and {m} reminders.', { s: restore.summary!.sessions, r: restore.summary!.routines, f: restore.summary!.favorites, m: restore.summary!.reminders })}</p>
              {restore.summary!.warnings.length > 0 && <ul className="list-disc pl-5 text-sm text-m-muted mb-2">{restore.summary!.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
              <p className="mb-4 font-medium">{t('Restoring replaces the stretching data now on this device ({s} sessions, {r} custom routines). Training tracker data is not changed.', { s: st.history.length, r: st.customRoutines.length })}</p>
              <div className="flex gap-2">
                <Btn kind="secondary" className="flex-1" onClick={() => setRestore(null)}>{t('Cancel')}</Btn>
                <Btn className="flex-1" onClick={() => { const before = getState(); setState(restore.state!); setRestore(null); nav.toast(t('Stretching data restored'), () => setState(before)); }}>{t('Replace and restore')}</Btn>
              </div>
            </>
          )}
        </Sheet>
      )}

      {wipe && (
        <Sheet title={t('Delete stretching data?')} onClose={() => setWipe(false)}>
          <p className="mb-4">{t('This removes your stretching history, custom routines, favorites, reminders and settings from this device. It cannot be undone. Training tracker data is not touched.')}</p>
          <div className="grid gap-2">
            <Btn kind="secondary" onClick={() => { mobBackup(); }}>{t('Download a backup first')}</Btn>
            <Btn kind="danger" onClick={() => { saveSession(null); clearMobilityData(); setWipe(false); nav.toast(t('Stretching data deleted')); }}>{t('Delete')}</Btn>
            <Btn kind="ghost" onClick={() => setWipe(false)}>{t('Cancel')}</Btn>
          </div>
        </Sheet>
      )}

      {editRem && <ReminderEditor rem={editRem} isNew={!st.reminders.some(r => r.id === editRem.id)} onClose={() => setEditRem(null)} nav={nav} />}
    </div>
  );
}

function ReminderEditor({ rem, isNew, onClose, nav }: { rem: Reminder; isNew: boolean; onClose: () => void; nav: Nav }) {
  const st = useMobility();
  const [r, setR] = useState(rem);
  const save = () => {
    if (r.days.length === 0) { nav.toast(t('Pick at least one day.')); return; }
    update(s => ({ ...s, reminders: isNew ? [...s.reminders, r] : s.reminders.map(x => (x.id === r.id ? r : x)), fired: Object.fromEntries(Object.entries(s.fired).filter(([k]) => k !== r.id)) }));
    onClose();
  };
  return (
    <Sheet title={isNew ? t('New reminder') : t('Edit reminder')} onClose={onClose}>
      <Field label={t('Title')}><input className={inputCls} value={r.title} maxLength={60} placeholder={t('Time to stretch')} onChange={e => setR({ ...r, title: e.target.value })} /></Field>
      <Field label={t('Time')}><input type="time" className={inputCls} value={r.time} onChange={e => setR({ ...r, time: e.target.value || '08:00' })} /></Field>
      <div className="mb-3" role="group" aria-label={t('Days')}>
        <p className="text-sm font-medium mb-1">{t('Days')}</p>
        <div className="flex flex-wrap gap-1.5">{WEEKDAYS.map((d, i) => <Chip key={d} on={r.days.includes(i)} onClick={() => setR({ ...r, days: toggle(r.days, i).sort() })}>{t(d)}</Chip>)}</div>
      </div>
      <Field label={t('Routine to offer (optional)')}>
        <select className={inputCls} value={r.routineId ?? ''} onChange={e => setR({ ...r, routineId: e.target.value || undefined })}>
          <option value="">{t('None')}</option>
          {allRoutines(st).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </Field>
      <Toggle label={t('Enabled')} checked={r.enabled} onChange={v => setR({ ...r, enabled: v })} />
      <div className="flex gap-2 mt-2">
        {!isNew && <IconBtn label={t('Delete reminder')} className="border border-m-danger text-m-danger rounded-xl" onClick={() => { update(s => ({ ...s, reminders: s.reminders.filter(x => x.id !== r.id) })); onClose(); nav.toast(t('Reminder deleted'), () => update(s => ({ ...s, reminders: [...s.reminders, rem] }))); }}><Trash2 size={18} /></IconBtn>}
        <Btn kind="secondary" className="flex-1" onClick={onClose}>{t('Cancel')}</Btn>
        <Btn className="flex-1" onClick={save}>{t('Save')}</Btn>
      </div>
    </Sheet>
  );
}
