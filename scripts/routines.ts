import { ROUTINES } from '../src/mobility/data/routines';
import { EX } from '../src/mobility/data/catalog';
import { routineTotals, DEFAULT_TIMING } from '../src/mobility/lib/timeline';
const rank = { beginner: 0, intermediate: 1, advanced: 2 } as const;
console.log(ROUTINES.length, 'routines');
for (const r of ROUTINES) {
  const bad = r.items.filter(i => rank[EX[i.ex].difficulty] > rank[r.difficulty]).map(i => i.ex);
  const m = (routineTotals(r, DEFAULT_TIMING).total / 60).toFixed(1);
  if (bad.length || process.argv[2] === 'all') console.log(m.padStart(5), r.difficulty.slice(0, 3), r.id, bad.join(','));
}
const used = new Set(ROUTINES.flatMap(r => r.items.map(i => i.ex)));
console.log('unused exercises:', Object.keys(EX).filter(id => !used.has(id)).join(' '));
