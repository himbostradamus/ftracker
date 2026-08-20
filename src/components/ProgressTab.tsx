import React, { useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';
import { ChevronLeft, ChevronRight, Trophy } from 'lucide-react';
import { ALL_EX_CATS, AVAILABLE_EXERCISES } from '../constants';
import { getDef, getAllHistory, loadData } from '../lib/storage';
import { fmtDate, weightDisplay } from '../lib/helpers';
import { cn } from '../lib/utils';

export function ProgressTab() {
  const [progCat, setProgCat] = useState('Push');
  const [progExercise, setProgExercise] = useState<string | null>(null);
  const [metric, setMetric] = useState<'weight' | 'volume' | 'reps'>('weight');

  if (progExercise) {
    const def = getDef(progExercise);
    const hist = getAllHistory(progExercise);
    const maxVal = hist.length ? Math.max(...hist.map(h => h[metric])) : 0;
    
    const chartData = hist.slice(-15).map(h => ({
      name: fmtDate(h.date),
      weight: h.weight,
      volume: h.volume,
      reps: h.reps,
      isBest: h[metric] === maxVal
    }));

    const metricLabel = {
      weight: def.bw ? "Added weight" : "Weight",
      volume: "Total Volume",
      reps: "Total Reps"
    }[metric];

    const unit = {
      weight: "lbs",
      volume: "lbs",
      reps: "reps"
    }[metric];

    const bestDisplay = metric === "weight"
      ? `${weightDisplay(maxVal, def)}${def.bw ? "" : " lbs"}`
      : `${maxVal} ${unit}`;

    return (
      <div className="flex flex-col gap-4">
        <button 
          onClick={() => setProgExercise(null)}
          className="flex items-center gap-1 text-[#888] uppercase text-[10px] tracking-widest py-1"
        >
          <ChevronLeft size={18} /> Back
        </button>

        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-bold tracking-widest text-white uppercase">{progExercise}</h2>
            <p className="text-[10px] text-[#555] tracking-wider mt-1">
              {def.sets}×{def.reps} target {def.bw && '· bodyweight'} {hist.length ? `· ${hist.length} sessions` : '· No sessions yet'}
            </p>
          </div>
          <div className="flex bg-card border border-border rounded p-0.5">
            {(['weight', 'volume', 'reps'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={cn(
                  "px-2 py-1 text-[8px] font-bold tracking-widest uppercase rounded transition-colors",
                  metric === m ? "bg-primary text-bg" : "text-[#555]"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {hist.length >= 2 && (
          <div className="bg-card border border-border rounded-lg p-3">
            <p className="text-[9px] text-[#555] tracking-widest uppercase mb-3">{metricLabel} progression</p>
            <div className="h-[160px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                {metric === 'weight' ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
                    <XAxis dataKey="name" stroke="#333" fontSize={8} tickLine={false} axisLine={false} />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111', border: '1px solid #2A2A2A', fontSize: '10px' }}
                      itemStyle={{ color: '#E8C547' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="weight" 
                      stroke="#E8C547" 
                      strokeWidth={2} 
                      dot={{ fill: '#E8C547', r: 3 }}
                      activeDot={{ r: 5, stroke: '#0D0D0D', strokeWidth: 2 }}
                    />
                  </LineChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
                    <XAxis dataKey="name" stroke="#333" fontSize={8} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111', border: '1px solid #2A2A2A', fontSize: '10px' }}
                      itemStyle={{ color: '#E8C547' }}
                    />
                    <Bar dataKey={metric} radius={[2, 2, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.isBest ? '#47E8A0' : '#E8C54744'} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {hist.length > 0 && (
          <div className="flex items-center gap-2 p-2.5 bg-success/5 border border-success/20 rounded-lg">
            <Trophy size={14} className="text-success" />
            <div className="flex-1">
              <div className="text-[9px] text-success font-bold tracking-[2px] uppercase">Best {metricLabel}</div>
              <div className="text-sm text-[#ccc] font-bold">
                {bestDisplay}
              </div>
            </div>
          </div>
        )}


        <h3 className="text-[11px] font-bold tracking-widest text-[#888] uppercase mt-2">History</h3>
        {!hist.length ? (
          <div className="text-center py-8 text-[#333] text-xs tracking-widest">Complete sets in the checklist to start tracking</div>
        ) : (
          <div className="flex flex-col gap-1">
            {[...hist].reverse().slice(0, 20).map((h, i) => {
              const isBest = h[metric] === maxVal;
              return (
                <div key={i} className="flex items-start gap-2 p-2.5 bg-card border border-border rounded-lg">
                  <span className="text-[10px] text-[#555] w-[50px] shrink-0 pt-0.5">{fmtDate(h.date)}</span>
                  <div className="flex-1">
                    <div className="text-sm text-[#ccc] font-bold">{weightDisplay(h.weight, def)}{!def.bw && " lbs"}</div>
                    <div className="text-[10px] text-[#555] mt-0.5">
                      {h.completedSets}/{h.totalSets} sets · {h.reps} reps · {h.volume} vol
                    </div>
                  </div>
                  {isBest && (
                    <span className="text-[8px] text-success font-bold tracking-widest bg-success/15 border border-success/30 rounded px-1.5 py-0.5">BEST</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    );
  }

  const cat = ALL_EX_CATS.find(c => c.cat === progCat);
  const data = loadData();
  const baseItems: readonly string[] = cat?.items ?? [];
  const isLiftCategory = Object.hasOwn(AVAILABLE_EXERCISES, progCat);
  const configuredRoutine = isLiftCategory ? data[`custom-routine-${progCat}`] : undefined;
  const routineItems: string[] = Array.isArray(configuredRoutine)
    ? configuredRoutine.filter((name): name is string => typeof name === "string")
    : [...baseItems];
  const availableItems: readonly string[] = isLiftCategory
    ? AVAILABLE_EXERCISES[progCat as keyof typeof AVAILABLE_EXERCISES]
    : [];
  const knownItems = [...new Set([...baseItems, ...availableItems])];
  // Keep the active routine visible and retain access to history for exercises
  // that were later removed from it. Previously, added exercises never appeared
  // in Progress at all.
  const progressItems = [...new Set([
    ...routineItems,
    ...knownItems.filter(name => getAllHistory(name).length > 0)
  ])];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-base font-bold tracking-[5px] text-white">PROGRESS</h1>
      
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {ALL_EX_CATS.map(c => (
          <button
            key={c.cat}
            onClick={() => setProgCat(c.cat)}
            className={cn(
              "text-[9px] font-bold tracking-widest uppercase rounded px-2 py-1 border transition-colors shrink-0",
              progCat === c.cat ? "text-primary border-primary/40 bg-primary/10" : "text-[#666] border-[#252525] bg-card"
            )}
          >
            {c.cat}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        {progressItems.map(name => {
          const hist = getAllHistory(name);
          const def = getDef(name);
          const maxW = hist.length ? Math.max(...hist.map(h => h.weight)) : 0;
          
          return (
            <button
              key={name}
              onClick={() => setProgExercise(name)}
              className="flex items-center gap-2 p-2.5 bg-card border border-border rounded-lg text-left group active:bg-[#151515]"
            >
              <span className="text-xs font-medium text-[#ccc] flex-1">{name}</span>
              {hist.length > 0 && (def.bw || maxW > 0) && (
                <span className="text-[9px] text-success tracking-widest">{weightDisplay(maxW, def)}{!def.bw && " lbs"}</span>
              )}
              <span className="text-[9px] text-[#444] tracking-widest">{def.sets}×{def.reps}</span>
              <ChevronRight size={14} className="text-[#2A2A2A] group-active:text-primary" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
