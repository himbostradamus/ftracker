import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Check, Activity, SlidersHorizontal } from 'lucide-react';
import { ACTIVITY_REGISTRY, TYPE_META } from '../constants';
import { getWeekKey, toDateKey, getMon, fmtDate, getWeekTemplate, getWorkoutItemKey } from '../lib/helpers';
import { loadData, saveData, updateWeekLifts, updateWeekActivities } from '../lib/storage';
import { cn } from '../lib/utils';
import { CustomItem, WorkoutItem } from '../types';
import { ScheduleEditor } from './ScheduleEditor';

import { useMobility } from '../mobility/lib/store';
import { fmtActive } from '../mobility/lib/dates';

interface ChecklistTabProps {
  onStretch: (routineId?: string) => void;
  viewOffset: number;
  setViewOffset: (v: number) => void;
  onOpenWorkout: (dayIdx: number, typeIdx: number) => void;
}

// 'auto' = pick today's index when looking at the current week, nothing otherwise.
// Re-evaluated on every render so the highlight follows midnight crossings.
type ExpandedDay = number | null | 'auto';

export function ChecklistTab({ viewOffset, setViewOffset, onOpenWorkout, onStretch }: ChecklistTabProps) {
  const [data, setData] = useState(loadData());
  const [expandedDay, setExpandedDay] = useState<ExpandedDay>('auto');
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [newItemText, setNewItemText] = useState('');
  const [editingSchedule, setEditingSchedule] = useState(false);

  const { history } = useMobility();
  const today = new Date();
  const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const isCurWk = viewOffset === 0;
  const refDate = new Date(today);
  refDate.setDate(refDate.getDate() + viewOffset * 7);
  const mon = getMon(refDate);
  const weekKey = getWeekKey(mon);

  // Reset expansion to 'auto' whenever the user navigates to a different week.
  useEffect(() => { setExpandedDay('auto'); }, [viewOffset]);

  const displayedExpandedDay: number | null =
    expandedDay === 'auto' ? (isCurWk ? todayIdx : null) : expandedDay;

  const sched = getWeekTemplate(weekKey, data);
  const k = (dn: number, item: WorkoutItem) => getWorkoutItemKey(weekKey, dn, item);
  const kcu = (dn: number) => `${weekKey}-${dn}-custom`;

  const toggle = (key: string) => { const newData = { ...data, [key]: !data[key] }; setData(newData); saveData(newData); };
  const getCust = (dn: number): CustomItem[] => data[kcu(dn)] || [];
  const toggleCust = (dn: number, id: number) => { const newData = { ...data, [kcu(dn)]: getCust(dn).map(i => i.id === id ? { ...i, done: !i.done } : i) }; setData(newData); saveData(newData); };
  const addCust = (dn: number) => { if (!newItemText.trim()) return; const newData = { ...data, [kcu(dn)]: [...getCust(dn), { id: Date.now(), label: newItemText.trim(), done: false }] }; setData(newData); saveData(newData); setNewItemText(''); setAddingTo(null); };
  const removeCust = (dn: number, id: number) => { const newData = { ...data, [kcu(dn)]: getCust(dn).filter(i => i.id !== id) }; setData(newData); saveData(newData); };

  const end = new Date(mon); end.setDate(end.getDate() + 6);
  const wkLabel = `${fmtDate(mon)} – ${fmtDate(end)}`;

  return (
    <div className="flex flex-col gap-4">
      <header className="week-heading">
        <div>
          <p className="journal-date">{refDate.getFullYear()} · Weekly plan</p>
          <h1>{wkLabel}</h1>
        </div>
        <div className="week-controls">
          <button aria-label="Previous week" onClick={() => setViewOffset(viewOffset - 1)}><ChevronLeft size={18} /></button>
          <button aria-label="Next week" onClick={() => setViewOffset(viewOffset + 1)}><ChevronRight size={18} /></button>
        </div>
      </header>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{editingSchedule ? 'Edit schedule' : 'Weekly schedule'}</h2>
        <button className="flex items-center gap-2 text-sm text-primary min-h-11" onClick={() => setEditingSchedule(!editingSchedule)}>
          <SlidersHorizontal size={15} />{editingSchedule ? 'Done' : 'Edit schedule'}
        </button>
      </div>

      {editingSchedule ? (
        <ScheduleEditor
          sched={sched}
          mon={mon}
          customLifts={data[`week-lifts-${weekKey}`]}
          customActivities={data[`week-activities-${weekKey}`]}
          onLiftChange={(day, val) => {
            const newData = updateWeekLifts(data, weekKey, sched, day, val);
            setData(newData);
            saveData(newData);
          }}
          onActivitiesChange={(day, activities) => {
            const newData = updateWeekActivities(data, weekKey, sched, day, activities);
            setData(newData);
            saveData(newData);
          }}
        />
      ) : (
      <div className="flex flex-col gap-1.5">
        {sched.map((s, di) => {
          const isToday = isCurWk && s.day === todayIdx;
          const dObj = new Date(mon); dObj.setDate(mon.getDate() + s.day);
          const sessions = history.filter(entry => entry.dateKey === toDateKey(dObj));
          const cust = getCust(s.day);
          const exp = displayedExpandedDay === s.day;
          
          return (
            <div key={s.day} className={cn("day-card", isToday && "current-day")}>
              <button type="button" className="day-toggle" aria-expanded={exp} onClick={() => setExpandedDay(exp ? null : s.day)}>
                <span className="day-number">{dObj.getDate()}</span>
                <span className="font-semibold">{dObj.toLocaleDateString('en-US', { weekday: 'long' })}</span>
                {isToday && <span className="today-label">Today</span>}
                <div className="flex-1" />
                {!exp && (
                  <div className="flex items-center gap-1">
                    {sessions.length > 0 && <Activity aria-label="Stretch logged" size={15} className="text-primary" />}
                    {s.items.map((item, ti) => {
                      const chk = data[k(s.day, item)];
                      const meta = TYPE_META[item.type];
                      return <span key={ti} className="text-xs" style={{ color: chk ? `color-mix(in srgb, ${meta.color} 40%, transparent)` : meta.color }}>{meta.icon}</span>;
                    })}
                  </div>
                )}
                <ChevronRight size={14} className={cn("text-muted transition-transform", exp && "rotate-90")} />
              </button>

              {exp && (
                <div className="px-4 pb-4 pt-0 flex flex-col gap-0.5">
                  {s.items.length === 0 && cust.length === 0 && sessions.length === 0 && addingTo !== s.day && (
                    <div className="text-sm text-muted py-2">
                      No workouts scheduled for this day.
                    </div>
                  )}
                  {s.items.map((item, ti) => {
                    const chk = data[k(s.day, item)];
                    const meta = TYPE_META[item.type];
                    const label = item.type === 'lift' ? item.liftType : meta.label;
                    const stretchId = item.type === 'bend-full' ? 'full-body-stretch' : item.type === 'bend-expert' ? 'full-body-deep' : undefined;
                    const hasDetail = stretchId ||
                      item.type === 'lift' ||
                      ACTIVITY_REGISTRY[item.type]?.kind === 'session';

                    return (
                      <div key={ti} className={cn("flex items-center gap-2 p-1.5 rounded-md", chk && "opacity-40")}>
                        <button
                          type="button"
                          aria-label={chk ? "Mark incomplete" : "Mark complete"}
                          aria-pressed={!!chk}
                          className={cn("w-[18px] h-[18px] rounded border-2 flex items-center justify-center shrink-0", chk ? "bg-[var(--c)] border-[var(--c)]" : "border-[var(--c-dim)]")}
                          style={{ '--c': meta.color, '--c-dim': `color-mix(in srgb, ${meta.color} 50%, transparent)` } as any}
                          onClick={() => toggle(k(s.day, item))}
                        >
                          {chk && <Check size={12} className="text-bg font-bold" />}
                        </button>
                        {hasDetail ? (
                          <button
                            type="button"
                            className="flex items-center gap-2 flex-1 text-left"
                            onClick={() => stretchId ? onStretch(stretchId) : onOpenWorkout(di, ti)}
                          >
                            <span className="text-xs w-3.5 text-center" style={{ color: chk ? `color-mix(in srgb, ${meta.color} 40%, transparent)` : meta.color }}>{meta.icon}</span>
                            <span className={cn("text-xs font-medium text-ink flex-1", chk && "line-through text-muted")}>{label}</span>
                            <ChevronRight size={14} className="text-muted" />
                          </button>
                        ) : (
                          // Checkbox-only activity: tapping the row anywhere just toggles.
                          <button
                            type="button"
                            className="flex items-center gap-2 flex-1 text-left"
                            onClick={() => toggle(k(s.day, item))}
                          >
                            <span className="text-xs w-3.5 text-center" style={{ color: chk ? `color-mix(in srgb, ${meta.color} 40%, transparent)` : meta.color }}>{meta.icon}</span>
                            <span className={cn("text-xs font-medium text-ink flex-1", chk && "line-through text-muted")}>{label}</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {sessions.map(entry => (
                    <div key={entry.id} className="logged-stretch">
                      <Check size={15} /><span>{entry.routineName || 'Stretch session'}</span>
                      <span className="ml-auto text-muted">{fmtActive(entry.activeSec)}</span>
                    </div>
                  ))}
                  {isToday && <button type="button" onClick={() => onStretch()} className="practice-link">
                    <Activity size={17} /> Open stretch practice <ChevronRight size={15} className="ml-auto" />
                  </button>}
                  {cust.length > 0 && <div className="h-[1px] bg-border my-1" />}
                  {cust.map(ci => (
                    <div key={ci.id} className={cn("flex items-center gap-2 p-1.5 rounded-md", ci.done && "opacity-40")}>
                      <button
                        type="button"
                        aria-label={ci.done ? "Mark incomplete" : "Mark complete"}
                        aria-pressed={ci.done}
                        className={cn("w-[18px] h-[18px] rounded border-2 flex items-center justify-center shrink-0", ci.done ? "bg-muted border-border" : "border-border")}
                        onClick={() => toggleCust(s.day, ci.id)}
                      >
                        {ci.done && <Check size={12} className="text-bg font-bold" />}
                      </button>
                      <span className="text-xs w-3.5 text-center text-muted">•</span>
                      <button
                        type="button"
                        className={cn("text-xs font-medium text-ink flex-1 text-left", ci.done && "line-through text-muted")}
                        onClick={() => toggleCust(s.day, ci.id)}
                      >{ci.label}</button>
                      <button onClick={() => removeCust(s.day, ci.id)} className="text-sm text-muted px-1">×</button>
                    </div>
                  ))}
                  {addingTo === s.day ? (
                    <div className="flex items-center gap-1 mt-1">
                      <input autoFocus className="flex-1 bg-soft border border-border rounded p-1.5 text-xs text-ink outline-none" placeholder="New item..." value={newItemText} onChange={(e) => setNewItemText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addCust(s.day); if (e.key === 'Escape') { setAddingTo(null); setNewItemText(''); } }} />
                      <button onClick={() => addCust(s.day)} className="w-8 h-8 flex items-center justify-center bg-soft border border-border rounded text-success">+</button>
                      <button onClick={() => { setAddingTo(null); setNewItemText(''); }} className="w-8 h-8 flex items-center justify-center border border-border rounded text-muted">×</button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingTo(s.day)} className="flex items-center gap-2 p-1.5 border border-dashed border-border rounded-md mt-1 text-muted">
                      <Plus size={12} />
                      <span className="text-xs tracking-widest uppercase">Add item</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
