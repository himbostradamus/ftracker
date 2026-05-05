import React from 'react';
import { ACTIVITY_IDS, ACTIVITY_REGISTRY, DAYS } from '../constants';
import { fmtDate } from '../lib/helpers';
import { cn } from '../lib/utils';
import { ActivityId, DaySchedule } from '../types';

interface ScheduleEditorProps {
  sched: DaySchedule[];
  mon: Date;
  customLifts: Record<number, string> | undefined;
  customActivities: Record<number, ActivityId[]> | undefined;
  onLiftChange: (day: number, value: string) => void;
  onActivitiesChange: (day: number, activities: ActivityId[]) => void;
}

// Pure presentational editor. Parents pass in the current schedule and any
// existing per-week overrides; this component just renders controls and
// delegates persistence via the two onChange callbacks.
export function ScheduleEditor({
  sched,
  mon,
  customLifts,
  customActivities,
  onLiftChange,
  onActivitiesChange
}: ScheduleEditorProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <h3 className="text-[10px] font-bold tracking-widest text-[#888] uppercase mb-3">Weekly Schedule</h3>
      <div className="flex flex-col gap-2">
        {sched.map(dayObj => {
          const liftItem = dayObj.items.find(i => i.type === 'lift');
          const dayDate = new Date(mon);
          dayDate.setDate(dayDate.getDate() + dayObj.day);

          const currentLift =
            customLifts?.[dayObj.day] ?? (liftItem?.liftType ?? 'None');

          // Activities currently selected for this day. Pull from the override
          // if there is one, else derive from the rendered schedule.
          const currentActivities: ActivityId[] =
            customActivities?.[dayObj.day] ??
            (dayObj.items
              .filter(i => i.type !== 'lift' && (i.type as ActivityId) in ACTIVITY_REGISTRY)
              .map(i => i.type as ActivityId));

          const toggleActivity = (id: ActivityId) => {
            const next = currentActivities.includes(id)
              ? currentActivities.filter(a => a !== id)
              : [...currentActivities, id];
            // Preserve the canonical ACTIVITY_IDS order so the rendered chip
            // strip and the resulting day items don't reorder on each click.
            const sorted = ACTIVITY_IDS.filter(a => next.includes(a));
            onActivitiesChange(dayObj.day, sorted);
          };

          return (
            <div key={dayObj.day} className="p-2 bg-bg border border-border rounded">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-xs font-bold text-[#ccc]">{DAYS[dayObj.day]}</div>
                  <div className="text-[9px] text-[#555] tracking-widest">{fmtDate(dayDate)}</div>
                </div>
                <select
                  value={currentLift}
                  onChange={(e) => onLiftChange(dayObj.day, e.target.value)}
                  className="bg-[#1A1A1A] border border-[#2A2A2A] rounded p-1.5 text-xs text-[#ddd] outline-none"
                  aria-label={`Lift for ${DAYS[dayObj.day]}`}
                >
                  <option value="None">No lift</option>
                  <option value="Push">Push</option>
                  <option value="Pull">Pull</option>
                  <option value="Legs">Legs</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-1">
                {ACTIVITY_IDS.map(id => {
                  const meta = ACTIVITY_REGISTRY[id];
                  const active = currentActivities.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      role="switch"
                      aria-checked={active}
                      aria-label={meta.label}
                      onClick={() => toggleActivity(id)}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-medium transition-colors",
                        active
                          ? "border-[var(--c)] bg-[var(--c-dim)] text-[var(--c)]"
                          : "border-[#2A2A2A] bg-transparent text-[#666] hover:border-[#3A3A3A]"
                      )}
                      style={{ '--c': meta.color, '--c-dim': meta.color + '22' } as any}
                    >
                      <span aria-hidden="true">{meta.icon}</span>
                      <span>{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-[#444] mt-3 leading-relaxed">
        Tap activities to toggle them on/off for the day. Changes apply to this week only.
      </p>
    </div>
  );
}
