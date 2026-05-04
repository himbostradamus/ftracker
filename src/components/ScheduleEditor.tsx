import React from 'react';
import { DAYS } from '../constants';
import { fmtDate } from '../lib/helpers';
import { DaySchedule } from '../types';

interface ScheduleEditorProps {
  sched: DaySchedule[];
  mon: Date;
  customLifts: Record<number, string> | undefined;
  onChange: (day: number, value: string) => void;
}

// Pure presentational editor. Parents pass in the current schedule, the Monday
// of the week being edited, and the current per-day override map (or undefined
// if no overrides exist yet); the parent owns persistence via `onChange`.
export function ScheduleEditor({ sched, mon, customLifts, onChange }: ScheduleEditorProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <h3 className="text-[10px] font-bold tracking-widest text-[#888] uppercase mb-3">Weekly Lift Schedule</h3>
      <div className="flex flex-col gap-2">
        {sched.map(dayObj => {
          const liftItem = dayObj.items.find(i => i.type === 'lift');
          const dayDate = new Date(mon);
          dayDate.setDate(dayDate.getDate() + dayObj.day);
          const currentVal =
            customLifts?.[dayObj.day] ?? (liftItem?.liftType ?? 'None');

          return (
            <div key={dayObj.day} className="flex items-center justify-between p-2 bg-bg border border-border rounded">
              <div>
                <div className="text-xs font-bold text-[#ccc]">{DAYS[dayObj.day]}</div>
                <div className="text-[9px] text-[#555] tracking-widest">{fmtDate(dayDate)}</div>
              </div>
              <select
                value={currentVal}
                onChange={(e) => onChange(dayObj.day, e.target.value)}
                className="bg-[#1A1A1A] border border-[#2A2A2A] rounded p-1.5 text-xs text-[#ddd] outline-none"
              >
                <option value="None">None</option>
                <option value="Push">Push</option>
                <option value="Pull">Pull</option>
                <option value="Legs">Legs</option>
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
