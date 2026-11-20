import React, { useState } from 'react';
import { ChevronLeft, Settings, Minus, Plus, Check } from 'lucide-react';
import { TYPE_META, EXERCISES, AVAILABLE_EXERCISES } from '../constants';
import { getWeekKey, getMon, fmtDate, formatLastPerformed, getWeekTemplate, getWorkoutItemKey } from '../lib/helpers';
import { 
  loadData, saveData, getDef, getLift, saveConfigs, loadConfigs, updateWeekLifts, updateWeekActivities, getLastPerformed
} from '../lib/storage';
import { cn } from '../lib/utils';
import { ScheduleEditor } from './ScheduleEditor';

interface WorkoutDetailProps {
  dayIdx: number;
  typeIdx: number;
  viewOffset: number;
  onBack: () => void;
  onStartTimer: (duration: number) => void;
}

export function WorkoutDetail({ dayIdx, typeIdx, viewOffset, onBack, onStartTimer }: WorkoutDetailProps) {
  const [data, setData] = useState(loadData());
  const [editingEx, setEditingEx] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [addingExercise, setAddingExercise] = useState(false);
  
  const today = new Date();
  const refDate = new Date(today);
  refDate.setDate(refDate.getDate() + viewOffset * 7);
  const mon = getMon(refDate);
  const weekKey = getWeekKey(mon);

  const sched = getWeekTemplate(weekKey, data);
  const di = sched[dayIdx];
  const item = di?.items[typeIdx];
  
  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-4 text-center">
        <p className="text-muted text-sm">Workout removed or not found.</p>
        <button onClick={onBack} className="flex items-center gap-1 text-ink uppercase text-xs tracking-widest py-2 px-4 border border-border rounded">
          <ChevronLeft size={18} /> BACK TO MENU
        </button>
      </div>
    );
  }

  const itemKey = getWorkoutItemKey(weekKey, dayIdx, item);
  const meta = TYPE_META[item.type];
  const label = item.type === 'lift' ? item.liftType : meta.label;
  const dd = new Date(mon); dd.setDate(mon.getDate() + dayIdx);
  const isLift = item.type === 'lift';

  const getExercises = (): string[] => {
    if (item.type === 'lift' && item.liftType) {
      if (item.liftType === 'None') return [];
      const customKey = `custom-routine-${item.liftType}`;
      return data[customKey] || [...(EXERCISES[item.liftType] || [])];
    }
    if (item.type === 'run') return ["Warm-up", "Main Run / Ride", "Cool-down"];
    if (item.type === 'hiit') return ["Warm-up Jog", "Sprint Intervals", "Active Recovery", "Cool-down"];
    if (item.type === 'walk') return ["75 Minute Walk"];
    if (item.type === 'core') return ["Plank", "Hanging Leg Raise", "Ab Wheel", "Russian Twist", "Dead Bug", "Cable Crunch"];
    return [];
  };

  const exercises = getExercises();

  const handleAddExercise = (name: string) => {
    if (item.type !== 'lift' || !item.liftType) return;
    const customKey = `custom-routine-${item.liftType}`;
    const current = getExercises();
    if (!current.includes(name)) {
      const newData = { ...data, [customKey]: [...current, name] };
      setData(newData);
      saveData(newData);
    }
    setAddingExercise(false);
  };

  const handleRemoveExercise = (name: string) => {
    if (item.type !== 'lift' || !item.liftType) return;
    const customKey = `custom-routine-${item.liftType}`;
    const current = getExercises();
    const newData = { ...data, [customKey]: current.filter((e: string) => e !== name) };
    setData(newData);
    saveData(newData);
  };


  const toggleRep = (exName: string, si: number, ri: number) => {
    const ld = getLift(dayIdx, exName, weekKey);
    const grid = ld.grid.map(r => [...r]);
    const row = grid[si];
    const wasDone = row.some(r => r);
    
    let lastFilled = -1;
    for (let i = row.length - 1; i >= 0; i--) { if (row[i]) { lastFilled = i; break; } }
    
    if (ri === lastFilled) row[ri] = false;
    else if (ri > lastFilled) for (let i = 0; i <= ri; i++) row[i] = true;
    else for (let i = 0; i < row.length; i++) row[i] = i <= ri;
    
    grid[si] = row;
    const newLd = { ...ld, grid };
    const key = `lift-${weekKey}-${dayIdx}-${exName}`;
    const newData = { ...data, [key]: newLd };
    setData(newData);
    saveData(newData);
    
    if (row.some(r => r) && !wasDone) onStartTimer(getDef(exName).rest);
  };

  const setWeight = (exName: string, w: number) => {
    const ld = getLift(dayIdx, exName, weekKey);
    const newLd = { ...ld, weight: Math.max(0, w) };
    const key = `lift-${weekKey}-${dayIdx}-${exName}`;
    const newData = { ...data, [key]: newLd };
    setData(newData);
    saveData(newData);
  };

  const toggleExChk = (ei: number) => {
    const key = `${itemKey}-ex${ei}`;
    const newData = { ...data, [key]: !data[key] };
    setData(newData);
    saveData(newData);
  };

  const toggleComplete = () => {
    const key = itemKey;
    const wasComplete = !!data[key];
    const newData = { ...data, [key]: !wasComplete };
    setData(newData);
    saveData(newData);
    // Marking a workout complete kicks back to the schedule — that's the
    // natural "done with this" gesture. Un-marking does NOT navigate; the
    // user is signaling they want to keep working on it.
    if (!wasComplete) onBack();
  };

  const toggleSkip = (exName: string) => {
    const ld = getLift(dayIdx, exName, weekKey);
    const newLd = { ...ld, skipped: !ld.skipped };
    const key = `lift-${weekKey}-${dayIdx}-${exName}`;
    const newData = { ...data, [key]: newLd };
    setData(newData);
    saveData(newData);
  };

  const isExDone = (name: string) => {
    const ld = getLift(dayIdx, name, weekKey);
    return ld.skipped || ld.grid.every(row => row.length > 0 && row.every(Boolean));
  };

  const completedExCount = isLift 
    ? exercises.filter(name => isExDone(name)).length
    : exercises.filter((_, ei) => data[`${itemKey}-ex${ei}`]).length;

  const isWorkoutDone = data[itemKey];

  return (
    <div className="flex flex-col gap-4 pb-20">
      <div className="flex justify-between items-center">
        <button onClick={onBack} className="flex items-center gap-1 text-muted uppercase text-xs tracking-widest py-1">
          <ChevronLeft size={18} /> Back
        </button>
        {isLift && (
          <button 
            onClick={() => setEditingSchedule(!editingSchedule)}
            className="flex items-center gap-1 text-primary uppercase text-xs tracking-widest py-1"
          >
            {editingSchedule ? 'Done' : 'Edit Schedule'}
          </button>
        )}
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
        <>
          <div className="flex items-center gap-3">
            <div className="text-2xl" style={{ color: meta.color }}>{meta.icon}</div>
            <div className="flex-1">
              <div className="text-lg font-bold tracking-widest text-ink uppercase">{label}</div>
              <div className="text-xs text-muted tracking-widest uppercase">{fmtDate(dd)}</div>
            </div>
            <div className="flex items-baseline">
              <span className="text-2xl font-bold" style={{ color: completedExCount === exercises.length ? 'var(--color-success)' : meta.color }}>{completedExCount}</span>
              <span className="text-xs text-muted">/{exercises.length}</span>
            </div>
          </div>

          <div className="h-[3px] bg-card rounded-full overflow-hidden">
            <div className="h-full transition-all duration-500" style={{ width: `${exercises.length > 0 ? (completedExCount / exercises.length) * 100 : 0}%`, backgroundColor: meta.color }} />
          </div>

          <div className="flex flex-col gap-2">
            {isLift ? (
              <>
                {exercises.map(name => {
                  const def = getDef(name);
                const ld = getLift(dayIdx, name, weekKey);
                const done = isExDone(name);
                const isEditing = editingEx === name;

            if (isEditing) {
              return (
                <ExerciseEditForm
                  key={name}
                  name={name}
                  currentSets={ld.prescribedSets ?? ld.grid.length ?? def.sets}
                  currentReps={ld.prescribedReps ?? ld.grid[0]?.length ?? def.reps}
                  currentWeight={ld.weight}
                  currentAutoBump={def.autoBump !== false}
                  skipped={!!ld.skipped}
                  onSave={(s, r, w, autoBump) => {
                    // Update the per-exercise default config (drives future sessions).
                    saveConfigs({ ...loadConfigs(), [name]: { ...def, sets: s, reps: r, w, autoBump } });
                    // Also write the new prescription onto the current session so
                    // the change takes effect immediately instead of next time.
                    const key = `lift-${weekKey}-${dayIdx}-${name}`;
                    const stored = (data[key] as any) ?? {};
                    const newData = {
                      ...data,
                      [key]: {
                        ...stored,
                        weight: w,
                        prescribedSets: s,
                        prescribedReps: r,
                        // Drop the existing grid; getLift will rebuild against the new prescription
                        // on the next read, copying any already-checked cells where they still fit.
                        grid: stored.grid ?? []
                      }
                    };
                    setData(newData);
                    saveData(newData);
                    setEditingEx(null);
                  }}
                  onCancel={() => setEditingEx(null)}
                  onSkipToggle={() => { toggleSkip(name); setEditingEx(null); }}
                  onRemove={() => { handleRemoveExercise(name); setEditingEx(null); }}
                />
              );
            }

            return (
              <div key={name} className={cn("bg-card border border-border rounded-lg p-3", done && "opacity-50")}>
                <div className="flex items-center justify-between mb-2">
                  <span className={cn("text-xs font-bold text-ink", ld.skipped && "line-through text-muted")}>{name}</span>
                  <div className="flex items-center gap-2">
                    {ld.skipped && <span className="text-xs text-muted tracking-widest uppercase">SKIPPED</span>}
                    {!ld.skipped && <span className="text-xs text-muted tracking-widest uppercase">{ld.grid.filter(r => r.some(x => x)).length}/{ld.prescribedSets ?? ld.grid.length} sets</span>}
                    <button onClick={() => setEditingEx(name)} className="text-muted hover:text-primary"><Settings size={12} /></button>
                  </div>
                </div>

                {!ld.skipped && (() => {
                  const last = getLastPerformed(name, `lift-${weekKey}-${dayIdx}-${name}`);
                  if (!last) {
                    return (
                      <div className="text-xs text-muted mb-2 tracking-wide">First time logging this lift</div>
                    );
                  }
                  // Average reps actually completed per attempted set. If you didn't
                  // start a set, it doesn't drag the average down — that would
                  // misrepresent how the work you did do actually went.
                  const avgReps = last.completedSets > 0 ? Math.round(last.reps / last.completedSets) : 0;
                  // Show prescription explicitly when it differed from performance,
                  // so a partial session is obvious at a glance.
                  const prescriptionMatched =
                    last.completedSets === last.prescribedSets &&
                    avgReps === last.prescribedReps;
                  // Auto-bump: weight is going up vs last because last was fully cleared.
                  const autoBumped =
                    last.fullyCleared &&
                    ld.weight > last.weight &&
                    // Only show the bump cue if this session hasn't been edited yet
                    // (i.e. is still on its suggested defaults).
                    !ld.grid.some(row => row.some(r => r));
                  return (
                    <div className="text-xs text-muted mb-2 tracking-wide flex items-center gap-1.5 flex-wrap">
                      <span className="text-muted">Last:</span>
                      <span className="text-muted font-medium">{def.bw ? (last.weight > 0 ? `+${last.weight}` : 'BW') : `${last.weight} lbs`}</span>
                      <span className="text-muted">·</span>
                      {prescriptionMatched ? (
                        <span>{last.prescribedSets}×{last.prescribedReps}</span>
                      ) : (
                        <span>
                          <span className="text-muted">{last.completedSets}×{avgReps}</span>
                          <span className="text-muted"> of </span>
                          {last.prescribedSets}×{last.prescribedReps}
                        </span>
                      )}
                      <span className="text-muted">·</span>
                      <span>{formatLastPerformed(last.daysAgo, last.date)}</span>
                      {autoBumped && (
                        <span className="text-success font-bold ml-auto" title="Cleared all reps last time — weight bumped">↑ +{ld.weight - last.weight}</span>
                      )}
                    </div>
                  );
                })()}

                {!ld.skipped && (
                  <>
                    <div className="flex items-center gap-0 mb-3">
                      <button onClick={() => setWeight(name, ld.weight - def.inc)} className="w-8 h-7 bg-soft border border-border rounded-l-md text-muted flex items-center justify-center active:bg-soft"><Minus size={14} /></button>
                      <div className="flex-1 h-7 bg-card border-y border-border flex items-center justify-center text-sm font-bold text-primary tracking-widest">
                        {def.bw && <span className="text-xs text-muted mr-1">BW</span>}
                        {def.bw ? (ld.weight > 0 ? `+${ld.weight}` : "") : ld.weight}
                        {!def.bw && <span className="text-xs text-muted ml-1">lbs</span>}
                      </div>
                      <button onClick={() => setWeight(name, ld.weight + def.inc)} className="w-8 h-7 bg-soft border border-border rounded-r-md text-muted flex items-center justify-center active:bg-soft"><Plus size={14} /></button>
                    </div>

                    <div className="flex flex-col gap-1">
                      {ld.grid.map((row, si) => (
                        <div key={si} className="flex items-center gap-1">
                          <span className={cn("text-xs w-5 text-center font-bold", row.some(r => r) ? "text-success/50" : "text-muted")}>S{si + 1}</span>
                          <div className="flex gap-0.5 flex-1">
                            {row.map((val, ri) => (
                              <button 
                                key={ri}
                                onClick={() => toggleRep(name, si, ri)}
                                className={cn("flex-1 h-6 rounded border-[1.5px] border-border transition-all active:scale-90", val && "bg-[var(--c)] border-[var(--c)]")}
                                style={{ '--c': meta.color } as any}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
          
          {!addingExercise ? (
            <button onClick={() => setAddingExercise(true)} className="w-full mt-2 py-3 border-2 border-dashed border-border text-muted font-bold text-xs tracking-widest uppercase rounded hover:bg-soft transition-colors">
              + Add Exercise
            </button>
          ) : (
            <div className="bg-card border border-border rounded-lg p-3 mt-2">
              <h3 className="text-xs font-bold tracking-widest text-muted uppercase mb-3">Add Exercise to {item.liftType}</h3>
              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                {(AVAILABLE_EXERCISES[item.liftType as keyof typeof AVAILABLE_EXERCISES] || []).filter(ex => !exercises.includes(ex)).map(ex => (
                  <button 
                    key={ex} 
                    onClick={() => handleAddExercise(ex)}
                    className="flex items-center justify-between p-2.5 bg-bg border border-border rounded text-left text-xs font-bold text-ink hover:bg-soft transition-colors"
                  >
                    {ex} <Plus size={14} className="text-muted" />
                  </button>
                ))}
              </div>
              <button onClick={() => setAddingExercise(false)} className="w-full mt-3 py-2 border border-border text-muted font-bold text-xs tracking-widest uppercase rounded hover:bg-soft transition-colors">
                Cancel
              </button>
            </div>
          )}
        </>
        ) : (
          exercises.map((name, ei) => {
            const chk = data[`${itemKey}-ex${ei}`];
            return (
              <div key={ei} className="flex items-center gap-2 p-2.5 bg-card border border-border rounded-lg">
                <span className="text-xs font-medium text-ink flex-1">{name}</span>
                <button 
                  onClick={() => toggleExChk(ei)}
                  className={cn("w-9 h-9 rounded-lg border-2 flex items-center justify-center text-xs", chk ? "bg-[var(--c)] border-[var(--c)] text-bg" : "border-border text-muted")}
                  style={{ '--c': meta.color } as any}
                >
                  {chk ? <Check size={16} /> : ""}
                </button>
              </div>
            );
          })
        )}
      </div>

      <button 
        onClick={toggleComplete}
        className={cn(
          "w-full py-3 rounded-lg font-bold text-xs tracking-[3px] border transition-all mt-4",
          isWorkoutDone 
            ? "bg-[var(--c-dim)] text-[var(--c)] border-[var(--c)]" 
            : "bg-[var(--c)] text-bg border-[var(--c)]"
        )}
        style={{ '--c': meta.color, '--c-dim': `color-mix(in srgb, ${meta.color} 14%, transparent)` } as any}
      >
        {isWorkoutDone ? "✓ COMPLETED" : "MARK COMPLETE"}
      </button>
      </>
      )}
    </div>
  );
}

interface ExerciseEditFormProps {
  name: string;
  // Pre-fill values from the current session's actual prescription / weight,
  // which may differ from the per-exercise default after carry-forward or
  // auto-bump. The parent's onSave handler is responsible for updating both
  // the per-exercise default (drives future sessions) and this session's
  // stored prescription.
  currentSets: number;
  currentReps: number;
  currentWeight: number;
  currentAutoBump: boolean;
  skipped: boolean;
  onSave: (sets: number, reps: number, weight: number, autoBump: boolean) => void;
  onCancel: () => void;
  onSkipToggle: () => void;
  onRemove: () => void;
}

function ExerciseEditForm({ name, currentSets, currentReps, currentWeight, currentAutoBump, skipped, onSave, onCancel, onSkipToggle, onRemove }: ExerciseEditFormProps) {
  const [sets, setSets] = useState(String(currentSets));
  const [reps, setReps] = useState(String(currentReps));
  const [weight, setWeight] = useState(String(currentWeight));
  const [autoBump, setAutoBump] = useState(currentAutoBump);

  const handleSave = () => {
    const s = parseInt(sets, 10);
    const r = parseInt(reps, 10);
    const w = parseFloat(weight);
    if (!Number.isFinite(s) || !Number.isFinite(r) || !Number.isFinite(w) || s <= 0 || r <= 0 || w < 0) {
      return;
    }
    onSave(s, r, w, autoBump);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <h3 className="text-xs font-bold tracking-widest text-muted uppercase mb-3">Edit {name}</h3>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Sets</span>
          <input type="number" min={1} value={sets} onChange={(e) => setSets(e.target.value)} className="bg-bg border border-border rounded p-1 text-xs text-center w-12" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Reps</span>
          <input type="number" min={1} value={reps} onChange={(e) => setReps(e.target.value)} className="bg-bg border border-border rounded p-1 text-xs text-center w-12" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Weight</span>
          <input type="number" min={0} step="0.5" value={weight} onChange={(e) => setWeight(e.target.value)} className="bg-bg border border-border rounded p-1 text-xs text-center w-12" />
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <div className="flex flex-col">
            <span className="text-xs text-muted">Auto-progress weight</span>
            <span className="text-xs text-muted">Bump up after fully clearing</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoBump}
            aria-label="Auto-progress weight"
            onClick={() => setAutoBump(v => !v)}
            className={cn(
              "px-2.5 py-1 rounded text-xs font-bold tracking-widest border transition-colors",
              autoBump
                ? "bg-success/15 text-success border-success/40"
                : "bg-bg text-muted border-border"
            )}
          >
            {autoBump ? "ON" : "OFF"}
          </button>
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={handleSave} className="flex-1 py-2 bg-primary text-bg font-bold text-xs rounded">SAVE</button>
          <button onClick={onCancel} className="flex-1 py-2 border border-border text-muted font-bold text-xs rounded">Cancel</button>
        </div>
        <button onClick={onSkipToggle} className="w-full mt-2 py-2 border border-border text-warning font-bold text-xs rounded hover:bg-warning/10">
          {skipped ? "UNSKIP EXERCISE" : "SKIP EXERCISE (TODAY)"}
        </button>
        <button onClick={onRemove} className="w-full mt-2 py-2 border border-border text-danger font-bold text-xs rounded hover:bg-danger/10">
          REMOVE FROM ROUTINE
        </button>
      </div>
    </div>
  );
}
