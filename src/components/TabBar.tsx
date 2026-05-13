import React from 'react';
import { cn } from '../lib/utils';
import { UIPrefs } from '../types';

interface TabBarProps {
  activeTab: string;
  uiPrefs: UIPrefs;
  onTabChange: (tab: string) => void;
}

interface TabDef {
  id: string;
  label: string;
  icon: string;
  hidden?: boolean;
}

export function TabBar({ activeTab, uiPrefs, onTabChange }: TabBarProps) {
  // Single source of truth for tab presence. Adding a new togglable tab =
  // one line here, no edits to App.tsx or DataTab.
  const tabs: TabDef[] = [
    { id: 'check', label: 'Check',    icon: '☐' },
    { id: 'prog',  label: 'Progress', icon: '◆' },
    { id: 'nutr',  label: 'Macros',   icon: '⚖', hidden: !!uiPrefs.hideNutrition },
    { id: 'data',  label: 'Data',     icon: '⇄' },
  ];
  const visible = tabs.filter(t => !t.hidden);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#111] border-t border-border flex justify-center pb-[env(safe-area-inset-bottom)] z-40">
      <div className="flex max-w-[375px] w-full">
        {visible.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2 pb-1.5 text-[8px] tracking-[1.2px] uppercase transition-colors",
              activeTab === tab.id ? "text-primary" : "text-[#555]"
            )}
          >
            <span className="text-sm leading-none">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
