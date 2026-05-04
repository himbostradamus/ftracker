import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Check } from 'lucide-react';
import { DAYS, DAILY_TASKS, TYPE_META } from '../constants';
import { getWeekId, getMon, fmtDate, getWeekTemplate, getRotationIndex } from '../lib/helpers';
import { loadData, saveData, updateWeekLifts } from '../lib/storage';
import { cn } from '../lib/utils';
import { CustomItem } from '../types';
import { ScheduleEditor } from './ScheduleEditor';

interface ChecklistTabProps {
  viewOffset: number;
  setViewOffset: (v: number) => void;
  onOpenWorkout: (dayIdx: number, typeIdx: number) => void;
}

// 'auto' = pick today's index when looking at the current week, nothing otherwise.
// Re-evaluated on every render so the highlight follows midnight crossings.
type ExpandedDay = number | null | 'auto';

export function ChecklistTab({ viewOffset, setViewOffset, onOpenWorkout }: ChecklistTabProps) {
  const [data, setData] = useState(loadData());
  const [expandedDay, setExpandedDay] = useState<ExpandedDay>('auto');
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [newItemText, setNewItemText] = useState('');
  const [editingSchedule, setEditingSchedule] = useState(false);

  const today = new Date();
  const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const isCurWk = viewOffset === 0;
  const refDate = new Date(today);
  refDate.setDate(refDate.getDate() + viewOffset * 7);
  const mon = getMon(refDate);
  const weekId = getWeekId(mon);

  // Reset expansion to 'auto' whenever the user navigates to a different week.
  useEffect(() => { setExpandedDay('auto'); }, [viewOffset]);

  const displayedExpandedDay: number | null =
    expandedDay === 'auto' ? (isCurWk ? todayIdx : null) : expandedDay;

  const sched = getWeekTemplate(weekId, data);
  const k = (dn: number, ti: number) => `${weekId}-${dn}-${ti}`;
  const kdl = (dn: number, id: string) => `${weekId}-${dn}-daily-${id}`;
  const kcu = (dn: number) => `${weekId}-${dn}-custom`;

  const toggle = (key: string) => { const newData = { ...data, [key]: !data[key] }; setData(newData); saveData(newData); };
  const getCust = (dn: number): CustomItem[] => data[kcu(dn)] || [];
  const toggleCust = (dn: number, id: number) => { const newData = { ...data, [kcu(dn)]: getCust(dn).map(i => i.id === id ? { ...i, done: !i.done } : i) }; setData(newData); saveData(newData); };
  const addCust = (dn: number) => { if (!newItemText.trim()) return; const newData = { ...data, [kcu(dn)]: [...getCust(dn), { id: Date.now(), label: newItemText.trim(), done: false }] }; setData(newData); saveData(newData); setNewItemText(''); setAddingTo(null); };
  const removeCust = (dn: number, id: number) => { const newData = { ...data, [kcu(dn)]: getCust(dn).filter(i => i.id !== id) }; setData(newData); saveData(newData); };

  const end = new Date(mon); end.setDate(end.getDate() + 6);
  const wkLabel = `${fmtDate(mon)} – ${fmtDate(end)}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-1">
        <span className="text-sm font-bold tracking-[4px] text-white">TRAINING</span>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setEditingSchedule(!editingSchedule)}
            className="text-[9px] font-bold tracking-widest text-primary uppercase"
          >
            {editingSchedule ? 'DONE' : 'EDIT'}
          </button>
          <span className="text-[9px] font-bold tracking-widest bg-card border border-[#252525] rounded px-2 py-1 text-[#777]">WK {getRotationIndex(parseInt(weekId.split("-W")[1], 10)) + 1}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => setViewOffset(viewOffset - 1)} className="w-8 h-7 flex items-center justify-center border border-[#222] rounded text-[#888]"><ChevronLeft size={16} /></button>
        <span className="text-[11px] text-[#555] tracking-widest">{wkLabel}</span>
        <button onClick={() => setViewOffset(viewOffset + 1)} className="w-8 h-7 flex items-center justify-center border border-[#222] rounded text-[#888]"><ChevronRight size={16} /></button>
      </div>

      {editingSchedule ? (
        <ScheduleEditor
          sched={sched}
          mon={mon}
          customLifts={data[`week-lifts-${weekId}`]}
          onChange={(day, val) => {
            const newData = updateWeekLifts(data, weekId, sched, day, val);
            setData(newData);
            saveData(newData);
          }}
        />
      ) : (
      <div className="flex flex-col gap-1.5">
        {sched.map((s, di) => {
          const isToday = isCurWk && s.day === todayIdx;
          const dObj = new Date(mon); dObj.setDate(mon.getDate() + s.day);
          const cust = getCust(s.day);
          const exp = displayedExpandedDay === s.day;
          
          return (
            <div key={s.day} className={cn("bg-card border border-border rounded-lg overflow-hidden", isToday && "border-[#2A2A2A] bg-[#131313]")}>
              <div className="flex items-center gap-2 p-2.5 cursor-pointer min-h-[40px]" onClick={() => setExpandedDay(exp ? null : s.day)}>
                <span className={cn("text-[11px] font-bold tracking-widest uppercase", isToday ? "text-white" : "text-[#888]")}>{DAYS[s.day]}</span>
                <span className="text-[10px] text-[#3A3A3A]">{dObj.getDate()}</span>
                <div className="flex-1" />
                {!exp && (
                  <div className="flex items-center gap-1">
                    {s.items.map((item, ti) => {
                      const chk = data[k(s.day, ti)];
                      const meta = TYPE_META[item.type];
                      return <span key={ti} className="text-[10px]" style={{ color: chk ? meta.color + "44" : meta.color }}>{meta.icon}</span>;
                    })}
                  </div>
                )}
                <ChevronRight size={14} className={cn("text-[#333] transition-transform", exp && "rotate-90")} />
              </div>

              {exp && (
                <div className="p-2.5 pt-0 flex flex-col gap-0.5">
                  {s.items.map((item, ti) => {
                    const chk = data[k(s.day, ti)];
                    const meta = TYPE_META[item.type];
                    const label = item.type === 'lift' ? item.liftType : meta.label;
                    return (
                      <div key={ti} className={cn("flex items-center gap-2 p-1.5 rounded-md", chk && "opacity-40")}>
                        <button
                          type="button"
                          aria-label={chk ? "Mark incomplete" : "Mark complete"}
                          aria-pressed={!!chk}
                          className={cn("w-[18px] h-[18px] rounded border-2 flex items-center justify-center shrink-0", chk ? "bg-[var(--c)] border-[var(--c)]" : "border-[var(--c-dim)]")}
                          style={{ '--c': meta.color, '--c-dim': meta.color + "55" } as any}
                          onClick={() => toggle(k(s.day, ti))}
                        >
                          {chk && <Check size={12} className="text-bg font-bold" />}
                        </button>
                        <button
                          type="button"
                          className="flex items-center gap-2 flex-1 text-left"
                          onClick={() => onOpenWorkout(di, ti)}
                        >
                          <span className="text-xs w-3.5 text-center" style={{ color: chk ? meta.color + "44" : meta.color }}>{meta.icon}</span>
                          <span className={cn("text-xs font-medium text-[#ccc] flex-1", chk && "line-through text-[#555]")}>{label}</span>
                          <ChevronRight size={14} className="text-[#2A2A2A]" />
                        </button>
                      </div>
                    );
                  })}
                  <div className="h-[1px] bg-border my-1" />
                  {DAILY_TASKS.map(dt => {
                    const chk = data[kdl(s.day, dt.id)];
                    return (
                      <button key={dt.id} className={cn("flex items-center gap-2 p-1.5 rounded-md text-left", chk && "opacity-40")} onClick={() => toggle(kdl(s.day, dt.id))}>
                        <div className={cn("w-[18px] h-[18px] rounded border-2 flex items-center justify-center shrink-0", chk ? "bg-[var(--c)] border-[var(--c)]" : "border-[var(--c-dim)]")} style={{ '--c': dt.color, '--c-dim': dt.color + "33" } as any}>
                          {chk && <Check size={12} className="text-bg font-bold" />}
                        </div>
                        <span className="text-xs w-3.5 text-center" style={{ color: chk ? dt.color + "33" : dt.color }}>{dt.icon}</span>
                        <span className={cn("text-xs font-medium text-[#ccc] flex-1", chk && "line-through text-[#555]")}>{dt.label}</span>
                      </button>
                    );
                  })}
                  {cust.length > 0 && <div className="h-[1px] bg-border my-1" />}
                  {cust.map(ci => (
                    <div key={ci.id} className={cn("flex items-center gap-2 p-1.5 rounded-md", ci.done && "opacity-40")}>
                      <button
                        type="button"
                        aria-label={ci.done ? "Mark incomplete" : "Mark complete"}
                        aria-pressed={ci.done}
                        className={cn("w-[18px] h-[18px] rounded border-2 flex items-center justify-center shrink-0", ci.done ? "bg-[#888] border-[#888]" : "border-[#44444466]")}
                        onClick={() => toggleCust(s.day, ci.id)}
                      >
                        {ci.done && <Check size={12} className="text-bg font-bold" />}
                      </button>
                      <span className="text-xs w-3.5 text-center text-[#555]">•</span>
                      <button
                        type="button"
                        className={cn("text-xs font-medium text-[#ccc] flex-1 text-left", ci.done && "line-through text-[#555]")}
                        onClick={() => toggleCust(s.day, ci.id)}
                      >{ci.label}</button>
                      <button onClick={() => removeCust(s.day, ci.id)} className="text-sm text-[#444] px-1">×</button>
                    </div>
                  ))}
                  {addingTo === s.day ? (
                    <div className="flex items-center gap-1 mt-1">
                      <input autoFocus className="flex-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded p-1.5 text-xs text-[#ddd] outline-none" placeholder="New item..." value={newItemText} onChange={(e) => setNewItemText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addCust(s.day); if (e.key === 'Escape') { setAddingTo(null); setNewItemText(''); } }} />
                      <button onClick={() => addCust(s.day)} className="w-8 h-8 flex items-center justify-center bg-[#1A1A1A] border border-[#2A2A2A] rounded text-success">+</button>
                      <button onClick={() => { setAddingTo(null); setNewItemText(''); }} className="w-8 h-8 flex items-center justify-center border border-border rounded text-[#555]">×</button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingTo(s.day)} className="flex items-center gap-2 p-1.5 border border-dashed border-border rounded-md mt-1 text-[#444]">
                      <Plus size={12} />
                      <span className="text-[10px] tracking-widest uppercase">Add item</span>
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
