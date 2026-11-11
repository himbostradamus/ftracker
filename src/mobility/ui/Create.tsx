import React, { useState } from 'react';
import { Hammer, MessageSquareText, Play, RefreshCw, Upload, X } from 'lucide-react';
import { update, useMobility } from '../lib/store';
import { EX } from '../data/catalog';
import { Constraints, defaultConstraints, MoveType, parseRequest, planRoutine, PlanResult } from '../lib/planner';
import { timingOf } from '../lib/routines';
import { doseLabel, routineTotals } from '../lib/timeline';
import { downloadFile, exportRoutineFile, readJsonFile, validateRoutineFile } from '../lib/backup';
import { fmtDuration } from '../lib/dates';
import { Art, Btn, Chip, Header, IconBtn, Nav, Section, Select, Sheet, Stepper, inputCls } from './common';
import { AREA_LABEL, CAUTION_LABEL, DIFFICULTY_LABEL, EQUIPMENT_LABEL, t } from '../i18n';
import { Area, Caution, Difficulty, Equipment, Position, Routine } from '../types';

const POS_OPTIONS: [string, Position[]][] = [['Standing', ['standing']], ['Seated on a chair', ['chair']], ['On the floor', ['seated', 'kneeling', 'lying', 'support']]];
const TYPE_OPTIONS: [MoveType, string][] = [['stretch', 'Stretching'], ['mobility', 'Dynamic mobility'], ['strength', 'Strength'], ['yoga', 'Yoga positions'], ['balance', 'Balance']];
const EXAMPLES = ['five minutes seated after a long drive', 'ten minutes of beginner hip mobility', 'standing warm-up before walking; avoid kneeling'];
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

export function Create({ nav }: { nav: Nav }) {
  const st = useMobility();
  const timing = timingOf(st.settings);
  const [mode, setMode] = useState<'menu' | 'plan'>('menu');
  const [text, setText] = useState('');
  const [c, setC] = useState<Constraints>(() => ({ ...defaultConstraints(st.settings.level, st.settings.cautions), types: ['stretch', 'mobility'] }));
  const [read, setRead] = useState<{ understood: string[]; unknown: string[] } | null>(null);
  const [seed, setSeed] = useState(0);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [incoming, setIncoming] = useState<{ routine: Routine; dropped: string[] } | null>(null);

  const generate = (cons = c, s = seed) => setResult(planRoutine(cons, timing, s));
  const readRequest = () => {
    if (!text.trim()) { generate(); return; }
    const p = parseRequest(text);
    // A typed request replaces the area, position and type choices, and adds
    // to the avoid list; anything it does not mention is left as set.
    const next: Constraints = {
      ...c, ...p.patch,
      areas: p.patch.areas ?? [], positions: p.patch.positions ?? [], types: p.patch.types ?? (p.patch.areas ? [] : c.types),
      cautions: [...new Set([...st.settings.cautions, ...(p.patch.cautions ?? [])])],
    };
    setC(next); setRead({ understood: p.understood, unknown: p.unknown }); setSeed(0); generate(next, 0);
  };
  const change = (patch: Partial<Constraints>) => { const next = { ...c, ...patch }; setC(next); if (result) generate(next); };

  const onImport = async (file: File) => {
    try {
      const res = validateRoutineFile(await readJsonFile(file));
      if (!res.ok || !res.routine) { nav.toast(t(res.error ?? 'This is not a routine file.')); return; }
      setIncoming({ routine: res.routine, dropped: res.dropped ?? [] });
    } catch (e) { nav.toast(t((e as Error).message)); }
  };

  if (mode === 'menu') {
    return (
      <div className="m-fade">
        <Header title={t('Create')} />
        <div className="grid gap-3 md:grid-cols-2">
          <button type="button" onClick={() => nav.push({ type: 'builder' })} className="m-card p-5 text-left">
            <Hammer size={26} className="text-m-accent mb-2" aria-hidden="true" />
            <span className="block text-lg font-bold">{t('Build it yourself')}</span>
            <span className="block text-m-muted">{t('Pick movements, set the order and the time for each.')}</span>
          </button>
          <button type="button" onClick={() => setMode('plan')} className="m-card p-5 text-left">
            <MessageSquareText size={26} className="text-m-accent mb-2" aria-hidden="true" />
            <span className="block text-lg font-bold">{t('Describe what you want')}</span>
            <span className="block text-m-muted">{t('Say how long, where and what for. The planner picks movements that fit.')}</span>
          </button>
        </div>
        <div className="mt-6">
          <label className="m-tap inline-flex items-center gap-2 rounded-xl border border-m-line bg-m-surface px-4 py-2.5 font-semibold cursor-pointer">
            <Upload size={18} />{t('Import a routine file')}
            <input type="file" accept=".json,application/json" className="sr-only" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void onImport(f); }} />
          </label>
        </div>
        {st.customRoutines.length > 0 && (
          <Section title={t('Your routines')}>
            <ul className="grid gap-1 mt-6">
              {st.customRoutines.slice(0, 8).map(r => (
                <li key={r.id}><button type="button" className="w-full text-left py-2.5 border-b border-m-line min-h-[44px]" onClick={() => nav.push({ type: 'routine', id: r.id })}>{r.name}</button></li>
              ))}
            </ul>
          </Section>
        )}
        {incoming && <ImportPreview incoming={incoming} onClose={() => setIncoming(null)} nav={nav} />}
      </div>
    );
  }

  const r = result?.routine;
  const tot = r ? routineTotals(r, timing) : null;
  return (
    <div className="m-fade">
      <Header title={t('Describe what you want')} onBack={() => setMode('menu')} />
      <form onSubmit={e => { e.preventDefault(); readRequest(); }} className="mb-2">
        <label className="block text-sm font-medium mb-1" htmlFor="req">{t('Your request')}</label>
        <div className="flex gap-2">
          <input id="req" className={inputCls} value={text} onChange={e => setText(e.target.value)} placeholder={t('e.g. ten minutes for tight hips')} />
          <Btn type="submit">{t('Plan')}</Btn>
        </div>
      </form>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {EXAMPLES.map(x => <button key={x} type="button" className="rounded-lg bg-m-soft px-2.5 py-1.5 text-sm text-left min-h-[36px]" onClick={() => setText(x)}>{x}</button>)}
      </div>
      {read && (
        <div className="m-card p-3 mb-4 text-sm" aria-live="polite">
          <p><span className="font-semibold">{t('Understood:')}</span> {read.understood.length ? read.understood.join(', ') : t('nothing specific, so the settings below were used')}</p>
          {read.unknown.length > 0 && <p className="mt-1"><span className="font-semibold">{t('Not understood:')}</span> {read.unknown.join(', ')}. {t('Use the settings below to add anything missing.')}</p>}
        </div>
      )}

      <details className="m-card p-4 mb-4" open={!result}>
        <summary className="font-semibold cursor-pointer min-h-[32px]">{t('Settings')}</summary>
        <div className="mt-3">
          <Stepper label={t('Duration')} value={c.minutes} min={2} max={45} onChange={v => change({ minutes: v })} suffix={t('min')} />
          <Select label={t('Difficulty')} value={c.level} onChange={v => change({ level: v as Difficulty })} options={Object.entries(DIFFICULTY_LABEL) as [Difficulty, string][]} />
          <Group label={t('Position')}>
            {POS_OPTIONS.map(([label, ps]) => { const on = ps.every(p => c.positions.includes(p)); return <Chip key={label} on={on} onClick={() => change({ positions: on ? c.positions.filter(p => !ps.includes(p)) : [...new Set([...c.positions, ...ps])] })}>{t(label)}</Chip>; })}
          </Group>
          <Group label={t('Movement type')}>{TYPE_OPTIONS.map(([v, l]) => <Chip key={v} on={c.types.includes(v)} onClick={() => change({ types: toggle(c.types, v) })}>{t(l)}</Chip>)}</Group>
          <Group label={t('Body areas (none selected means whole body)')}>{(Object.keys(AREA_LABEL) as Area[]).map(a => <Chip key={a} on={c.areas.includes(a)} onClick={() => change({ areas: toggle(c.areas, a) })}>{t(AREA_LABEL[a])}</Chip>)}</Group>
          <Group label={t('Equipment you have')}>{(['wall', 'chair', 'doorway'] as Equipment[]).map(e => <Chip key={e} on={c.equipment.includes(e)} onClick={() => change({ equipment: toggle(c.equipment, e) })}>{t(EQUIPMENT_LABEL[e])}</Chip>)}</Group>
          <Group label={t('Avoid')}>{(Object.keys(CAUTION_LABEL) as Caution[]).map(k => <Chip key={k} on={c.cautions.includes(k)} onClick={() => change({ cautions: toggle(c.cautions, k) })}>{t(CAUTION_LABEL[k])}</Chip>)}</Group>
          {c.exclude.length > 0 && (
            <Group label={t('Excluded movements')}>
              {c.exclude.map(id => <button key={id} type="button" className="rounded-lg border border-m-line px-2.5 py-1.5 text-sm min-h-[40px]" onClick={() => change({ exclude: c.exclude.filter(x => x !== id) })}>{EX[id]?.name} <span aria-hidden="true">×</span><span className="sr-only">{t('allow again')}</span></button>)}
            </Group>
          )}
        </div>
      </details>
      {!result && <Btn className="w-full mb-4" onClick={() => generate()}>{t('Plan a routine')}</Btn>}

      {result && !r && (
        <div className="m-card p-4 mb-4" role="alert">
          <p className="font-semibold mb-1">{t('No routine could be built')}</p>
          <p>{result.problem}</p>
          {result.suggestion && <p className="mt-1 text-m-muted">{result.suggestion}</p>}
        </div>
      )}

      {r && tot && (
        <section aria-live="polite">
          <h2 className="text-xl font-bold">{r.name}</h2>
          <p className="text-m-muted mb-1">{tot.estimated ? '≈ ' : ''}{fmtDuration(tot.total)} · {t('{n} movements', { n: r.items.length })} · {t('chosen from {n} that fit', { n: result!.eligibleCount })}</p>
          {result!.notes.map((n, i) => <p key={i} className="text-sm text-m-muted">{n}</p>)}
          <div className="flex flex-wrap gap-2 my-3">
            <Btn onClick={() => nav.start(r)}><Play size={18} fill="currentColor" />{t('Start')}</Btn>
            <Btn kind="secondary" onClick={() => { const s = seed + 1; setSeed(s); generate(c, s); }}><RefreshCw size={16} />{t('Regenerate')}</Btn>
            <Btn kind="secondary" onClick={() => nav.push({ type: 'builder', routine: r })}>{t('Edit')}</Btn>
            <Btn kind="secondary" onClick={() => { const saved = { ...r, id: `custom-${Date.now().toString(36)}`, createdAt: new Date().toISOString() }; update(s => ({ ...s, customRoutines: [saved, ...s.customRoutines] })); nav.toast(t('Routine saved')); nav.push({ type: 'routine', id: saved.id }); }}>{t('Save Routine')}</Btn>
            <Btn kind="secondary" onClick={() => downloadFile(`${r.name.replace(/[^\w-]+/g, '-').toLowerCase()}.routine.json`, JSON.stringify(exportRoutineFile(r), null, 2))}>{t('Export')}</Btn>
          </div>
          <ol className="grid gap-1">
            {r.items.map((it, i) => (
              <li key={it.ex} className="flex items-center gap-3">
                <span className="w-5 text-right text-sm text-m-muted tabular-nums">{i + 1}</span>
                <button type="button" className="flex flex-1 items-center gap-3 min-w-0 text-left rounded-2xl p-1 min-h-[52px] hover:bg-m-soft" onClick={() => nav.push({ type: 'exercise', id: it.ex })}>
                  <Art id={it.ex} size={44} />
                  <span className="min-w-0"><span className="block font-medium truncate">{EX[it.ex].name}</span><span className="block text-sm text-m-muted">{t(doseLabel(it, EX[it.ex]))}</span></span>
                </button>
                <IconBtn label={t('Exclude {name} and plan again', { name: EX[it.ex].name })} onClick={() => change({ exclude: [...c.exclude, it.ex] })}><X size={18} className="text-m-muted" /></IconBtn>
              </li>
            ))}
          </ol>
        </section>
      )}
      <p className="text-sm text-m-muted mt-6">{t('This planner follows fixed rules: it filters the catalog by your settings, balances body areas and fits the time. It is not AI and nothing leaves your device.')}</p>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="py-2" role="group" aria-label={label}><p className="font-medium mb-1.5">{label}</p><div className="flex flex-wrap gap-1.5">{children}</div></div>;
}

function ImportPreview({ incoming, onClose, nav }: { incoming: { routine: Routine; dropped: string[] }; onClose: () => void; nav: Nav }) {
  const st = useMobility();
  const { routine, dropped } = incoming;
  const tot = routineTotals(routine, timingOf(st.settings));
  return (
    <Sheet title={t('Import this routine?')} onClose={onClose}>
      <p className="text-lg font-bold">{routine.name}</p>
      <p className="text-m-muted mb-2">{tot.estimated ? '≈ ' : ''}{fmtDuration(tot.total)} · {t('{n} movements', { n: routine.items.length })}</p>
      {dropped.length > 0 && <p className="text-sm mb-2">{t('{n} entries in the file are not in this catalog and will be left out.', { n: dropped.length })}</p>}
      <ol className="list-decimal pl-6 mb-4 max-h-56 overflow-y-auto">{routine.items.map((it, i) => <li key={i}>{EX[it.ex].name} · <span className="text-m-muted">{t(doseLabel(it, EX[it.ex]))}</span></li>)}</ol>
      <div className="flex gap-2">
        <Btn kind="secondary" className="flex-1" onClick={onClose}>{t('Cancel')}</Btn>
        <Btn className="flex-1" onClick={() => { update(s => ({ ...s, customRoutines: [{ ...routine, createdAt: new Date().toISOString() }, ...s.customRoutines] })); onClose(); nav.toast(t('Routine imported')); nav.push({ type: 'routine', id: routine.id }); }}>{t('Import')}</Btn>
      </div>
    </Sheet>
  );
}
