import React, { Suspense, lazy, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ChecklistTab } from './components/ChecklistTab';
import { TabBar } from './components/TabBar';
import { RestTimer } from './components/RestTimer';
import { loadUIPrefs, saveUIPrefs } from './lib/storage';
import { UIPrefs } from './types';

// Lazy chunks: kept out of the initial bundle since the user lands on the
// Checklist tab. Recharts (Progress) is the biggest win.
const ProgressTab = lazy(() =>
  import('./components/ProgressTab').then(m => ({ default: m.ProgressTab }))
);
const NutritionTab = lazy(() =>
  import('./components/NutritionTab').then(m => ({ default: m.NutritionTab }))
);
const DataTab = lazy(() =>
  import('./components/DataTab').then(m => ({ default: m.DataTab }))
);
const WorkoutDetail = lazy(() =>
  import('./components/WorkoutDetail').then(m => ({ default: m.WorkoutDetail }))
);

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-16 text-[#444] text-[10px] tracking-widest uppercase">
      Loading…
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('check');
  const [viewOffset, setViewOffset] = useState(0);
  const [openWorkout, setOpenWorkout] = useState<{ dayIdx: number; typeIdx: number } | null>(null);
  const [timer, setTimer] = useState<{ duration: number } | null>(null);
  // UI prefs live in App-level state so TabBar re-renders the moment DataTab
  // toggles a tab visibility — localStorage by itself doesn't trigger renders.
  const [uiPrefs, setUIPrefs] = useState<UIPrefs>(() => loadUIPrefs());

  const updatePrefs = (next: UIPrefs) => {
    saveUIPrefs(next);
    setUIPrefs(next);
    // If the user just hid the tab they're currently on, snap back to Check.
    if (next.hideNutrition && activeTab === 'nutr') setActiveTab('check');
  };

  const renderTab = () => {
    if (openWorkout) {
      return (
        <Suspense fallback={<TabFallback />}>
          <WorkoutDetail
            dayIdx={openWorkout.dayIdx}
            typeIdx={openWorkout.typeIdx}
            viewOffset={viewOffset}
            onBack={() => setOpenWorkout(null)}
            onStartTimer={(d) => setTimer({ duration: d })}
          />
        </Suspense>
      );
    }

    switch (activeTab) {
      case 'check':
        return (
          <ChecklistTab
            viewOffset={viewOffset}
            setViewOffset={setViewOffset}
            onOpenWorkout={(di, ti) => setOpenWorkout({ dayIdx: di, typeIdx: ti })}
          />
        );
      case 'prog':
        return (
          <Suspense fallback={<TabFallback />}>
            <ProgressTab />
          </Suspense>
        );
      case 'nutr':
        // Defensive guard: if prefs say the tab is hidden but somehow the
        // active tab still resolves to 'nutr' (shouldn't happen given the
        // setActiveTab redirect in updatePrefs, but cheap insurance), show
        // the default tab instead.
        if (uiPrefs.hideNutrition) {
          return (
            <ChecklistTab
              viewOffset={viewOffset}
              setViewOffset={setViewOffset}
              onOpenWorkout={(di, ti) => setOpenWorkout({ dayIdx: di, typeIdx: ti })}
            />
          );
        }
        return (
          <Suspense fallback={<TabFallback />}>
            <NutritionTab />
          </Suspense>
        );
      case 'data':
        return (
          <Suspense fallback={<TabFallback />}>
            <DataTab uiPrefs={uiPrefs} onUpdatePrefs={updatePrefs} />
          </Suspense>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-[375px] mx-auto p-3 safe-top safe-bottom min-h-screen">
      {renderTab()}

      {!openWorkout && (
        <TabBar
          activeTab={activeTab}
          uiPrefs={uiPrefs}
          onTabChange={(t) => { setActiveTab(t); setViewOffset(0); }}
        />
      )}

      <AnimatePresence>
        {timer && (
          <RestTimer
            key="rest-timer"
            duration={timer.duration}
            onDismiss={() => setTimer(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
