import React, { useEffect, useRef } from 'react';
import { ChevronLeft, Heart, X } from 'lucide-react';
import { Figure } from '../art/Figure';
import { POSES } from '../data/poses';
import { EX } from '../data/catalog';
import { Routine, Settings } from '../types';
import { coverOf, timingOf } from '../lib/routines';
import { routineTotals } from '../lib/timeline';
import { fmtMinutes } from '../lib/dates';
import { DIFFICULTY_LABEL, t } from '../i18n';
import { cn } from '../../lib/utils';

// Navigation targets pushed on top of the five primary destinations.
export type Screen =
  | { type: 'routine'; id: string; routine?: Routine }
  | { type: 'exercise'; id: string }
  | { type: 'builder'; routine?: Routine }
  | { type: 'series'; id: string }
  | { type: 'player' };

export interface Nav {
  push: (s: Screen) => void;
  pop: () => void;
  start: (r: Routine) => void;
  toast: (text: string, undo?: () => void) => void;
  goTab: (tab: string) => void;
  exitToTracker: () => void;
}

export function Art({ id, size = 64, badge = true, className }: { id: string; size?: number | string; badge?: boolean; className?: string }) {
  const pose = POSES[id];
  const ex = EX[id];
  if (!pose || !ex) {
    return <div style={{ width: size, height: size }} className={cn('rounded-full bg-m-soft grid place-items-center text-xs text-m-muted', className)} role="img" aria-label={t('Illustration missing')}>?</div>;
  }
  return <Figure pose={pose} seed={id} size={size} badge={badge} title={ex.alt} className={className} />;
}

export function Btn({ kind = 'primary', className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return (
    <button
      type="button" {...p}
      className={cn(
        'm-tap inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[0.95rem] font-semibold transition-colors disabled:opacity-45',
        kind === 'primary' && 'bg-m-accent text-m-ink',
        kind === 'secondary' && 'bg-m-surface text-m-text border border-m-line',
        kind === 'ghost' && 'text-m-accent',
        kind === 'danger' && 'border border-m-danger text-m-danger',
        className,
      )}
    />
  );
}

export function IconBtn({ label, className, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} {...p} className={cn('m-tap grid place-items-center rounded-full text-m-text disabled:opacity-35', className)}>
      {children}
    </button>
  );
}

export function Chip({ on, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean }) {
  return (
    <button
      type="button" aria-pressed={!!on} {...p}
      className={cn(
        'shrink-0 rounded-lg border px-3 py-2 text-sm font-medium min-h-[40px] transition-colors',
        on ? 'border-m-accent bg-m-accent text-m-ink' : 'border-m-line bg-m-surface text-m-text',
      )}
    >
      {on && <span aria-hidden="true">✓ </span>}{children}
    </button>
  );
}

export function Header({ title, onBack, right, sub }: { title: string; onBack?: () => void; right?: React.ReactNode; sub?: string }) {
  return (
    <header className="flex items-center gap-1 mb-4 min-h-[44px]">
      {onBack && (
        <IconBtn label={t('Back')} onClick={onBack} className="-ml-2"><ChevronLeft size={24} /></IconBtn>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-[1.4rem] font-bold leading-tight truncate">{title}</h1>
        {sub && <p className="text-sm text-m-muted">{sub}</p>}
      </div>
      {right}
    </header>
  );
}

export function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="flex items-end justify-between mb-2.5">
        <h2 className="text-[1.05rem] font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 py-3 cursor-pointer">
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-sm text-m-muted">{hint}</span>}
      </span>
      <span className="relative shrink-0">
        <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className="block h-7 w-12 rounded-full bg-m-line peer-checked:bg-m-accent transition-colors peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-m-accent peer-focus-visible:outline-offset-2" />
        <span className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
        <span className="sr-only">{checked ? t('On') : t('Off')}</span>
      </span>
    </label>
  );
}

export function Stepper({ label, value, onChange, min, max, step = 1, suffix }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: string }) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-1" role="group" aria-label={label}>
        <IconBtn label={t('Decrease {label}', { label })} onClick={() => set(value - step)} disabled={value <= min} className="border border-m-line bg-m-surface text-lg">−</IconBtn>
        <span className="w-16 text-center tabular-nums font-semibold" aria-live="polite">{value}{suffix ? ` ${suffix}` : ''}</span>
        <IconBtn label={t('Increase {label}', { label })} onClick={() => set(value + step)} disabled={value >= max} className="border border-m-line bg-m-surface text-lg">+</IconBtn>
      </div>
    </div>
  );
}

export function Select<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <label className="flex items-center justify-between gap-3 py-2">
      <span className="font-medium">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value as T)} className="m-tap max-w-[60%] rounded-lg border border-m-line bg-m-surface px-3 py-2 text-m-text">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

// Bottom sheet on phones, centred dialog on larger screens.
export function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className={cn('m-fade w-full max-h-[88vh] overflow-y-auto rounded-t-3xl md:rounded-3xl bg-m-surface text-m-text p-5 pb-[max(20px,env(safe-area-inset-bottom))] outline-none', wide ? 'md:max-w-2xl' : 'md:max-w-lg')}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <IconBtn label={t('Close')} onClick={onClose} className="-mr-2"><X size={22} /></IconBtn>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Cover({ routine, size = 64 }: { routine: Routine; size?: number }) {
  const c = coverOf(routine);
  if (c.image) return <img src={c.image} alt="" width={size} height={size} className="rounded-2xl object-cover shrink-0" style={{ width: size, height: size }} />;
  return (
    <div className="rounded-2xl shrink-0 grid place-items-center overflow-hidden" style={{ width: size, height: size, background: c.color }}>
      {c.ex && <Art id={c.ex} size={size} badge={false} />}
    </div>
  );
}

export function durationText(r: Routine, s: Settings): string {
  const tot = routineTotals(r, timingOf(s));
  return `${tot.estimated ? '≈ ' : ''}${fmtMinutes(tot.total)}`;
}

export function RoutineRow({ routine, settings, onOpen, fav, onFav, meta }: { routine: Routine; settings: Settings; onOpen: () => void; fav?: boolean; onFav?: () => void; meta?: string }) {
  return (
    <div className="m-card flex items-center gap-3 p-2.5">
      <button type="button" onClick={onOpen} className="flex flex-1 items-center gap-3 text-left min-w-0 min-h-[56px]">
        <Cover routine={routine} size={56} />
        <span className="min-w-0">
          <span className="block font-semibold leading-snug">{routine.name}</span>
          <span className="block text-sm text-m-muted">
            {durationText(routine, settings)} · {t('{n} movements', { n: routine.items.length })} · {meta ?? t(DIFFICULTY_LABEL[routine.difficulty])}
          </span>
        </span>
      </button>
      {onFav && (
        <IconBtn label={fav ? t('Remove {name} from favorites', { name: routine.name }) : t('Add {name} to favorites', { name: routine.name })} aria-pressed={!!fav} onClick={onFav}>
          <Heart size={20} fill={fav ? 'currentColor' : 'none'} className={fav ? 'text-m-accent' : 'text-m-muted'} />
        </IconBtn>
      )}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-m-line p-5 text-center text-m-muted">{children}</p>;
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block mb-3">
      <span className="block text-sm font-medium mb-1">{label}</span>
      {children}
      {hint && <span className="block text-sm text-m-muted mt-1">{hint}</span>}
    </label>
  );
}
export const inputCls = 'w-full m-tap rounded-xl border border-m-line bg-m-surface px-3 py-2.5 text-m-text placeholder:text-m-muted';
