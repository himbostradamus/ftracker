import React, { useState } from 'react';
import { Plus, Trash2, ChevronRight, Scale, Target, Activity, Calendar } from 'lucide-react';
import { 
  loadNutrProfile, saveNutrProfile, loadWeightLog, saveWeightLog 
} from '../lib/storage';
import { calcTarget, lbToKg, ftInToCm, toDateKey } from '../lib/helpers';
import { cn } from '../lib/utils';
import { NutritionProfile } from '../types';

export function NutritionTab() {
  const [profile, setProfile] = useState<NutritionProfile | null>(loadNutrProfile());
  const [weightLog, setWeightLog] = useState(loadWeightLog());
  const [view, setView] = useState<'main' | 'edit'>(profile ? 'main' : 'edit');
  const [newWeight, setNewWeight] = useState('');

  const saveProfile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const weight = parseFloat(formData.get('weight') as string);
    const goalWeight = parseFloat(formData.get('goalWeight') as string);
    const ft = parseInt(formData.get('ft') as string);
    const inches = parseInt(formData.get('inches') as string);
    const age = parseInt(formData.get('age') as string);

    const numericFields = { weight, goalWeight, ft, inches, age };
    if (!Object.values(numericFields).every(Number.isFinite)) {
      alert("Please fill in age, height, weight, and goal weight.");
      return;
    }
    if (weight <= 0 || goalWeight <= 0 || age <= 0 || ft < 0 || inches < 0) {
      alert("Age, weight, and goal weight must be positive numbers.");
      return;
    }

    const newProfile: NutritionProfile = {
      sex: formData.get('sex') as 'm' | 'f',
      age,
      ft,
      inches,
      weight,
      goalWeight,
      startWeight: profile?.startWeight || weight,
      activity: formData.get('activity') as any,
      goal: formData.get('goal') as any,
      weightKg: lbToKg(weight),
      heightCm: ftInToCm(ft, inches)
    };
    
    saveNutrProfile(newProfile);
    setProfile(newProfile);
    setView('main');
  };

  const logWeight = () => {
    const v = parseFloat(newWeight);
    if (!v || v <= 0) return;
    const d = toDateKey(new Date());
    const newLog = [...weightLog.filter(e => e.date !== d), { date: d, weight: v }];
    newLog.sort((a, b) => a.date > b.date ? 1 : -1);
    setWeightLog(newLog);
    saveWeightLog(newLog);
    
    if (profile) {
      const updated = { ...profile, weight: v, weightKg: lbToKg(v) };
      setProfile(updated);
      saveNutrProfile(updated);
    }
    setNewWeight('');
  };

  const deleteEntry = (date: string) => {
    const wasLatest = weightLog.at(-1)?.date === date;
    const newLog = weightLog.filter(e => e.date !== date);
    setWeightLog(newLog);
    saveWeightLog(newLog);

    // Current weight follows the newest log entry. If that entry is removed,
    // roll back to the previous log (or the journey start if none remain).
    if (profile && wasLatest) {
      const weight = newLog.at(-1)?.weight ?? profile.startWeight;
      const updated = { ...profile, weight, weightKg: lbToKg(weight) };
      setProfile(updated);
      saveNutrProfile(updated);
    }
  };

  if (view === 'edit' || !profile) {
    const p = profile || { sex: 'm', age: 31, ft: 6, inches: 0, weight: 185, goalWeight: 155, activity: 'active', goal: 'cut' };
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-base font-bold tracking-[5px] text-white uppercase">{profile ? "EDIT PROFILE" : "SETUP"}</h1>
        <form onSubmit={saveProfile} className="flex flex-col gap-4">
          <div className="bg-card border border-border rounded-lg p-3">
            <h2 className="text-[10px] font-bold tracking-widest text-[#888] uppercase mb-3">About you</h2>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#555] w-[60px] text-right shrink-0">Sex</span>
                <div className="flex gap-1 flex-1">
                  <label className="flex-1">
                    <input type="radio" name="sex" value="m" defaultChecked={p.sex === 'm'} className="hidden peer" />
                    <div className="text-[10px] font-bold tracking-widest text-center py-1.5 rounded border border-[#2A2A2A] text-[#666] peer-checked:text-primary peer-checked:border-primary/40 peer-checked:bg-primary/10">Male</div>
                  </label>
                  <label className="flex-1">
                    <input type="radio" name="sex" value="f" defaultChecked={p.sex === 'f'} className="hidden peer" />
                    <div className="text-[10px] font-bold tracking-widest text-center py-1.5 rounded border border-[#2A2A2A] text-[#666] peer-checked:text-primary peer-checked:border-primary/40 peer-checked:bg-primary/10">Female</div>
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#555] w-[60px] text-right shrink-0">Age</span>
                <input name="age" type="number" defaultValue={p.age} className="flex-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded p-2 text-sm text-center outline-none max-w-[90px]" />
                <span className="text-[9px] text-[#444] w-7">yrs</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#555] w-[60px] text-right shrink-0">Height</span>
                <input name="ft" type="number" defaultValue={p.ft} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded p-2 text-sm text-center outline-none w-[45px]" />
                <span className="text-[9px] text-[#444]">ft</span>
                <input name="inches" type="number" defaultValue={p.inches} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded p-2 text-sm text-center outline-none w-[45px]" />
                <span className="text-[9px] text-[#444]">in</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#555] w-[60px] text-right shrink-0">Weight</span>
                <input name="weight" type="number" step="0.1" defaultValue={p.weight} className="flex-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded p-2 text-sm text-center outline-none max-w-[90px]" />
                <span className="text-[9px] text-[#444] w-7">lbs</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#555] w-[60px] text-right shrink-0">Goal wt</span>
                <input name="goalWeight" type="number" step="0.1" defaultValue={p.goalWeight} className="flex-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded p-2 text-sm text-center outline-none max-w-[90px]" />
                <span className="text-[9px] text-[#444] w-7">lbs</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-3">
            <h2 className="text-[10px] font-bold tracking-widest text-[#888] uppercase mb-3">Activity level</h2>
            <div className="flex flex-col gap-1">
              {[
                { v: 'sedentary', l: 'Sedentary', d: 'Desk job, no exercise' },
                { v: 'light', l: 'Light', d: '1–2 days/wk' },
                { v: 'moderate', l: 'Moderate', d: '3–4 days/wk' },
                { v: 'active', l: 'Active', d: '5–6 days/wk' },
                { v: 'very_active', l: 'Very active', d: 'Daily intense' }
              ].map(act => (
                <label key={act.v} className="block">
                  <input type="radio" name="activity" value={act.v} defaultChecked={p.activity === act.v} className="hidden peer" />
                  <div className="text-left p-2.5 rounded border border-[#2A2A2A] text-[#666] peer-checked:text-primary peer-checked:border-primary/40 peer-checked:bg-primary/10">
                    <span className="text-xs font-bold">{act.l}</span>
                    <span className="text-[9px] text-[#555] ml-2">{act.d}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-3">
            <h2 className="text-[10px] font-bold tracking-widest text-[#888] uppercase mb-3">Goal</h2>
            <div className="flex gap-1">
              {['cut', 'maintain', 'bulk'].map(g => (
                <label key={g} className="flex-1">
                  <input type="radio" name="goal" value={g} defaultChecked={p.goal === g} className="hidden peer" />
                  <div className="text-[10px] font-bold tracking-widest text-center py-2 rounded border border-[#2A2A2A] text-[#666] peer-checked:text-primary peer-checked:border-primary/40 peer-checked:bg-primary/10 uppercase">{g}</div>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" className="w-full py-3 rounded-md bg-primary text-bg font-bold text-[11px] tracking-widest">SAVE PROFILE</button>
          {profile && (
            <button type="button" onClick={() => setView('main')} className="text-[10px] text-[#555] tracking-widest py-2">Cancel</button>
          )}
        </form>
      </div>
    );
  }

  const t = calcTarget(profile);
  const goalLabel = { cut: "Cutting", maintain: "Maintaining", bulk: "Bulking" }[profile.goal];
  const startWeight = profile.startWeight;
  const totalJourney = Math.abs(startWeight - profile.goalWeight) || 1;
  const delta = profile.weight - startWeight; // signed: + means gained, - means lost
  // Distance toward goal in the goal's direction. Negative if user moved away from goal.
  const towardGoal = profile.goal === 'cut' ? -delta : profile.goal === 'bulk' ? delta : 0;
  const pctDone = Math.max(0, Math.min(100, Math.round(towardGoal / totalJourney * 100)));

  // For the running diff between adjacent log entries, "good" is goal-aware too.
  const isGoodChange = (change: number) => {
    if (profile.goal === 'cut') return change < 0;
    if (profile.goal === 'bulk') return change > 0;
    return Math.abs(change) < 1; // maintain: small swings are fine
  };
  const totalDeltaClass =
    delta === 0 ? "text-[#888]"
    : (profile.goal === 'maintain' ? "text-[#ccc]"
      : (isGoodChange(delta) ? "text-success" : "text-danger"));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-base font-bold tracking-[5px] text-white">MACROS</h1>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="text-center mb-4">
          <div className="text-[32px] font-bold text-primary tracking-widest leading-none mb-1">{t.cal}</div>
          <div className="text-[9px] text-[#555] tracking-[2px] uppercase">daily calories</div>
          <div className="text-[10px] text-[#444] mt-1">{goalLabel} · TDEE {t.tdee}</div>
        </div>
        
        <div className="flex justify-around py-2 border-t border-border/50 mt-2">
          <div className="flex flex-col items-center">
            <div className="text-xl font-bold text-success">{t.protein}</div>
            <div className="text-[8px] text-[#555] tracking-widest uppercase">grams</div>
            <div className="text-[9px] text-success font-bold tracking-widest uppercase mt-0.5">Protein</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-xl font-bold text-primary">{t.carbs}</div>
            <div className="text-[8px] text-[#555] tracking-widest uppercase">grams</div>
            <div className="text-[9px] text-primary font-bold tracking-widest uppercase mt-0.5">Carbs</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-xl font-bold text-danger">{t.fat}</div>
            <div className="text-[8px] text-[#555] tracking-widest uppercase">grams</div>
            <div className="text-[9px] text-danger font-bold tracking-widest uppercase mt-0.5">Fat</div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-[10px] font-bold tracking-widest text-[#888] uppercase mb-3">Weight progress</h2>
        
        {profile.goal !== 'maintain' && (
          <>
            <div className="text-[22px] font-bold text-success text-center tracking-widest">{pctDone}%</div>
            <div className="text-[9px] text-[#555] text-center tracking-widest uppercase mb-3">{profile.goal === 'cut' ? 'lost' : 'gained'} toward goal</div>
            
            <div className="h-6 bg-[#1A1A1A] rounded-md overflow-hidden relative mb-1.5">
              <div className="h-full bg-gradient-to-r from-primary to-success transition-all duration-500" style={{ width: `${pctDone}%` }} />
            </div>
            <div className="flex justify-between text-[9px] text-[#555] mb-4">
              <span>{startWeight} lbs</span>
              <span className="text-success">{profile.goalWeight} lbs</span>
            </div>
          </>
        )}

        <div className="flex gap-1 mb-4">
          <div className="flex-1 bg-bg border border-border rounded p-2 flex flex-col items-center">
            <div className={cn("text-sm font-bold", totalDeltaClass)}>
              {delta > 0 ? "+" : delta < 0 ? "−" : ""}{Math.abs(delta).toFixed(1)}
            </div>
            <div className="text-[8px] text-[#555] tracking-widest uppercase">Total Lbs</div>
          </div>
          <div className="flex-1 bg-bg border border-border rounded p-2 flex flex-col items-center">
            <div className="text-sm font-bold text-[#ccc]">{profile.weight}</div>
            <div className="text-[8px] text-[#555] tracking-widest uppercase">Current</div>
          </div>
          <div className="flex-1 bg-bg border border-border rounded p-2 flex flex-col items-center">
            <div className="text-sm font-bold text-accent">{profile.goalWeight}</div>
            <div className="text-[8px] text-[#555] tracking-widest uppercase">Goal</div>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <input 
            type="number" 
            step="0.1" 
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            placeholder={profile.weight.toString()}
            className="flex-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded p-2 text-sm text-center outline-none"
          />
          <button onClick={logWeight} className="px-4 py-2 bg-success text-bg font-bold text-[11px] tracking-widest rounded">LOG</button>
        </div>

        <div className="flex flex-col gap-1">
          {[...weightLog].reverse().slice(0, 5).map((e, i, arr) => {
            const prev = arr[i + 1];
            const diff = prev ? (e.weight - prev.weight).toFixed(1) : null;
            const fmtD = new Date(e.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
            return (
              <div key={e.date} className="flex items-center gap-2 py-1.5 text-[11px] border-b border-border/30 last:border-0">
                <span className="text-[#555] w-14 shrink-0">{fmtD}</span>
                <span className="text-[#ccc] font-bold flex-1">{e.weight} lbs</span>
                {diff !== null && (
                  <span className={cn("font-bold text-[10px]", isGoodChange(parseFloat(diff)) ? "text-success" : parseFloat(diff) === 0 ? "text-[#888]" : "text-danger")}>
                    {parseFloat(diff) > 0 ? "+" : ""}{diff}
                  </span>
                )}
                <button onClick={() => deleteEntry(e.date)} className="text-[#333] px-1 hover:text-danger">×</button>
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={() => setView('edit')} className="w-full py-2.5 rounded-md border border-border text-[#555] font-bold text-[10px] tracking-widest uppercase">EDIT PROFILE</button>
    </div>
  );
}
