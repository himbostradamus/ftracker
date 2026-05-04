import React, { useState } from 'react';
import { Download, Upload, Trash2, Database } from 'lucide-react';
import { loadData, loadConfigs, loadNutrProfile, loadWeightLog, saveData, saveConfigs, saveNutrProfile, saveWeightLog } from '../lib/storage';
import { cn } from '../lib/utils';

export function DataTab() {
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const exportData = () => {
    const payload = JSON.stringify({
      checklist: loadData(),
      configs: loadConfigs(),
      nutrProfile: loadNutrProfile(),
      weightLog: loadWeightLog(),
      version: 6,
      exported: new Date().toISOString()
    }, null, 2);
    
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `training-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMsg({ type: 'ok', text: "Backup downloaded" });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const p = JSON.parse(ev.target?.result as string);
        const hasExisting =
          Object.keys(loadData()).length > 0 ||
          Object.keys(loadConfigs()).length > 0 ||
          loadNutrProfile() !== null ||
          loadWeightLog().length > 0;
        if (hasExisting && !confirm(
          "Import will merge backup data with what you have on this device. " +
          "For any overlapping entries the backup values will win, and your nutrition profile will be replaced. " +
          "Continue?"
        )) {
          e.target.value = "";
          return;
        }
        if (p.checklist) saveData({ ...loadData(), ...p.checklist });
        if (p.configs) saveConfigs({ ...loadConfigs(), ...p.configs });
        if (p.nutrProfile) saveNutrProfile(p.nutrProfile);
        if (p.weightLog) {
          const currentLog = loadWeightLog();
          const merged = [...currentLog, ...p.weightLog.filter((w: any) => !currentLog.find(e => e.date === w.date))];
          merged.sort((a, b) => a.date > b.date ? 1 : -1);
          saveWeightLog(merged);
        }
        setMsg({ type: 'ok', text: "Imported successfully" });
      } catch (err) {
        setMsg({ type: 'err', text: "Could not parse file" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const clearAllData = () => {
    if (!confirm("Delete ALL training data? This cannot be undone.")) return;
    saveData({});
    saveConfigs({});
    saveNutrProfile(null);
    saveWeightLog([]);
    setMsg({ type: 'ok', text: "All data cleared" });
    window.location.reload();
  };

  const data = loadData();
  const keys = Object.keys(data);
  const lk = keys.filter(k => k.startsWith("lift-")).length;
  const ck = keys.length - lk;
  const sz = (new Blob([JSON.stringify(data)])).size;
  const ss = sz > 1024 ? (sz / 1024).toFixed(1) + " KB" : sz + " B";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-base font-bold tracking-[5px] text-white">DATA</h1>
      
      {msg && (
        <div className={cn(
          "text-[11px] p-2 rounded-md text-center tracking-wider border",
          msg.type === 'ok' ? "bg-success/10 text-success border-success/30" : "bg-danger/10 text-danger border-danger/30"
        )}>
          {msg.text}
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Database size={14} className="text-[#888]" />
          <h2 className="text-[11px] font-bold tracking-widest text-[#888] uppercase">Storage</h2>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-[11px]">
            <span className="text-[#666]">Total keys</span>
            <span className="text-[#ccc] font-bold">{keys.length}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[#666]">Checklist entries</span>
            <span className="text-[#ccc] font-bold">{ck}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[#666]">Lift sessions</span>
            <span className="text-[#ccc] font-bold">{lk}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[#666]">Data size</span>
            <span className="text-[#ccc] font-bold">{ss}</span>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-[11px] font-bold tracking-widest text-[#888] uppercase mb-1.5">Export</h2>
        <p className="text-[10px] text-[#444] leading-relaxed mb-3">Download a JSON backup of your data.</p>
        <button onClick={exportData} className="w-full py-2.5 rounded-md bg-primary text-bg font-bold text-[11px] tracking-widest flex items-center justify-center gap-2">
          <Download size={14} /> EXPORT BACKUP
        </button>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-[11px] font-bold tracking-widest text-[#888] uppercase mb-1.5">Import</h2>
        <p className="text-[10px] text-[#444] leading-relaxed mb-3">Restore from a backup. Workouts and configs are merged with backup values winning on overlap; the nutrition profile is replaced.</p>
        <input type="file" id="import-file" accept=".json" className="hidden" onChange={handleImport} />
        <button onClick={() => document.getElementById('import-file')?.click()} className="w-full py-2.5 rounded-md border border-[#2A2A2A] text-[#888] font-bold text-[11px] tracking-widest flex items-center justify-center gap-2">
          <Upload size={14} /> IMPORT BACKUP
        </button>
      </div>

      <div className="bg-card border border-danger/20 rounded-lg p-4">
        <h2 className="text-[11px] font-bold tracking-widest text-danger uppercase mb-1.5">Danger zone</h2>
        <p className="text-[10px] text-[#444] leading-relaxed mb-3">Permanently delete all data from this device.</p>
        <button onClick={clearAllData} className="w-full py-2.5 rounded-md border border-danger/30 text-danger font-bold text-[11px] tracking-widest flex items-center justify-center gap-2">
          <Trash2 size={14} /> CLEAR ALL DATA
        </button>
      </div>
    </div>
  );
}
