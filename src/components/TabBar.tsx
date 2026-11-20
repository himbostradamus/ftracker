import { Activity, Dumbbell, ChartNoAxesColumn, Database, Utensils } from 'lucide-react';
import { UIPrefs } from '../types';

interface TabBarProps {
  activeTab: string;
  uiPrefs: UIPrefs;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'check', label: 'Week', Icon: Dumbbell },
  { id: 'prog', label: 'Progress', Icon: ChartNoAxesColumn },
  { id: 'nutr', label: 'Macros', Icon: Utensils },
  { id: 'stretch', label: 'Stretch', Icon: Activity },
  { id: 'data', label: 'Data', Icon: Database },
];

export function TabBar({ activeTab, uiPrefs, onTabChange }: TabBarProps) {
  return (
    <nav aria-label="Training tracker" className="tracker-nav">
      <div className="tracker-tabs">
        {tabs.filter(tab => tab.id !== 'nutr' || !uiPrefs.hideNutrition).map(({ id, label, Icon }) => (
          <button type="button" key={id} aria-current={activeTab === id ? 'page' : undefined} onClick={() => onTabChange(id)}>
            <Icon aria-hidden="true" size={17} />{label}
          </button>
        ))}
      </div>
    </nav>
  );
}
