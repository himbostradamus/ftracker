import { Activity, BookOpen, CalendarDays, ChartNoAxesColumn, Database, Utensils } from 'lucide-react';
import { UIPrefs } from '../types';

interface TabBarProps {
  activeTab: string;
  uiPrefs: UIPrefs;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'check', label: 'Week', Icon: CalendarDays },
  { id: 'stretch', label: 'Stretch', Icon: Activity },
  { id: 'prog', label: 'Progress', Icon: ChartNoAxesColumn },
  { id: 'nutr', label: 'Macros', Icon: Utensils },
  { id: 'data', label: 'Data', Icon: Database },
];

export function TabBar({ activeTab, uiPrefs, onTabChange }: TabBarProps) {
  return (
    <header className="journal-header">
      <div className="journal-brand"><BookOpen size={23} strokeWidth={1.6} />Training journal</div>
      <nav aria-label="Training journal" className="journal-tabs">
        {tabs.filter(tab => tab.id !== 'nutr' || !uiPrefs.hideNutrition).map(({ id, label, Icon }) => (
          <button type="button" key={id} aria-current={activeTab === id ? 'page' : undefined} onClick={() => onTabChange(id)}>
            <Icon aria-hidden="true" size={17} />{label}
          </button>
        ))}
      </nav>
    </header>
  );
}
