import React, { useState } from 'react';
import { Download, Upload, Trash2, Database, Eye } from 'lucide-react';
import { loadData, normalizeWorkoutData, clearAppData, loadConfigs, loadNutrProfile, loadWeightLog, saveData, saveConfigs, saveNutrProfile, saveWeightLog, mergeWeightLogs } from '../lib/storage';
import { cn } from '../lib/utils';
import { toDateKey } from '../lib/helpers';
import { UIPrefs } from '../types';

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

interface DataTabProps {
  uiPrefs: UIPrefs;
  onUpdatePrefs: (next: UIPrefs) => void;
}

export function DataTab({ uiPrefs, onUpdatePrefs }: DataTabProps) {
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const exportData = () => {
    const payload = JSON.stringify({
      checklist: loadData(),
      configs: loadConfigs(),
      nutrProfile: loadNutrProfile(),
      weightLog: loadWeightLog(),
      uiPrefs,
      version: 8,
      exported: new Date().toISOString()
    }, null, 2);

    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `training-backup-${toDateKey(new Date())}.json`;
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
        if (!isRecord(p)) throw new Error("Backup must be a JSON object");
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
        const knownFields = ["checklist", "configs", "nutrProfile", "weightLog", "uiPrefs"];
        if (!knownFields.some(field => Object.hasOwn(p, field))) {
          throw new Error("No recognized backup data");
        }

        // Validate the entire payload before writing anything, so a malformed
        // later section cannot leave the app with a partial import.
        if (p.checklist !== undefined && !isRecord(p.checklist)) {
          throw new Error("Invalid workout data");
        }
        if (p.configs !== undefined && !isRecord(p.configs)) {
          throw new Error("Invalid exercise configuration");
        }
        if (Object.hasOwn(p, "nutrProfile") &&
            p.nutrProfile !== null && !isRecord(p.nutrProfile)) {
          throw new Error("Invalid nutrition profile");
        }
        if (p.weightLog !== undefined && (
          !Array.isArray(p.weightLog) || !p.weightLog.every(w =>
            isRecord(w) && typeof w.date === "string" &&
            typeof w.weight === "number" && Number.isFinite(w.weight)
          )
        )) {
          throw new Error("Invalid weight log");
        }
        if (p.uiPrefs !== undefined && !isRecord(p.uiPrefs)) {
          throw new Error("Invalid UI preferences");
        }

        if (p.checklist !== undefined) {
          saveData({ ...loadData(), ...normalizeWorkoutData(p.checklist) });
        }
        if (p.configs !== undefined) {
          saveConfigs({ ...loadConfigs(), ...p.configs });
        }
        if (Object.hasOwn(p, "nutrProfile")) {
          saveNutrProfile(p.nutrProfile as any);
        }
        if (p.weightLog !== undefined) {
          saveWeightLog(mergeWeightLogs(loadWeightLog(), p.weightLog as any));
        }
        if (p.uiPrefs !== undefined) {
          onUpdatePrefs({ ...uiPrefs, ...p.uiPrefs });
        }
        setMsg({ type: 'ok', text: "Imported successfully" });
      } catch (err) {
        setMsg({ type: 'err', text: "Invalid backup file" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const clearAllData = () => {
    if (!confirm("Permanently delete all workout, configuration, nutrition, and weight data?")) return;
    if (!confirm("Are you absolutely sure? This cannot be undone.")) return;
    clearAppData();
    setMsg({ type: 'ok', text: "All data cleared" });
    setTimeout(() => window.location.reload(), 500);
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
          <Eye size={14} className="text-[#888]" />
          <h2 className="text-[11px] font-bold tracking-widest text-[#888] uppercase">Display</h2>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] text-[#ccc]">Show Macros tab</span>
            <span className="text-[9px] text-[#444] leading-relaxed">Calorie targets, macros, and weight tracking. Hide if you'd rather not see this data.</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!uiPrefs.hideNutrition}
            aria-label="Show Macros tab"
            onClick={() => onUpdatePrefs({ ...uiPrefs, hideNutrition: !uiPrefs.hideNutrition })}
            className={cn(
              "px-2.5 py-1 rounded text-[10px] font-bold tracking-widest border transition-colors shrink-0 ml-3",
              !uiPrefs.hideNutrition
                ? "bg-success/15 text-success border-success/40"
                : "bg-bg text-[#555] border-border"
            )}
          >
            {!uiPrefs.hideNutrition ? "ON" : "OFF"}
          </button>
        </div>
      </div>

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
