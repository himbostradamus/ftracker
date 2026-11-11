import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { update, useMobility, uid } from '../lib/store';
import { addDays, dateKeyInTz, fmtActive, formatDateKey, isDateKey, monthOf, resolveTz, weekdayOf } from '../lib/dates';
import { activeDays, breakdown, consistency, dayTotals, goalProgress, streaks, totals, WINDOW_DAYS } from '../lib/stats';
import { allRoutines } from '../lib/routines';
import { Btn, Empty, Field, Header, IconBtn, Nav, Section, Sheet, inputCls } from './common';
import { AREA_LABEL, CATEGORY_LABEL, t, WEEKDAYS } from '../i18n';
import { SessionRecord } from '../types';

function Gauge({ pct }: { pct: number | null }) {
  const r = 44, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 110 110" width="124" height="124" className="shrink-0" role="img" aria-label={pct === null ? t('Consistency: not enough days yet') : t('Consistency: {n} percent', { n: pct })}>
      <circle cx="55" cy="55" r={r} fill="none" stroke="var(--m-line)" strokeWidth="10" />
      {pct !== null && <circle cx="55" cy="55" r={r} fill="none" stroke="var(--m-accent)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 55 55)" />}
      <text x="55" y="61" textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--m-text)">{pct === null ? '–' : `${pct}%`}</text>
    </svg>
  );
}

export function Progress({ nav }: { nav: Nav }) {
  const st = useMobility();
  const [view, setView] = useState<'stats' | 'history'>('stats');
  const tz = resolveTz(st.settings.timezone);
  const today = dateKeyInTz(new Date(), tz);
  const [month, setMonth] = useState(monthOf(today));
  const [editing, setEditing] = useState<SessionRecord | 'new' | null>(null);
  const [by, setBy] = useState<'area' | 'category'>('area');

  const set = st.settings;
  const days = activeDays(st.history, set.dayThresholdMin);
  const per = dayTotals(st.history);
  const streak = streaks(days, today);
  const cons = consistency(st.history, set, today);
  const tot = totals(st.history);
  const goal = goalProgress(st.history, set.goal, set.dayThresholdMin, today);
  const parts = breakdown(st.history, by);
  const maxPart = parts[0]?.sec ?? 1;

  // Streak repair: yesterday is empty, and filling it would rejoin today's
  // (or tomorrow's) practice to an earlier run.
  const yesterday = addDays(today, -1);
  const canRepair = !days.has(yesterday) && days.has(addDays(today, -2));
  const repair = () => {
    const rec: SessionRecord = {
      id: `manual-${uid()}`, routineId: null, routineName: t('Streak repair'), startedAt: new Date().toISOString(), endedAt: new Date().toISOString(),
      dateKey: yesterday, tz, activeSec: Math.max(60, set.dayThresholdMin * 60), completed: 0, skipped: 0, total: 0, items: [], source: 'manual', repair: true,
    };
    update(s => ({ ...s, history: [...s.history, rec] }));
    nav.toast(t('Added a manual entry for yesterday'), () => update(s => ({ ...s, history: s.history.filter(h => h.id !== rec.id) })));
  };

  const first = `${month}-01`;
  const lead = weekdayOf(first);
  const cells: (string | null)[] = [...Array(lead).fill(null)];
  for (let d = first; monthOf(d) === month; d = addDays(d, 1)) cells.push(d);
  const shiftMonth = (n: number) => setMonth(monthOf(addDays(n > 0 ? `${month}-28` : first, n > 0 ? 7 : -1)));

  const sorted = [...st.history].sort((a, b) => (b.dateKey + b.startedAt).localeCompare(a.dateKey + a.startedAt));
  const remove = (h: SessionRecord) => {
    update(s => ({ ...s, history: s.history.filter(x => x.id !== h.id) }));
    nav.toast(t('Entry deleted'), () => update(s => ({ ...s, history: [...s.history, h] })));
  };

  return (
    <div className="m-fade">
      <Header title={t('Progress')} />
      <div role="tablist" aria-label={t('Progress views')} className="flex gap-1 mb-5 border-b border-m-line">
        {(['stats', 'history'] as const).map(v => (
          <button key={v} role="tab" aria-selected={view === v} type="button" onClick={() => setView(v)}
            className={`px-4 py-2.5 min-h-[44px] font-semibold border-b-2 -mb-px ${view === v ? 'border-m-accent' : 'border-transparent text-m-muted'}`}>{v === 'stats' ? t('Stats') : t('History')}</button>
        ))}
      </div>

      {view === 'stats' && (
        <>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
            {[[t('Current streak'), t('{n} days', { n: streak.current })], [t('Longest streak'), t('{n} days', { n: streak.longest })], [t('Sessions'), String(tot.sessions)], [t('Active time'), fmtActive(tot.activeSec)]].map(([k, v]) => (
              <div key={k} className="m-card p-3.5"><dt className="text-sm text-m-muted">{k}</dt><dd className="text-xl font-bold tabular-nums">{v}</dd></div>
            ))}
          </dl>
          <p className="text-sm text-m-muted mb-5 -mt-2">
            {t('A day counts once it has {n} min of active time.', { n: set.dayThresholdMin })}
            {tot.manual > 0 ? ' ' + t('{n} entries were added or corrected by hand.', { n: tot.manual + st.history.filter(h => h.edited && h.source !== 'manual').length }) : ''}
          </p>
          {canRepair && (
            <div className="m-card p-4 mb-5 flex items-center gap-3">
              <p className="flex-1 text-sm">{t('Yesterday has no session. If you did stretch, you can add it by hand to rejoin your streak. It will be labelled as a manual entry.')}</p>
              <Btn kind="secondary" onClick={repair}>{t('Add yesterday')}</Btn>
            </div>
          )}

          {set.showGauge && (
            <Section title={t('Consistency')}>
              <div className="m-card p-4 flex items-center gap-4">
                <Gauge pct={cons.pct} />
                <div className="text-sm min-w-0">
                  <p className="font-semibold text-base">{cons.pct === null ? t('No scheduled days yet') : t('{done} of {n} scheduled days', { done: cons.done, n: cons.scheduled })}</p>
                  <p className="text-m-muted">
                    {t('Share of your scheduled practice days, over the last {n} days, that reached {m} min of active time.', { n: WINDOW_DAYS, m: set.dayThresholdMin })}{' '}
                    {cons.partial ? t('Only the {n} days since you started are counted.', { n: cons.windowDays }) : ''}{' '}
                    {t('Today counts once it is done. This measures how regularly you practise, not flexibility.')}
                  </p>
                </div>
              </div>
            </Section>
          )}

          {goal && (
            <Section title={t('Goal')}>
              <div className="m-card p-4">
                <p className="font-semibold">{goal.done} / {goal.target} {t(goal.label)}</p>
                <div className="h-2.5 rounded-full bg-m-line mt-2 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={goal.target} aria-valuenow={Math.min(goal.done, goal.target)} aria-label={t('Goal progress')}>
                  <div className="h-full bg-m-accent" style={{ width: `${Math.min(100, (goal.done / Math.max(1, goal.target)) * 100)}%` }} />
                </div>
              </div>
            </Section>
          )}

          <Section title={t('Calendar')} action={
            <div className="flex items-center gap-1">
              <IconBtn label={t('Previous month')} onClick={() => shiftMonth(-1)}><ChevronLeft size={20} /></IconBtn>
              <span className="text-sm font-medium w-28 text-center">{formatDateKey(first, { month: 'long', year: 'numeric' })}</span>
              <IconBtn label={t('Next month')} onClick={() => shiftMonth(1)} disabled={month >= monthOf(today)}><ChevronRight size={20} /></IconBtn>
            </div>}>
            <div className="m-card p-3">
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-m-muted mb-1" aria-hidden="true">{WEEKDAYS.map(d => <span key={d}>{t(d)}</span>)}</div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((d, i) => {
                  if (!d) return <span key={i} />;
                  const info = per.get(d);
                  const on = days.has(d);
                  const label = `${formatDateKey(d, { day: 'numeric', month: 'long' })}: ${info ? t('{d} active', { d: fmtActive(info.activeSec) }) + (info.manual ? `, ${t('includes a manual entry')}` : '') : t('no activity')}`;
                  return (
                    <span key={d} title={label} aria-label={label} role="img"
                      className={`relative grid aspect-square place-items-center rounded-lg text-sm tabular-nums ${on ? 'bg-m-accent text-m-ink font-bold' : info ? 'bg-m-soft' : ''} ${d === today ? 'ring-2 ring-m-text' : ''} ${d > today ? 'text-m-muted opacity-50' : ''}`}>
                      {Number(d.slice(8))}
                      {info?.manual && <span className="absolute right-0.5 top-0 text-[10px]" aria-hidden="true">✎</span>}
                      {on && <span className="absolute bottom-0 text-[9px] leading-none" aria-hidden="true">✓</span>}
                    </span>
                  );
                })}
              </div>
              <p className="text-xs text-m-muted mt-2">{t('Filled ✓ = active day. Pale = some activity under the daily threshold. ✎ = includes a manual entry.')}</p>
            </div>
          </Section>

          <Section title={t('Where the time went')} action={
            <div className="flex gap-1.5">
              <button type="button" aria-pressed={by === 'area'} onClick={() => setBy('area')} className={`text-sm font-medium px-2 min-h-[40px] ${by === 'area' ? 'underline underline-offset-4' : 'text-m-muted'}`}>{t('By area')}</button>
              <button type="button" aria-pressed={by === 'category'} onClick={() => setBy('category')} className={`text-sm font-medium px-2 min-h-[40px] ${by === 'category' ? 'underline underline-offset-4' : 'text-m-muted'}`}>{t('By type')}</button>
            </div>}>
            {parts.length === 0 ? <Empty>{t('Finish a session to see a breakdown.')}</Empty> : (
              <ul className="grid gap-1.5">
                {parts.slice(0, 10).map(p => (
                  <li key={p.key} className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-2 text-sm">
                    <span>{t((by === 'area' ? AREA_LABEL : CATEGORY_LABEL)[p.key] ?? p.key)}</span>
                    <span className="h-2.5 rounded-full bg-m-line overflow-hidden"><span className="block h-full bg-m-accent" style={{ width: `${(p.sec / maxPart) * 100}%` }} /></span>
                    <span className="text-right tabular-nums text-m-muted">{t('{n} min', { n: Math.max(1, Math.round(p.sec / 60)) })}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}

      {view === 'history' && (
        <>
          <Btn kind="secondary" className="mb-4" onClick={() => setEditing('new')}><Plus size={18} />{t('Add a session by hand')}</Btn>
          {sorted.length === 0 ? <Empty>{t('No sessions yet.')}</Empty> : (
            <ul className="grid gap-2">
              {sorted.map(h => (
                <li key={h.id} className="m-card p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{h.routineName}</p>
                      <p className="text-sm text-m-muted">
                        {formatDateKey(h.dateKey, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {t('{d} active', { d: fmtActive(h.activeSec) })}
                        {h.source === 'session' ? ` · ${t('{c} of {n} movements', { c: h.completed, n: h.total })}` : ''}
                        {h.effort ? ` · ${t('effort {n}/5', { n: h.effort })}` : ''}
                      </p>
                      {(h.source === 'manual' || h.edited) && <p className="text-sm font-medium">{h.repair ? t('Manual entry (streak repair)') : h.source === 'manual' ? t('Manual entry') : t('Edited')}</p>}
                      {h.note && <p className="text-sm mt-1">{h.note}</p>}
                    </div>
                    <IconBtn label={t('Edit entry')} onClick={() => setEditing(h)}><Pencil size={18} /></IconBtn>
                    <IconBtn label={t('Delete entry')} onClick={() => remove(h)}><Trash2 size={18} /></IconBtn>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {editing && <EntryEditor entry={editing === 'new' ? null : editing} today={today} tz={tz} onClose={() => setEditing(null)} nav={nav} />}
    </div>
  );
}

function EntryEditor({ entry, today, tz, onClose, nav }: { entry: SessionRecord | null; today: string; tz: string; onClose: () => void; nav: Nav }) {
  const st = useMobility();
  const [date, setDate] = useState(entry?.dateKey ?? today);
  const [min, setMin] = useState(String(entry ? Math.max(1, Math.round(entry.activeSec / 60)) : 10));
  const [name, setName] = useState(entry?.routineName ?? '');
  const [note, setNote] = useState(entry?.note ?? '');
  const [effort, setEffort] = useState(entry?.effort ?? 0);
  const minutes = Number(min);
  const valid = isDateKey(date) && date <= today && Number.isFinite(minutes) && minutes > 0 && minutes <= 600;
  const save = () => {
    if (!valid) return;
    if (entry) {
      const changed = entry.dateKey !== date || Math.round(entry.activeSec / 60) !== minutes || entry.routineName !== (name.trim() || entry.routineName);
      const next: SessionRecord = { ...entry, dateKey: date, activeSec: Math.round(entry.activeSec / 60) !== minutes ? minutes * 60 : entry.activeSec, routineName: name.trim() || entry.routineName, note: note.trim() || undefined, effort: effort || undefined, edited: entry.edited || (changed && entry.source === 'session') || undefined };
      update(s => ({ ...s, history: s.history.map(h => (h.id === entry.id ? next : h)) }));
      nav.toast(t('Entry updated'), () => update(s => ({ ...s, history: s.history.map(h => (h.id === entry.id ? entry : h)) })));
    } else {
      const rec: SessionRecord = { id: `manual-${uid()}`, routineId: null, routineName: name.trim() || t('Stretching'), startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), dateKey: date, tz, activeSec: minutes * 60, completed: 0, skipped: 0, total: 0, items: [], source: 'manual', note: note.trim() || undefined, effort: effort || undefined };
      update(s => ({ ...s, history: [...s.history, rec], settings: s.settings.firstUseDate && s.settings.firstUseDate <= date ? s.settings : { ...s.settings, firstUseDate: date } }));
      nav.toast(t('Manual entry added'), () => update(s => ({ ...s, history: s.history.filter(h => h.id !== rec.id) })));
    }
    onClose();
  };
  return (
    <Sheet title={entry ? t('Edit entry') : t('Add a session by hand')} onClose={onClose}>
      {!entry && <p className="text-sm text-m-muted mb-3">{t('Manual entries count toward streaks and totals and are always labelled as manual.')}</p>}
      {entry?.source === 'session' && <p className="text-sm text-m-muted mb-3">{t('Changing the date or duration marks this entry as edited.')}</p>}
      <Field label={t('Date')}><input type="date" className={inputCls} value={date} max={today} onChange={e => setDate(e.target.value)} /></Field>
      <Field label={t('Active minutes')}><input type="number" inputMode="numeric" min={1} max={600} className={inputCls} value={min} onChange={e => setMin(e.target.value)} /></Field>
      <Field label={t('What you did')}>
        <input className={inputCls} value={name} onChange={e => setName(e.target.value)} list="routine-names" placeholder={t('Stretching')} />
        <datalist id="routine-names">{allRoutines(st).map(r => <option key={r.id} value={r.name} />)}</datalist>
      </Field>
      <Field label={t('Difficulty felt, 1 to 5 (optional)')}>
        <div className="flex gap-2">{[1, 2, 3, 4, 5].map(n => <button key={n} type="button" aria-pressed={effort === n} onClick={() => setEffort(effort === n ? 0 : n)} className={`m-tap flex-1 rounded-xl border py-2 font-semibold ${effort === n ? 'border-m-accent bg-m-accent text-m-ink' : 'border-m-line'}`}>{n}</button>)}</div>
      </Field>
      <Field label={t('Note (optional)')}><textarea rows={2} className={inputCls} value={note} maxLength={500} onChange={e => setNote(e.target.value)} /></Field>
      {!valid && <p className="text-sm text-m-danger mb-2" role="alert">{t('Enter a date that is not in the future and a duration between 1 and 600 minutes.')}</p>}
      <div className="flex gap-2"><Btn kind="secondary" className="flex-1" onClick={onClose}>{t('Cancel')}</Btn><Btn className="flex-1" disabled={!valid} onClick={save}>{t('Save')}</Btn></div>
    </Sheet>
  );
}
