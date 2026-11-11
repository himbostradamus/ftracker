import { loadConfigs, loadData, loadNutrProfile, loadUIPrefs, loadWeightLog } from './storage';
import { exportMobility } from '../mobility/lib/backup';
import { getState } from '../mobility/lib/store';

// One file containing everything the app stores on this device: the lift
// tracker's data in its existing backup format, plus the stretching data.
// The same shape is produced by the Data tab, so either screen's backup can
// be restored from the Data tab.
export function buildFullBackup(now = new Date()) {
  return {
    checklist: loadData(),
    configs: loadConfigs(),
    nutrProfile: loadNutrProfile(),
    weightLog: loadWeightLog(),
    uiPrefs: loadUIPrefs(),
    mobility: exportMobility(getState(), now),
    version: 9,
    exported: now.toISOString(),
  };
}
