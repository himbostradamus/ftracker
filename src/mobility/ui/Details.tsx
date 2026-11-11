import React, { useState } from 'react';
import { Copy, Download, Heart, Pencil, Play, Trash2 } from 'lucide-react';
import { update, useMobility } from '../lib/store';
import { EX } from '../data/catalog';
import { ROUTINES, SERIES_BY_ID } from '../data/routines';
import { adaptedCopy, alternativeFor, conflicts, customCopy, findRoutine, startSeries, timingOf } from '../lib/routines';
import { doseLabel, routineAreas, routineEquipment, routineTotals } from '../lib/timeline';
import { addDays, dateKeyInTz, fmtDuration, formatDateKey, resolveTz } from '../lib/dates';
import { downloadFile, exportRoutineFile } from '../lib/backup';
import { Art, Btn, Cover, Header, IconBtn, Nav, Section, Sheet, inputCls } from './common';
import { AREA_LABEL, CATEGORY_LABEL, CAUTION_LABEL, DIFFICULTY_LABEL, EQUIPMENT_LABEL, POSITION_LABEL, SIDES_LABEL, SPACE_LABEL, t } from '../i18n';
import { Routine } from '../types';

export function RoutineDetail({ id, given, nav }: { id: string; given?: Routine; nav: Nav }) {
  const st = useMobility();
  const routine = given ?? findRoutine(id, st);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!routine) return <><Header title={t('Routine not found')} onBack={nav.pop} /><p className="text-m-muted">{t('This routine no longer exists.')}</p></>;
  const timing = timingOf(st.settings);
  const tot = routineTotals(routine, timing);
  const equip = routineEquipment(routine);
  const flagged = conflicts(routine, st.settings.cautions);
  const fav = st.favorites.routines.includes(routine.id);
  const saved = !!findRoutine(routine.id, st);
  const isCustom = !!routine.custom && saved;

  const saveCopy = (r: Routine, msg: string) => {
    update(s => ({ ...s, customRoutines: [r, ...s.customRoutines] }));
    nav.toast(msg);
    return r;
  };
  const remove = () => {
    const before = st;
    update(s => ({ ...s, customRoutines: s.customRoutines.filter(r => r.id !== routine.id), favorites: { ...s.favorites, routines: s.favorites.routines.filter(x => x !== routine.id) }, recent: s.recent.filter(x => x !== routine.id) }));
    nav.pop();
    nav.toast(t('Deleted "{name}"', { name: routine.name }), () => update(s => ({ ...s, customRoutines: before.customRoutines, favorites: before.favorites, recent: before.recent })));
  };

  return (
    <div className="m-fade">
      <Header title={routine.name} onBack={nav.pop} right={saved ? (
        <IconBtn label={fav ? t('Remove from favorites') : t('Add to favorites')} aria-pressed={fav}
          onClick={() => update(s => ({ ...s, favorites: { ...s.favorites, routines: fav ? s.favorites.routines.filter(x => x !== routine.id) : [...s.favorites.routines, routine.id] } }))}>
          <Heart size={22} fill={fav ? 'currentColor' : 'none'} className={fav ? 'text-m-accent' : ''} />
        </IconBtn>
      ) : undefined} />

      <div className="flex gap-4 mb-4">
        <Cover routine={routine} size={96} />
        <div className="min-w-0">
          <p className="text-[1.5rem] font-bold leading-none">{tot.estimated ? '≈ ' : ''}{fmtDuration(tot.total)}</p>
          <p className="text-sm text-m-muted mt-1">
            {t('{work} of movement, {rest} of preparation and transitions', { work: fmtDuration(tot.work), rest: fmtDuration(tot.total - tot.work) })}
          </p>
          {tot.estimated && <p className="text-sm text-m-muted">{t('Includes repetition-based movements, so the time is an estimate.')}</p>}
        </div>
      </div>
      {routine.purpose && <p className="mb-3">{routine.purpose}</p>}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-4">
        <dt className="text-m-muted">{t('Difficulty')}</dt><dd>{t(DIFFICULTY_LABEL[routine.difficulty])}</dd>
        <dt className="text-m-muted">{t('Equipment')}</dt><dd>{equip.length ? equip.map(e => t(EQUIPMENT_LABEL[e])).join(', ') : t('None')}</dd>
        <dt className="text-m-muted">{t('Main areas')}</dt><dd>{routineAreas(routine).slice(0, 3).map(a => t(AREA_LABEL[a])).join(', ')}</dd>
        <dt className="text-m-muted">{t('Transitions')}</dt><dd>{t('{n} sec between movements', { n: timing.transitionSec })}</dd>
      </dl>

      {flagged.length > 0 && (
        <div className="m-card p-4 mb-4">
          <p className="font-semibold mb-1">{t('{n} movements touch your avoid preferences', { n: flagged.length })}</p>
          <ul className="text-sm text-m-muted mb-3 list-disc pl-5">
            {flagged.map(({ ex, flags }) => {
              const alt = alternativeFor(ex, st.settings.cautions, st.settings.level);
              return <li key={ex.id}>{ex.name}: {flags.map(f => t(CAUTION_LABEL[f]).toLowerCase()).join(', ')}. {alt ? t('Alternative: {name}.', { name: alt.name }) : t('No close alternative; it would be removed.')}</li>;
            })}
          </ul>
          <Btn kind="secondary" onClick={() => {
            const { routine: r, swapped, removed } = adaptedCopy(routine, st.settings.cautions, st.settings.level);
            if (r.items.length === 0) { nav.toast(t('Nothing would be left after removing those movements.')); return; }
            saveCopy(r, t('Saved an adapted copy: {s} swapped, {r} removed', { s: swapped, r: removed }));
            nav.pop(); nav.push({ type: 'routine', id: r.id });
          }}>{t('Make an adapted copy')}</Btn>
        </div>
      )}

      <Btn className="w-full text-base py-3 mb-3" onClick={() => nav.start(routine)}><Play size={18} fill="currentColor" />{t('Start')}</Btn>
      <div className="flex flex-wrap gap-2 mb-6">
        {isCustom && <Btn kind="secondary" onClick={() => nav.push({ type: 'builder', routine })}><Pencil size={16} />{t('Edit')}</Btn>}
        {!saved && <Btn kind="secondary" onClick={() => { const r = { ...routine, createdAt: new Date().toISOString() }; saveCopy(r, t('Routine saved')); nav.pop(); nav.push({ type: 'routine', id: r.id }); }}>{t('Save Routine')}</Btn>}
        {!saved && <Btn kind="secondary" onClick={() => nav.push({ type: 'builder', routine })}><Pencil size={16} />{t('Edit')}</Btn>}
        {saved && <Btn kind="secondary" onClick={() => { const r = saveCopy(customCopy(routine), t('Saved an editable copy')); nav.push({ type: 'builder', routine: r }); }}><Copy size={16} />{isCustom ? t('Duplicate') : t('Edit a copy')}</Btn>}
        <Btn kind="secondary" onClick={() => downloadFile(`${routine.name.replace(/[^\w-]+/g, '-').toLowerCase()}.routine.json`, JSON.stringify(exportRoutineFile(routine), null, 2))}><Download size={16} />{t('Export')}</Btn>
        {isCustom && <Btn kind="danger" onClick={() => setConfirmDelete(true)}><Trash2 size={16} />{t('Delete')}</Btn>}
      </div>

      <Section title={t('Sequence')}>
        <ol className="grid gap-1">
          {routine.items.map((it, i) => {
            const ex = EX[it.ex];
            if (!ex) return <li key={i} className="text-m-danger">{t('Unknown movement')} ({it.ex})</li>;
            return (
              <li key={i}>
                {i > 0 && it.before !== undefined && <p className="text-xs text-m-muted pl-[68px] py-0.5">{t('{n} sec transition', { n: it.before })}</p>}
                <button type="button" onClick={() => nav.push({ type: 'exercise', id: ex.id })} className="flex w-full items-center gap-3 rounded-2xl p-1.5 text-left min-h-[56px] hover:bg-m-soft">
                  <span className="w-5 text-right text-sm tabular-nums text-m-muted">{i + 1}</span>
                  <Art id={ex.id} size={48} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium leading-snug">{ex.name}</span>
                    <span className="block text-sm text-m-muted">{t(doseLabel(it, ex))}{ex.sides === 'alt' ? ` · ${t('alternating')}` : ''}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </Section>

      {confirmDelete && (
        <Sheet title={t('Delete this routine?')} onClose={() => setConfirmDelete(false)}>
          <p className="mb-4 text-m-muted">{t('"{name}" will be removed. Past sessions stay in your history. You can undo straight afterwards.', { name: routine.name })}</p>
          <div className="flex gap-2"><Btn kind="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>{t('Keep')}</Btn><Btn kind="danger" className="flex-1" onClick={remove}>{t('Delete')}</Btn></div>
        </Sheet>
      )}
    </div>
  );
}

export function ExerciseBody({ id, onOpen }: { id: string; onOpen?: (id: string) => void }) {
  const ex = EX[id];
  if (!ex) return <p>{t('Unknown movement')}</p>;
  const list = (items: string[]) => <ul className="list-disc pl-5 space-y-1">{items.map((s, i) => <li key={i}>{s}</li>)}</ul>;
  return (
    <div>
      <p className="mb-4">{ex.desc}</p>
      <h3 className="font-semibold mb-1.5">{t('How to do it')}</h3>
      <ol className="list-decimal pl-5 space-y-1.5 mb-4">{ex.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      {ex.breath && <><h3 className="font-semibold mb-1">{t('Breathing')}</h3><p className="mb-4">{ex.breath}</p></>}
      <h3 className="font-semibold mb-1">{t('Common errors')}</h3><div className="mb-4">{list(ex.errors)}</div>
      <h3 className="font-semibold mb-1">{t('Make it easier')}</h3><p className="mb-4">{ex.easier}</p>
      {ex.caution && <><h3 className="font-semibold mb-1">{t('Caution')}</h3><p className="mb-4">{ex.caution}</p></>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm mb-4">
        <dt className="text-m-muted">{t('Targets')}</dt><dd>{ex.primary.map(a => t(AREA_LABEL[a])).join(', ')}</dd>
        {ex.secondary.length > 0 && <><dt className="text-m-muted">{t('Also')}</dt><dd>{ex.secondary.map(a => t(AREA_LABEL[a])).join(', ')}</dd></>}
        <dt className="text-m-muted">{t('Type')}</dt><dd>{t(CATEGORY_LABEL[ex.category])}</dd>
        <dt className="text-m-muted">{t('Difficulty')}</dt><dd>{t(DIFFICULTY_LABEL[ex.difficulty])}</dd>
        <dt className="text-m-muted">{t('Position')}</dt><dd>{[ex.position, ...ex.alsoIn].map(p => t(POSITION_LABEL[p])).join(' / ')}</dd>
        <dt className="text-m-muted">{t('Sides')}</dt><dd>{t(SIDES_LABEL[ex.sides])}</dd>
        <dt className="text-m-muted">{t('Equipment')}</dt><dd>{t(EQUIPMENT_LABEL[ex.equipment])}</dd>
        <dt className="text-m-muted">{t('Space')}</dt><dd>{t(SPACE_LABEL[ex.space])}</dd>
        <dt className="text-m-muted">{t('Default')}</dt><dd>{t(doseLabel({ ex: ex.id, dose: ex.dose }, ex))}</dd>
        {ex.flags.length > 0 && <><dt className="text-m-muted">{t('Involves')}</dt><dd>{ex.flags.map(f => t(CAUTION_LABEL[f])).join(', ')}</dd></>}
        {ex.aliases.length > 0 && <><dt className="text-m-muted">{t('Also called')}</dt><dd>{ex.aliases.join(', ')}</dd></>}
        <dt className="text-m-muted">{t('Demonstration')}</dt><dd>{ex.demo.status === 'bundled' ? t('Available offline') : t('No video yet. The illustration and steps are the reference.')}</dd>
      </dl>
      {onOpen && (
        <>
          <h3 className="font-semibold mb-2">{t('Related movements')}</h3>
          <div className="flex flex-wrap gap-3">
            {ex.related.map(r => (
              <button key={r} type="button" onClick={() => onOpen(r)} className="w-20 text-center text-sm">
                <Art id={r} size={72} className="mx-auto" /><span className="block mt-1 leading-tight">{EX[r].name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function ExerciseDetail({ id, nav }: { id: string; nav: Nav }) {
  const st = useMobility();
  const ex = EX[id];
  if (!ex) return <Header title={t('Unknown movement')} onBack={nav.pop} />;
  const fav = st.favorites.exercises.includes(id);
  return (
    <div className="m-fade">
      <Header title={ex.name} onBack={nav.pop} right={
        <IconBtn label={fav ? t('Remove from favorites') : t('Add to favorites')} aria-pressed={fav}
          onClick={() => update(s => ({ ...s, favorites: { ...s.favorites, exercises: fav ? s.favorites.exercises.filter(x => x !== id) : [...s.favorites.exercises, id] } }))}>
          <Heart size={22} fill={fav ? 'currentColor' : 'none'} className={fav ? 'text-m-accent' : ''} />
        </IconBtn>} />
      <div className="md:flex md:gap-8">
        <div className="mb-4 md:w-72 shrink-0"><Art id={id} size="100%" className="max-w-[280px] mx-auto block h-auto" /></div>
        <div className="flex-1 min-w-0">
          <ExerciseBody id={id} onOpen={r => nav.push({ type: 'exercise', id: r })} />
          <Btn kind="secondary" className="mt-5" onClick={() => nav.start({ id: `single-${id}`, name: ex.name, purpose: '', family: 'mixed', difficulty: ex.difficulty, items: [{ ex: id, dose: ex.dose }] })}>
            {t('Do just this one')}
          </Btn>
        </div>
      </div>
    </div>
  );
}

export function SeriesView({ id, nav }: { id: string; nav: Nav }) {
  const st = useMobility();
  const series = SERIES_BY_ID[id];
  const [editing, setEditing] = useState<number | null>(null);
  if (!series) return <Header title={t('Series not found')} onBack={nav.pop} />;
  const today = dateKeyInTz(new Date(), resolveTz(st.settings.timezone));
  const active = st.series?.seriesId === id ? st.series : null;
  const days = active ? active.days : series.days.map((d, i) => ({ date: addDays(today, i), routine: d.routine, sessionId: undefined as string | undefined }));
  const setDays = (fn: (d: typeof days) => typeof days) => update(s => (s.series ? { ...s, series: { ...s.series, days: fn(s.series.days) } } : s));

  return (
    <div className="m-fade">
      <Header title={series.name} onBack={nav.pop} sub={t(DIFFICULTY_LABEL[series.difficulty])} />
      <p className="mb-2">{series.purpose}</p>
      <p className="text-sm text-m-muted mb-4">{t('A series is a suggested schedule. Any day can be started early, moved or swapped, and finishing it says nothing about your flexibility.')}</p>
      <div className="flex flex-wrap gap-2 mb-5">
        {!active && <Btn onClick={() => { update(s => ({ ...s, series: startSeries(id, today) })); nav.toast(st.series ? t('Series replaced') : t('Series started')); }}>{st.series ? t('Switch to this series') : t('Start this series today')}</Btn>}
        {active && <Btn kind="secondary" onClick={() => { update(s => ({ ...s, series: startSeries(id, today) })); nav.toast(t('Series restarted from today')); }}>{t('Repeat from today')}</Btn>}
        {active && <Btn kind="danger" onClick={() => { const prev = st.series; update(s => ({ ...s, series: null })); nav.toast(t('Series stopped'), () => update(s => ({ ...s, series: prev }))); }}>{t('Stop series')}</Btn>}
      </div>
      <ol className="grid gap-2">
        {days.map((d, i) => {
          const r = findRoutine(d.routine, st);
          return (
            <li key={i} className="m-card p-3">
              <div className="flex items-center gap-3">
                <div className="w-16 shrink-0">
                  <p className="text-sm font-semibold">{t('Day {n}', { n: i + 1 })}</p>
                  <p className="text-xs text-m-muted">{formatDateKey(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{r ? r.name : t('Rest day')}</p>
                  <p className="text-sm text-m-muted">{d.sessionId ? t('Done ✓') : d.date === today ? t('Today') : d.date < today && r ? t('Not done') : ''}</p>
                </div>
                {r && <Btn kind="secondary" onClick={() => nav.push({ type: 'routine', id: r.id })}>{t('Open')}</Btn>}
              </div>
              {active && (
                <div className="flex flex-wrap gap-x-4 mt-2 text-sm">
                  <button type="button" className="text-m-accent font-medium min-h-[40px]" onClick={() => setEditing(i)}>{t('Replace')}</button>
                  <button type="button" className="text-m-accent font-medium min-h-[40px]" onClick={() => setDays(ds => ds.map((x, j) => (j >= i ? { ...x, date: addDays(x.date, 1) } : x)))}>{t('Move this and later days back one day')}</button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {editing !== null && <ReplaceDay onClose={() => setEditing(null)} onPick={rid => { setDays(ds => ds.map((x, j) => (j === editing ? { ...x, routine: rid, sessionId: undefined } : x))); setEditing(null); }} />}
    </div>
  );
}

function ReplaceDay({ onClose, onPick }: { onClose: () => void; onPick: (id: string | null) => void }) {
  const st = useMobility();
  const [q, setQ] = useState('');
  const routines = [...st.customRoutines, ...ROUTINES].filter(r => r.name.toLowerCase().includes(q.toLowerCase())).slice(0, 40);
  return (
    <Sheet title={t('Replace this day')} onClose={onClose}>
      <input type="search" className={inputCls + ' mb-3'} placeholder={t('Search routines')} value={q} onChange={e => setQ(e.target.value)} aria-label={t('Search routines')} />
      <button type="button" className="block w-full text-left py-3 font-medium border-b border-m-line" onClick={() => onPick(null)}>{t('Rest day')}</button>
      <ul>{routines.map(r => <li key={r.id}><button type="button" className="block w-full text-left py-3 border-b border-m-line" onClick={() => onPick(r.id)}>{r.name}</button></li>)}</ul>
    </Sheet>
  );
}
