import React from 'react';
import { cn } from '../lib/utils';

interface TabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const tabs = [
    { id: 'check', label: 'Check', icon: '☐' },
    { id: 'prog', label: 'Progress', icon: '◆' },
    { id: 'nutr', label: 'Macros', icon: '⚖' },
    { id: 'data', label: 'Data', icon: '⇄' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#111] border-t border-border flex justify-center pb-[env(safe-area-inset-bottom)] z-40">
      <div className="flex max-w-[375px] w-full">
        {tabs.map((tab) => (
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
