import React, { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, GripVertical, Plus, Trash2 } from 'lucide-react';
import { update, useMobility, uid } from '../lib/store';
import { EX, EXERCISES, GROUP_LABELS } from '../data/catalog';
import { routineDifficulty, timingOf } from '../lib/routines';
import { doseLabel, routineTotals, unitOf } from '../lib/timeline';
import { fmtDuration } from '../lib/dates';
import { BADGE_BG } from '../art/Figure';
import { Art, Btn, Chip, Empty, Field, Header, IconBtn, Nav, Section, Sheet, inputCls } from './common';
import { exerciseHaystack } from './Library';
import { DIFFICULTY_LABEL, t } from '../i18n';
import { CatalogGroup, Routine, RoutineItem } from '../types';

type Row = RoutineItem & { key: string };
const toRows = (items: RoutineItem[]): Row[] => items.map(i => ({ ...i, key: uid() }));
const TRANSITIONS = [0, 3, 5, 8, 10, 15, 20, 30, 45, 60];

async function shrinkImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('bad image')); i.src = url; });
    const size = 256, c = document.createElement('canvas');
    c.width = c.height = size;
    const k = Math.max(size / img.width, size / img.height);
    c.getContext('2d')!.drawImage(img, (size - img.width * k) / 2, (size - img.height * k) / 2, img.width * k, img.height * k);
    return c.toDataURL('image/jpeg', 0.8);
  } finally { URL.revokeObjectURL(url); }
}

export function Builder({ initial, nav }: { initial?: Routine; nav: Nav }) {
  const st = useMobility();
  const existing = !!initial && st.customRoutines.some(r => r.id === initial.id);
  const [name, setName] = useState(initial?.name ?? '');
  const [rows, setRows] = useState<Row[]>(() => toRows(initial?.items ?? []));
  const [cover, setCover] = useState(initial?.cover ?? { color: BADGE_BG[0] });
  const [picking, setPicking] = useState(!initial);
  const [open, setOpen] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const timing = timingOf(st.settings);
  const items: RoutineItem[] = rows.map(({ key, ...it }) => it);
  const tot = routineTotals({ items }, timing);
  const listRef = useRef<HTMLOListElement>(null);
  const drag = useRef<{ key: string; y: number; h: number } | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const patch = (key: string, p: Partial<RoutineItem>) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...p } : r)));
  const move = (i: number, d: number) => setRows(rs => {
    const j = i + d;
    if (j < 0 || j >= rs.length) return rs;
    const c = [...rs]; [c[i], c[j]] = [c[j], c[i]]; return c;
  });
  const add = (id: string) => setRows(rs => [...rs, { ex: id, dose: EX[id].dose, key: uid() }]);

  const onDragStart = (e: React.PointerEvent, key: string) => {
    const li = (e.currentTarget as HTMLElement).closest('li');
    drag.current = { key, y: e.clientY, h: li?.getBoundingClientRect().height ?? 64 };
    setDragKey(key);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const steps = Math.trunc((e.clientY - d.y) / (d.h * 0.7));
    if (steps === 0) return;
    const dir = Math.sign(steps);
    setRows(rs => {
      const i = rs.findIndex(r => r.key === d.key), j = i + dir;
      if (i < 0 || j < 0 || j >= rs.length) return rs;
      const c = [...rs]; [c[i], c[j]] = [c[j], c[i]]; return c;
    });
    d.y += dir * d.h;
  };
  const onDragEnd = () => { drag.current = null; setDragKey(null); };

  const draft = (): Routine => ({
    id: existing ? initial!.id : `custom-${uid()}`,
    name: name.trim() || t('My routine'), purpose: existing ? initial!.purpose : initial?.generated ? initial.purpose : '',
    family: 'mixed', difficulty: routineDifficulty(items), items, custom: true, cover,
    createdAt: (existing && initial!.createdAt) || new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  const save = () => {
    if (items.length === 0) { nav.toast(t('Add at least one movement first.')); return; }
    const r = draft();
    update(s => ({ ...s, customRoutines: existing ? s.customRoutines.map(x => (x.id === r.id ? r : x)) : [r, ...s.customRoutines] }));
    nav.toast(t('Routine saved'));
    nav.pop();
    if (!existing) nav.push({ type: 'routine', id: r.id });
  };

  return (
    <div className="m-fade pb-24">
      <Header title={existing ? t('Edit routine') : t('Build a routine')} onBack={nav.pop} />
      <Field label={t('Name')}><input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder={t('My routine')} maxLength={80} /></Field>

      <Section title={t('Sequence')} action={<span className="text-sm text-m-muted tabular-nums" aria-live="polite">{tot.estimated ? '≈ ' : ''}{fmtDuration(tot.total)} · {t('{n} movements', { n: rows.length })}</span>}>
        {rows.length === 0 && <Empty>{t('No movements yet. Add some below.')}</Empty>}
        <ol ref={listRef} className="grid gap-2">
          {rows.map((r, i) => {
            const ex = EX[r.ex];
            const unit = unitOf(r, ex);
            const expanded = open === r.key;
            const stepBy = unit === 'sec' ? 5 : 1;
            return (
              <li key={r.key} className={`m-card p-2 ${dragKey === r.key ? 'ring-2 ring-m-accent' : ''}`}>
                <div className="flex items-center gap-1.5">
                  <span role="button" tabIndex={-1} aria-hidden="true" title={t('Drag to reorder')} className="m-tap grid place-items-center text-m-muted touch-none cursor-grab"
                    onPointerDown={e => onDragStart(e, r.key)} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd}>
                    <GripVertical size={20} />
                  </span>
                  <span className="w-5 text-sm text-m-muted tabular-nums text-right">{i + 1}</span>
                  <button type="button" className="flex flex-1 items-center gap-2.5 min-w-0 text-left min-h-[48px]" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : r.key)}>
                    <Art id={r.ex} size={44} />
                    <span className="min-w-0">
                      <span className="block font-medium leading-snug truncate">{ex.name}</span>
                      <span className="block text-sm text-m-muted">{t(doseLabel(r, ex))}{i > 0 && r.before !== undefined ? ` · ${t('{n} sec before', { n: r.before })}` : ''}</span>
                    </span>
                  </button>
                  <IconBtn label={t('Move {name} up', { name: ex.name })} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={18} /></IconBtn>
                  <IconBtn label={t('Move {name} down', { name: ex.name })} disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown size={18} /></IconBtn>
                </div>
                {expanded && (
                  <div className="mt-2 border-t border-m-line pt-3 px-1 grid gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{unit === 'sec' ? t('Hold') : t('Repetitions')}{ex.sides === 'each' ? ` (${t('each side')})` : ''}</span>
                      <div className="flex items-center gap-1">
                        <IconBtn label={t('Less')} className="border border-m-line text-lg" onClick={() => patch(r.key, { dose: Math.max(stepBy, r.dose - stepBy) })}>−</IconBtn>
                        <span className="w-20 text-center font-semibold tabular-nums">{r.dose} {unit === 'sec' ? t('sec') : t('reps')}</span>
                        <IconBtn label={t('More')} className="border border-m-line text-lg" onClick={() => patch(r.key, { dose: Math.min(unit === 'sec' ? 600 : 100, r.dose + stepBy) })}>+</IconBtn>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{t('Measured in')}</span>
                      <div className="flex gap-1.5">
                        <Chip on={unit === 'sec'} onClick={() => unit !== 'sec' && patch(r.key, { unit: 'sec', dose: Math.max(10, Math.round((r.dose * ex.secPerRep) / 5) * 5) })}>{t('Seconds')}</Chip>
                        <Chip on={unit === 'reps'} onClick={() => unit !== 'reps' && patch(r.key, { unit: 'reps', dose: Math.max(1, Math.round(r.dose / ex.secPerRep)) })}>{t('Repetitions')}</Chip>
                      </div>
                    </div>
                    {unit === 'reps' && <p className="text-sm text-m-muted -mt-1">{t('Timed at about {n} sec per repetition, so the routine total is an estimate.', { n: ex.secPerRep })}</p>}
                    {i > 0 && (
                      <label className="flex items-center justify-between gap-2">
                        <span className="font-medium">{t('Time to get into position')}</span>
                        <select className="m-tap rounded-lg border border-m-line bg-m-surface px-2 py-2" value={r.before ?? ''} onChange={e => patch(r.key, { before: e.target.value === '' ? undefined : Number(e.target.value) })}>
                          <option value="">{t('Default ({n} sec)', { n: timing.transitionSec })}</option>
                          {TRANSITIONS.map(n => <option key={n} value={n}>{t('{n} sec', { n })}</option>)}
                        </select>
                      </label>
                    )}
                    <div className="flex gap-2">
                      <Btn kind="secondary" onClick={() => setRows(rs => { const c = [...rs]; c.splice(i + 1, 0, { ...r, key: uid() }); return c; })}><Copy size={16} />{t('Duplicate')}</Btn>
                      <Btn kind="danger" onClick={() => { const prev = rows; setRows(rs => rs.filter(x => x.key !== r.key)); nav.toast(t('Removed {name}', { name: ex.name }), () => setRows(prev)); }}><Trash2 size={16} />{t('Remove')}</Btn>
                      <Btn kind="ghost" onClick={() => nav.push({ type: 'exercise', id: r.ex })}>{t('Instructions')}</Btn>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <Btn kind="secondary" className="w-full mt-3" onClick={() => setPicking(true)}><Plus size={18} />{t('Add movements')}</Btn>
        <p className="text-sm text-m-muted mt-2">{t('Movements are {n} sec apart by default. Tap one to change its time, sides are handled automatically, and a longer pause can be set where you change position.', { n: timing.transitionSec })}</p>
      </Section>

      <Section title={t('Cover')}>
        <div className="flex flex-wrap items-center gap-2 mb-3" role="group" aria-label={t('Cover color')}>
          {BADGE_BG.map((c, i) => (
            <button key={c} type="button" aria-label={t('Color {n}', { n: i + 1 })} aria-pressed={cover.color === c} onClick={() => setCover({ ...cover, color: c })}
              className={`h-11 w-11 rounded-full border-2 ${cover.color === c ? 'border-m-text' : 'border-m-line'}`} style={{ background: c }}>
              {cover.color === c && <span aria-hidden="true" className="text-[#20211F]">✓</span>}
            </button>
          ))}
        </div>
        {rows.length > 0 && (
          <div className="m-scroll-x flex gap-2 mb-3" role="group" aria-label={t('Cover illustration')}>
            {[...new Set(rows.map(r => r.ex))].slice(0, 12).map(id => (
              <button key={id} type="button" aria-label={EX[id].name} aria-pressed={cover.ex === id && !cover.image} onClick={() => setCover({ color: cover.color, ex: id })}
                className={`shrink-0 rounded-2xl border-2 ${cover.ex === id && !cover.image ? 'border-m-text' : 'border-transparent'}`} style={{ background: cover.color }}>
                <Art id={id} size={56} badge={false} />
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          {cover.image && <img src={cover.image} alt={t('Chosen cover image')} className="h-14 w-14 rounded-2xl object-cover" />}
          <label className="m-tap inline-flex items-center rounded-xl border border-m-line bg-m-surface px-4 py-2.5 font-semibold cursor-pointer">
            {cover.image ? t('Change image') : t('Use my own image')}
            <input type="file" accept="image/*" className="sr-only" onChange={async e => {
              const f = e.target.files?.[0]; e.target.value = '';
              if (!f) return;
              try { setCover({ ...cover, image: await shrinkImage(f) }); } catch { nav.toast(t('That image could not be read.')); }
            }} />
          </label>
          {cover.image && <Btn kind="ghost" onClick={() => setCover({ color: cover.color, ex: cover.ex })}>{t('Remove image')}</Btn>}
        </div>
        {cover.image && <p className="text-sm text-m-muted mt-2">{t('The image is shrunk and stored on this device with the routine.')}</p>}
      </Section>

      <div className="fixed bottom-0 inset-x-0 md:left-56 z-30 border-t border-m-line bg-m-surface px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Btn kind="secondary" className="flex-1" disabled={rows.length === 0} onClick={() => setPreview(true)}>{t('Preview')}</Btn>
          <Btn className="flex-1" onClick={save}>{t('Save Routine')}</Btn>
        </div>
      </div>

      {picking && <Picker rows={rows} onAdd={add} onRemoveLast={id => setRows(rs => { const i = rs.map(r => r.ex).lastIndexOf(id); return i < 0 ? rs : rs.filter((_, j) => j !== i); })} onClose={() => setPicking(false)} />}

      {preview && (
        <Sheet title={name.trim() || t('My routine')} onClose={() => setPreview(false)} wide>
          <p className="mb-3 text-m-muted">{tot.estimated ? '≈ ' : ''}{fmtDuration(tot.total)} · {t(DIFFICULTY_LABEL[routineDifficulty(items)])}{tot.estimated ? ` · ${t('estimate: includes repetitions')}` : ''}</p>
          <ol className="grid gap-1.5 mb-4">
            {rows.map((r, i) => (
              <li key={r.key} className="flex items-center gap-3">
                <span className="w-5 text-right text-sm text-m-muted tabular-nums">{i + 1}</span><Art id={r.ex} size={40} />
                <span className="flex-1 min-w-0"><span className="block font-medium truncate">{EX[r.ex].name}</span><span className="block text-sm text-m-muted">{t(doseLabel(r, EX[r.ex]))}</span></span>
                <span className="text-sm text-m-muted tabular-nums">{i === 0 ? t('{n} sec prep', { n: timing.prepSec }) : t('+{n} sec', { n: r.before ?? timing.transitionSec })}</span>
              </li>
            ))}
          </ol>
          <Btn className="w-full" onClick={() => { setPreview(false); nav.start({ ...draft(), id: existing ? initial!.id : `single-preview-${uid()}` }); }}>{t('Start without saving')}</Btn>
        </Sheet>
      )}
    </div>
  );
}

function Picker({ rows, onAdd, onRemoveLast, onClose }: { rows: Row[]; onAdd: (id: string) => void; onRemoveLast: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<CatalogGroup | ''>('');
  const [grid, setGrid] = useState(true);
  const qs = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = useMemo(() => EXERCISES.filter(e => (!group || e.group === group) && qs.every(w => exerciseHaystack(e).includes(w))), [q, group]);
  const count = (id: string) => rows.filter(r => r.ex === id).length;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-m-canvas text-m-text" role="dialog" aria-modal="true" aria-label={t('Add movements')}>
      <div className="px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="flex-1 text-lg font-bold">{t('Add movements')}</h2>
          <Btn kind="ghost" onClick={() => setGrid(!grid)}>{grid ? t('Show as list') : t('Show as grid')}</Btn>
        </div>
        <input type="search" className={inputCls + ' mb-2'} placeholder={t('Search name, area, equipment')} aria-label={t('Search exercises')} value={q} onChange={e => setQ(e.target.value)} />
        <div className="m-scroll-x flex gap-1.5 pb-2 -mx-4 px-4">
          <Chip on={group === ''} onClick={() => setGroup('')}>{t('All')}</Chip>
          {(Object.keys(GROUP_LABELS) as CatalogGroup[]).map(g => <Chip key={g} on={group === g} onClick={() => setGroup(group === g ? '' : g)}>{t(GROUP_LABELS[g])}</Chip>)}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <ul className={grid ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2' : 'grid gap-1 md:grid-cols-2'}>
          {list.map(e => {
            const n = count(e.id);
            return (
              <li key={e.id} className="relative">
                <button type="button" onClick={() => onAdd(e.id)} aria-label={t('Add {name}', { name: e.name }) + (n ? `, ${t('added {n} times', { n })}` : '')}
                  className={grid ? 'w-full rounded-2xl p-1.5 text-center hover:bg-m-soft' : 'flex w-full items-center gap-3 rounded-2xl p-1.5 text-left min-h-[52px] hover:bg-m-soft'}>
                  <Art id={e.id} size={grid ? '100%' : 44} className={grid ? 'h-auto w-full' : ''} />
                  <span className={grid ? 'block mt-1 text-sm leading-tight' : 'font-medium'}>{e.name}</span>
                </button>
                {n > 0 && (
                  <button type="button" onClick={() => onRemoveLast(e.id)} aria-label={t('Remove one {name}', { name: e.name })}
                    className="absolute right-0.5 top-0.5 grid h-8 min-w-8 place-items-center rounded-full bg-m-accent px-1.5 text-sm font-bold text-m-ink">{n} ×</button>
                )}
              </li>
            );
          })}
        </ul>
        {list.length === 0 && <Empty>{t('No exercises match.')}</Empty>}
      </div>
      <div className="border-t border-m-line bg-m-surface px-4 py-2 pb-[max(10px,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <ol className="m-scroll-x flex flex-1 gap-1.5 min-h-[52px] items-center" aria-label={t('Selected movements, in order')}>
            {rows.length === 0 && <li className="text-sm text-m-muted">{t('Tap a movement to add it.')}</li>}
            {rows.map((r, i) => (
              <li key={r.key} className="relative shrink-0" title={EX[r.ex].name}>
                <Art id={r.ex} size={44} /><span className="absolute -left-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-m-text text-m-canvas text-[11px] font-bold">{i + 1}</span>
              </li>
            ))}
          </ol>
          <Btn onClick={onClose}>{t('Done ({n})', { n: rows.length })}</Btn>
        </div>
      </div>
    </div>
  );
}
