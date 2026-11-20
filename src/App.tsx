import React, { Suspense, lazy, useState, useLayoutEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { ChecklistTab } from './components/ChecklistTab';
import { TabBar } from './components/TabBar';
import { RestTimer } from './components/RestTimer';
import { loadUIPrefs, saveUIPrefs } from './lib/storage';
import { UIPrefs } from './types';
import { useMobility, updateSettings as updateMobilitySettings } from './mobility/lib/store';

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

// The stretching section is a self-contained module with its own storage.
const MobilityApp = lazy(() => import('./mobility/ui/MobilityApp'));

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-16 text-muted text-xs tracking-widest uppercase">
      Loading…
    </div>
  );
}

export default function App() {
  const { settings } = useMobility();
  const [activeTab, setActiveTab] = useState(() => settings.lastSection === 'mobility' ? 'stretch' : 'check');
  const [initialRoutine, setInitialRoutine] = useState<string | undefined>();

  useLayoutEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = settings.appearance === 'dark' || (settings.appearance === 'system' && query.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.documentElement.style.fontSize = { normal: '100%', large: '112.5%', larger: '125%' }[settings.textSize];
      const bg = getComputedStyle(document.body).backgroundColor;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
    };
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [settings.appearance, settings.textSize]);

  const [viewOffset, setViewOffset] = useState(0);
  const [openWorkout, setOpenWorkout] = useState<{ dayIdx: number; typeIdx: number } | null>(null);
  const [timer, setTimer] = useState<{ duration: number } | null>(null);
  // UI prefs live in App-level state so TabBar re-renders the moment DataTab
  // toggles a tab visibility — localStorage by itself doesn't trigger renders.
  const [uiPrefs, setUIPrefs] = useState<UIPrefs>(() => loadUIPrefs());

  const [progressView, setProgressView] = useState<'Strength' | 'Stretching'>('Strength');

  const navigate = (tab: string, routine?: string) => {
    if (tab === 'prog' && activeTab !== 'prog') setProgressView(activeTab === 'stretch' ? 'Stretching' : 'Strength');
    setInitialRoutine(routine);
    setActiveTab(tab);
    setOpenWorkout(null);
    const section = tab === 'stretch' ? 'mobility' : 'tracker';
    if (section !== settings.lastSection) updateMobilitySettings({ lastSection: section });
    window.scrollTo(0, 0);
  };
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
      case 'stretch':
        return <Suspense fallback={<TabFallback />}><MobilityApp initialRoutine={initialRoutine} /></Suspense>;
      case 'check':
        return (
          <ChecklistTab
            viewOffset={viewOffset}
            setViewOffset={setViewOffset}
            onStretch={id => navigate('stretch', id)}
            onOpenWorkout={(di, ti) => setOpenWorkout({ dayIdx: di, typeIdx: ti })}
          />
        );
      case 'prog':
        return (
          <Suspense fallback={<TabFallback />}>
            <nav className="stretch-tabs" aria-label="Progress by activity">
              {(['Strength', 'Stretching'] as const).map(view => (
                <button key={view} aria-current={progressView === view ? 'page' : undefined}
                  onClick={() => setProgressView(view)}>{view}</button>
              ))}
            </nav>
            {progressView === 'Strength' ? <ProgressTab /> : <MobilityApp key="stretch-progress" progress />}
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
              onStretch={id => navigate('stretch', id)}
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
    <div className={activeTab === 'stretch' || (activeTab === 'prog' && progressView === 'Stretching') ? 'tracker-shell mobility-width' : 'tracker-shell'}>
      {!openWorkout && <TabBar activeTab={activeTab} uiPrefs={uiPrefs} onTabChange={navigate} />}
      {renderTab()}

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
