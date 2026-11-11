import React, { useMemo, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { update, useMobility } from '../lib/store';
import { EXERCISES, EX, GROUP_LABELS } from '../data/catalog';
import { FAMILY_LABELS, ROUTINES, SERIES } from '../data/routines';
import { allRoutines, conflicts, findRoutine, timingOf } from '../lib/routines';
import { routineAreas, routineEquipment, routineTotals } from '../lib/timeline';
import { formatDateKey } from '../lib/dates';
import { Art, Btn, Chip, Empty, Header, inputCls, Nav, RoutineRow, Section, Sheet } from './common';
import { AREA_LABEL, CATEGORY_LABEL, DIFFICULTY_LABEL, EQUIPMENT_LABEL, POSITION_LABEL, t } from '../i18n';
import { Area, Category, CatalogGroup, Difficulty, Equipment, Exercise, Position, Routine, RoutineFamily } from '../types';

type View = 'routines' | 'exercises' | 'favorites' | 'mine' | 'recent';
interface Filters {
  area: Area | ''; duration: '' | 'short' | 'medium' | 'long'; difficulty: Difficulty | ''; position: Position | '';
  category: Category | ''; equipment: Equipment | ''; respect: boolean;
}
const NO_FILTERS: Filters = { area: '', duration: '', difficulty: '', position: '', category: '', equipment: '', respect: false };

const words = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);
const matches = (hay: string, q: string[]) => q.every(w => hay.includes(w));

export function exerciseHaystack(e: Exercise): string {
  return [e.name, ...e.aliases, ...e.primary.map(a => AREA_LABEL[a]), ...e.secondary.map(a => AREA_LABEL[a]), EQUIPMENT_LABEL[e.equipment], CATEGORY_LABEL[e.category], POSITION_LABEL[e.position], GROUP_LABELS[e.group]].join(' ').toLowerCase();
}
function routineHaystack(r: Routine): string {
  return [r.name, r.purpose, FAMILY_LABELS[r.family], ...routineAreas(r).map(a => AREA_LABEL[a]), ...routineEquipment(r), ...r.items.map(i => EX[i.ex]?.name ?? '')].join(' ').toLowerCase();
}

export function Library({ nav }: { nav: Nav }) {
  const st = useMobility();
  const [view, setView] = useState<View>('routines');
  const [q, setQ] = useState('');
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const qs = words(q);
  const timing = timingOf(st.settings);
  const activeFilters = Object.entries(f).filter(([k, v]) => (k === 'respect' ? v === true : v !== '')).length;

  const routineOk = (r: Routine) => {
    if (!matches(routineHaystack(r), qs)) return false;
    if (f.difficulty && r.difficulty !== f.difficulty) return false;
    if (f.area && !routineAreas(r).slice(0, 3).includes(f.area)) return false;
    const min = routineTotals(r, timing).total / 60;
    if (f.duration === 'short' && min > 5) return false;
    if (f.duration === 'medium' && (min <= 5 || min > 12)) return false;
    if (f.duration === 'long' && min <= 12) return false;
    const exs = r.items.map(i => EX[i.ex]).filter(Boolean);
    if (f.position && !exs.every(e => e.position === f.position || e.alsoIn.includes(f.position as Position))) return false;
    if (f.category && !exs.some(e => e.category === f.category)) return false;
    if (f.equipment && (f.equipment === 'none' ? routineEquipment(r).length > 0 : !routineEquipment(r).includes(f.equipment))) return false;
    if (f.respect && conflicts(r, st.settings.cautions).length > 0) return false;
    return true;
  };
  const exerciseOk = (e: Exercise) => {
    if (!matches(exerciseHaystack(e), qs)) return false;
    if (f.difficulty && e.difficulty !== f.difficulty) return false;
    if (f.area && !e.primary.includes(f.area) && !e.secondary.includes(f.area)) return false;
    if (f.position && e.position !== f.position && !e.alsoIn.includes(f.position)) return false;
    if (f.category && e.category !== f.category) return false;
    if (f.equipment && e.equipment !== f.equipment) return false;
    if (f.respect && e.flags.some(x => st.settings.cautions.includes(x))) return false;
    return true;
  };

  const toggleFav = (id: string) => update(s => ({ ...s, favorites: { ...s.favorites, routines: s.favorites.routines.includes(id) ? s.favorites.routines.filter(x => x !== id) : [...s.favorites.routines, id] } }));
  const row = (r: Routine) => (
    <RoutineRow key={r.id} routine={r} settings={st.settings} onOpen={() => nav.push({ type: 'routine', id: r.id })} fav={st.favorites.routines.includes(r.id)} onFav={() => toggleFav(r.id)} />
  );

  const prepared = useMemo(() => ROUTINES.filter(routineOk), [q, f, st.settings]);
  const exercises = useMemo(() => EXERCISES.filter(exerciseOk), [q, f, st.settings.cautions]);
  const families = Object.keys(FAMILY_LABELS) as RoutineFamily[];
  const groups = Object.keys(GROUP_LABELS) as CatalogGroup[];
  const TABS: [View, string][] = [['routines', 'Routines'], ['exercises', 'Exercises'], ['favorites', 'Favorites'], ['mine', 'Custom'], ['recent', 'Recent']];

  return (
    <div className="m-fade">
      <Header title={t('Library')} />
      <div className="flex gap-2 mb-3">
        <label className="relative flex-1">
          <span className="sr-only">{t('Search routines and exercises')}</span>
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-m-muted" aria-hidden="true" />
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('Search name, area, equipment')} className={inputCls + ' pl-10'} />
        </label>
        <Btn kind="secondary" onClick={() => setShowFilters(true)} aria-label={t('Filters, {n} active', { n: activeFilters })}>
          <SlidersHorizontal size={18} />{activeFilters > 0 ? activeFilters : ''}
        </Btn>
      </div>
      <div role="tablist" aria-label={t('Library sections')} className="m-scroll-x flex gap-1 mb-4 -mx-4 px-4 border-b border-m-line">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={view === id} type="button" onClick={() => setView(id)}
            className={`shrink-0 px-3 py-2.5 min-h-[44px] text-[0.95rem] font-semibold border-b-2 -mb-px ${view === id ? 'border-m-accent text-m-text' : 'border-transparent text-m-muted'}`}>
            {t(label)}
          </button>
        ))}
      </div>

      {view === 'routines' && (
        <>
          <p className="text-sm text-m-muted mb-3" aria-live="polite">{t('{n} routines', { n: prepared.length })}</p>
          {prepared.length === 0 && <Empty>{t('No routines match. Clear a filter or change the search.')}</Empty>}
          {families.map(fam => {
            const list = prepared.filter(r => r.family === fam);
            return list.length === 0 ? null : (
              <Section key={fam} title={t(FAMILY_LABELS[fam])}><div className="grid gap-2 md:grid-cols-2">{list.map(row)}</div></Section>
            );
          })}
          {qs.length === 0 && activeFilters === 0 && (
            <Section title={t('Weekly series')}>
              <div className="grid gap-2 md:grid-cols-2">
                {SERIES.map(s => (
                  <button key={s.id} type="button" onClick={() => nav.push({ type: 'series', id: s.id })} className="m-card p-3.5 text-left min-h-[64px]">
                    <span className="block font-semibold">{s.name}</span>
                    <span className="block text-sm text-m-muted">{t(DIFFICULTY_LABEL[s.difficulty])} · {s.purpose}</span>
                  </button>
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      {view === 'exercises' && (
        <>
          <p className="text-sm text-m-muted mb-3" aria-live="polite">{t('{n} exercises', { n: exercises.length })}</p>
          {exercises.length === 0 && <Empty>{t('No exercises match. Clear a filter or change the search.')}</Empty>}
          {groups.map(g => {
            const list = exercises.filter(e => e.group === g);
            return list.length === 0 ? null : (
              <Section key={g} title={t(GROUP_LABELS[g])}>
                <ul className="grid gap-1.5 md:grid-cols-2">
                  {list.map(e => (
                    <li key={e.id}>
                      <button type="button" onClick={() => nav.push({ type: 'exercise', id: e.id })} className="flex w-full items-center gap-3 rounded-2xl p-1.5 text-left min-h-[56px] hover:bg-m-soft">
                        <Art id={e.id} size={52} />
                        <span className="min-w-0">
                          <span className="block font-medium leading-snug">{e.name}{st.favorites.exercises.includes(e.id) && <span className="text-m-accent" aria-label={t('favorite')}> ♥</span>}</span>
                          <span className="block text-sm text-m-muted">{t(CATEGORY_LABEL[e.category])} · {t(DIFFICULTY_LABEL[e.difficulty])}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Section>
            );
          })}
        </>
      )}

      {view === 'favorites' && (
        <>
          <Section title={t('Routines')}>
            {st.favorites.routines.length === 0 ? <Empty>{t('Tap the heart on a routine to keep it here.')}</Empty> :
              <div className="grid gap-2 md:grid-cols-2">{st.favorites.routines.map(id => findRoutine(id, st)).filter(Boolean).map(r => row(r!))}</div>}
          </Section>
          <Section title={t('Exercises')}>
            {st.favorites.exercises.length === 0 ? <Empty>{t('Favorite exercises appear here.')}</Empty> :
              <div className="flex flex-wrap gap-3">
                {st.favorites.exercises.filter(id => EX[id]).map(id => (
                  <button key={id} type="button" onClick={() => nav.push({ type: 'exercise', id })} className="w-24 text-center text-sm">
                    <Art id={id} size={80} className="mx-auto" /><span className="block mt-1 leading-tight">{EX[id].name}</span>
                  </button>
                ))}
              </div>}
          </Section>
        </>
      )}

      {view === 'mine' && (
        <>
          <div className="flex gap-2 mb-4">
            <Btn onClick={() => nav.push({ type: 'builder' })}>{t('New routine')}</Btn>
            <Btn kind="secondary" onClick={() => nav.goTab('create')}>{t('Create options')}</Btn>
          </div>
          {st.customRoutines.length === 0 ? <Empty>{t('Routines you build, generate or copy are kept here.')}</Empty> :
            <div className="grid gap-2 md:grid-cols-2">{st.customRoutines.filter(routineOk).map(row)}</div>}
        </>
      )}

      {view === 'recent' && (
        st.history.length === 0 ? <Empty>{t('Sessions you complete will be listed here.')}</Empty> :
          <ul className="grid gap-2">
            {[...st.history].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 20).map(h => {
              const r = findRoutine(h.routineId, st);
              return (
                <li key={h.id} className="m-card flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{h.routineName}</p>
                    <p className="text-sm text-m-muted">{formatDateKey(h.dateKey)} · {t('{n} min active', { n: Math.round(h.activeSec / 60) })}{h.source === 'manual' ? ` · ${t('added by hand')}` : ''}</p>
                  </div>
                  {r && <Btn kind="secondary" onClick={() => nav.push({ type: 'routine', id: r.id })}>{t('Open')}</Btn>}
                </li>
              );
            })}
          </ul>
      )}

      {showFilters && (
        <Sheet title={t('Filters')} onClose={() => setShowFilters(false)}>
          <FilterGroup label={t('Body area')} value={f.area} onChange={v => setF({ ...f, area: v as Area | '' })} options={Object.entries(AREA_LABEL)} />
          {view !== 'exercises' && <FilterGroup label={t('Duration')} value={f.duration} onChange={v => setF({ ...f, duration: v as Filters['duration'] })} options={[['short', 'Up to 5 min'], ['medium', '5 to 12 min'], ['long', 'Over 12 min']]} />}
          <FilterGroup label={t('Difficulty')} value={f.difficulty} onChange={v => setF({ ...f, difficulty: v as Difficulty | '' })} options={Object.entries(DIFFICULTY_LABEL)} />
          <FilterGroup label={t('Position')} value={f.position} onChange={v => setF({ ...f, position: v as Position | '' })} options={Object.entries(POSITION_LABEL)} />
          <FilterGroup label={t('Movement type')} value={f.category} onChange={v => setF({ ...f, category: v as Category | '' })} options={Object.entries(CATEGORY_LABEL)} />
          <FilterGroup label={t('Equipment')} value={f.equipment} onChange={v => setF({ ...f, equipment: v as Equipment | '' })} options={Object.entries(EQUIPMENT_LABEL)} />
          <div className="mb-4">
            <p className="text-sm font-medium mb-1.5">{t('Caution preferences')}</p>
            <Chip on={f.respect} onClick={() => setF({ ...f, respect: !f.respect })}>{t('Hide what I prefer to avoid')}</Chip>
            {st.settings.cautions.length === 0 && <p className="text-sm text-m-muted mt-1.5">{t('You have not set any avoid preferences. Add them in Settings.')}</p>}
          </div>
          <div className="flex gap-2">
            <Btn kind="secondary" className="flex-1" onClick={() => setF(NO_FILTERS)}>{t('Clear all')}</Btn>
            <Btn className="flex-1" onClick={() => setShowFilters(false)}>{t('Show results')}</Btn>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function FilterGroup({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="mb-4" role="group" aria-label={label}>
      <p className="text-sm font-medium mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([v, l]) => <Chip key={v} on={value === v} onClick={() => onChange(value === v ? '' : v)}>{t(l)}</Chip>)}
      </div>
    </div>
  );
}
