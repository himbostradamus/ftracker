import React, { useState } from 'react';
import { ChevronLeft, Settings, Minus, Plus, Check } from 'lucide-react';
import { TYPE_META, EXERCISES, AVAILABLE_EXERCISES } from '../constants';
import { getWeekId, getMon, fmtDate, getWeekTemplate } from '../lib/helpers';
import { 
  loadData, saveData, getDef, getLift, saveConfigs, loadConfigs, updateWeekLifts 
} from '../lib/storage';
import { cn } from '../lib/utils';
import { ExerciseConfig } from '../types';
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
  const weekId = getWeekId(mon);

  const sched = getWeekTemplate(weekId, data);
  const di = sched[dayIdx];
  const item = di?.items[typeIdx];
  
  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-4 text-center">
        <p className="text-[#888] text-sm">Workout removed or not found.</p>
        <button onClick={onBack} className="flex items-center gap-1 text-[#ccc] uppercase text-[10px] tracking-widest py-2 px-4 border border-[#333] rounded">
          <ChevronLeft size={18} /> BACK TO MENU
        </button>
      </div>
    );
  }

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
    const ld = getLift(dayIdx, exName, weekId);
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
    const key = `lift-${weekId}-${dayIdx}-${exName}`;
    const newData = { ...data, [key]: newLd };
    setData(newData);
    saveData(newData);
    
    if (row.some(r => r) && !wasDone) onStartTimer(getDef(exName).rest);
  };

  const setWeight = (exName: string, w: number) => {
    const ld = getLift(dayIdx, exName, weekId);
    const newLd = { ...ld, weight: Math.max(0, w) };
    const key = `lift-${weekId}-${dayIdx}-${exName}`;
    const newData = { ...data, [key]: newLd };
    setData(newData);
    saveData(newData);
  };

  const toggleExChk = (ei: number) => {
    const key = `${weekId}-${dayIdx}-${typeIdx}-ex${ei}`;
    const newData = { ...data, [key]: !data[key] };
    setData(newData);
    saveData(newData);
  };

  const toggleComplete = () => {
    const key = `${weekId}-${dayIdx}-${typeIdx}`;
    const newData = { ...data, [key]: !data[key] };
    setData(newData);
    saveData(newData);
  };

  const toggleSkip = (exName: string) => {
    const ld = getLift(dayIdx, exName, weekId);
    const newLd = { ...ld, skipped: !ld.skipped };
    const key = `lift-${weekId}-${dayIdx}-${exName}`;
    const newData = { ...data, [key]: newLd };
    setData(newData);
    saveData(newData);
  };

  const isExDone = (name: string) => {
    const ld = getLift(dayIdx, name, weekId);
    return ld.skipped || ld.grid.every(row => row.some(r => r));
  };

  const completedExCount = isLift 
    ? exercises.filter(name => isExDone(name)).length
    : exercises.filter((_, ei) => data[`${weekId}-${dayIdx}-${typeIdx}-ex${ei}`]).length;

  const isWorkoutDone = data[`${weekId}-${dayIdx}-${typeIdx}`];

  return (
    <div className="flex flex-col gap-4 pb-20">
      <div className="flex justify-between items-center">
        <button onClick={onBack} className="flex items-center gap-1 text-[#888] uppercase text-[10px] tracking-widest py-1">
          <ChevronLeft size={18} /> Back
        </button>
        {isLift && (
          <button 
            onClick={() => setEditingSchedule(!editingSchedule)}
            className="flex items-center gap-1 text-primary uppercase text-[10px] tracking-widest py-1"
          >
            {editingSchedule ? 'Done' : 'Edit Schedule'}
          </button>
        )}
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
        <>
          <div className="flex items-center gap-3">
            <div className="text-2xl" style={{ color: meta.color }}>{meta.icon}</div>
            <div className="flex-1">
              <div className="text-lg font-bold tracking-widest text-white uppercase">{label}</div>
              <div className="text-[10px] text-[#555] tracking-widest uppercase">{fmtDate(dd)}</div>
            </div>
            <div className="flex items-baseline">
              <span className="text-2xl font-bold" style={{ color: completedExCount === exercises.length ? '#47E8A0' : meta.color }}>{completedExCount}</span>
              <span className="text-xs text-[#444]">/{exercises.length}</span>
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
                const ld = getLift(dayIdx, name, weekId);
                const done = isExDone(name);
                const isEditing = editingEx === name;

            if (isEditing) {
              return (
                <ExerciseEditForm
                  key={name}
                  name={name}
                  def={def}
                  skipped={!!ld.skipped}
                  onSave={(s, r, w) => {
                    saveConfigs({ ...loadConfigs(), [name]: { ...def, sets: s, reps: r, w } });
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
                  <span className={cn("text-xs font-bold text-[#ccc]", ld.skipped && "line-through text-[#666]")}>{name}</span>
                  <div className="flex items-center gap-2">
                    {ld.skipped && <span className="text-[9px] text-[#555] tracking-widest uppercase">SKIPPED</span>}
                    {!ld.skipped && <span className="text-[9px] text-[#444] tracking-widest uppercase">{ld.grid.filter(r => r.some(x => x)).length}/{def.sets} sets</span>}
                    <button onClick={() => setEditingEx(name)} className="text-[#333] hover:text-primary"><Settings size={12} /></button>
                  </div>
                </div>

                {!ld.skipped && (
                  <>
                    <div className="flex items-center gap-0 mb-3">
                      <button onClick={() => setWeight(name, ld.weight - def.inc)} className="w-8 h-7 bg-[#1A1A1A] border border-[#2A2A2A] rounded-l-md text-[#888] flex items-center justify-center active:bg-[#252525]"><Minus size={14} /></button>
                      <div className="flex-1 h-7 bg-card border-y border-[#2A2A2A] flex items-center justify-center text-sm font-bold text-primary tracking-widest">
                        {def.bw && <span className="text-[9px] text-[#888] mr-1">BW</span>}
                        {def.bw ? (ld.weight > 0 ? `+${ld.weight}` : "") : ld.weight}
                        {!def.bw && <span className="text-[9px] text-[#555] ml-1">lbs</span>}
                      </div>
                      <button onClick={() => setWeight(name, ld.weight + def.inc)} className="w-8 h-7 bg-[#1A1A1A] border border-[#2A2A2A] rounded-r-md text-[#888] flex items-center justify-center active:bg-[#252525]"><Plus size={14} /></button>
                    </div>

                    <div className="flex flex-col gap-1">
                      {ld.grid.map((row, si) => (
                        <div key={si} className="flex items-center gap-1">
                          <span className={cn("text-[8px] w-5 text-center font-bold", row.some(r => r) ? "text-success/50" : "text-[#444]")}>S{si + 1}</span>
                          <div className="flex gap-0.5 flex-1">
                            {row.map((val, ri) => (
                              <button 
                                key={ri}
                                onClick={() => toggleRep(name, si, ri)}
                                className={cn("flex-1 h-6 rounded border-[1.5px] border-[#222] transition-all active:scale-90", val && "bg-[var(--c)] border-[var(--c)]")}
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
            <button onClick={() => setAddingExercise(true)} className="w-full mt-2 py-3 border-2 border-dashed border-[#2A2A2A] text-[#888] font-bold text-[10px] tracking-widest uppercase rounded hover:bg-[#1A1A1A] transition-colors">
              + Add Exercise
            </button>
          ) : (
            <div className="bg-card border border-border rounded-lg p-3 mt-2">
              <h3 className="text-[10px] font-bold tracking-widest text-[#888] uppercase mb-3">Add Exercise to {item.liftType}</h3>
              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                {(AVAILABLE_EXERCISES[item.liftType as keyof typeof AVAILABLE_EXERCISES] || []).filter(ex => !exercises.includes(ex)).map(ex => (
                  <button 
                    key={ex} 
                    onClick={() => handleAddExercise(ex)}
                    className="flex items-center justify-between p-2.5 bg-bg border border-[#2A2A2A] rounded text-left text-xs font-bold text-[#ccc] hover:bg-[#1A1A1A] transition-colors"
                  >
                    {ex} <Plus size={14} className="text-[#888]" />
                  </button>
                ))}
              </div>
              <button onClick={() => setAddingExercise(false)} className="w-full mt-3 py-2 border border-border text-[#555] font-bold text-[10px] tracking-widest uppercase rounded hover:bg-[#1A1A1A] transition-colors">
                Cancel
              </button>
            </div>
          )}
        </>
        ) : (
          exercises.map((name, ei) => {
            const chk = data[`${weekId}-${dayIdx}-${typeIdx}-ex${ei}`];
            return (
              <div key={ei} className="flex items-center gap-2 p-2.5 bg-card border border-border rounded-lg">
                <span className="text-xs font-medium text-[#ccc] flex-1">{name}</span>
                <button 
                  onClick={() => toggleExChk(ei)}
                  className={cn("w-9 h-9 rounded-lg border-2 flex items-center justify-center text-xs", chk ? "bg-[var(--c)] border-[var(--c)] text-bg" : "border-[#2A2A2A] text-[#555]")}
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
          "w-full py-3 rounded-lg font-bold text-[11px] tracking-[3px] border transition-all mt-4",
          isWorkoutDone 
            ? "bg-[var(--c-dim)] text-[var(--c)] border-[var(--c)]" 
            : "bg-[var(--c)] text-bg border-[var(--c)]"
        )}
        style={{ '--c': meta.color, '--c-dim': meta.color + "22" } as any}
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
  def: ExerciseConfig;
  skipped: boolean;
  onSave: (sets: number, reps: number, weight: number) => void;
  onCancel: () => void;
  onSkipToggle: () => void;
  onRemove: () => void;
}

function ExerciseEditForm({ name, def, skipped, onSave, onCancel, onSkipToggle, onRemove }: ExerciseEditFormProps) {
  const [sets, setSets] = useState(String(def.sets));
  const [reps, setReps] = useState(String(def.reps));
  const [weight, setWeight] = useState(String(def.w));

  const handleSave = () => {
    const s = parseInt(sets, 10);
    const r = parseInt(reps, 10);
    const w = parseFloat(weight);
    if (!Number.isFinite(s) || !Number.isFinite(r) || !Number.isFinite(w) || s <= 0 || r <= 0 || w < 0) {
      return;
    }
    onSave(s, r, w);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <h3 className="text-[10px] font-bold tracking-widest text-[#888] uppercase mb-3">Edit {name}</h3>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#555]">Sets</span>
          <input type="number" min={1} value={sets} onChange={(e) => setSets(e.target.value)} className="bg-bg border border-border rounded p-1 text-xs text-center w-12" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#555]">Reps</span>
          <input type="number" min={1} value={reps} onChange={(e) => setReps(e.target.value)} className="bg-bg border border-border rounded p-1 text-xs text-center w-12" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#555]">Weight</span>
          <input type="number" min={0} step="0.5" value={weight} onChange={(e) => setWeight(e.target.value)} className="bg-bg border border-border rounded p-1 text-xs text-center w-12" />
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={handleSave} className="flex-1 py-2 bg-primary text-bg font-bold text-[10px] rounded">SAVE</button>
          <button onClick={onCancel} className="flex-1 py-2 border border-border text-[#555] font-bold text-[10px] rounded">Cancel</button>
        </div>
        <button onClick={onSkipToggle} className="w-full mt-2 py-2 border border-[#2A2A2A] text-warning font-bold text-[10px] rounded hover:bg-warning/10">
          {skipped ? "UNSKIP EXERCISE" : "SKIP EXERCISE (TODAY)"}
        </button>
        <button onClick={onRemove} className="w-full mt-2 py-2 border border-[#2A2A2A] text-danger font-bold text-[10px] rounded hover:bg-danger/10">
          REMOVE FROM ROUTINE
        </button>
      </div>
    </div>
  );
}
