// Lists poses where no part of the legs or hips touches the ground, or where
// the hips hover while seated or lying: usually a sign the figure is floating.
import { POSES } from '../src/mobility/data/poses';
import { solve } from '../src/mobility/art/pose';
for (const id of Object.keys(POSES)) {
  const s = solve(POSES[id]);
  const r = [8, 5.5, 5.5, 3.5];
  const legLow = Math.max(...[s.legN, s.legF].flatMap(l => l.map((p, i) => p.y + r[i])), s.pelvis.y + 9);
  const armLow = Math.max(...[s.armN, s.armF].flatMap(l => l.map(p => p.y + 4)), s.head.y + 10.5);
  const gap = -legLow - (POSES[id].lift ?? 0);
  const hip = -(s.pelvis.y + 9);
  if (gap <= 2.5 && hip > 2 && hip < 9) console.log(id.padEnd(28), 'hips hover', hip.toFixed(1), 'above ground');
  const low = (l: typeof s.legN) => Math.max(...l.map((p, i) => p.y + r[i]));
  const diff = Math.abs(low(s.legN) - low(s.legF));
  if (diff > 3) console.log(id.padEnd(28), 'one leg ends', diff.toFixed(1), 'above the other (fine for a lifted leg)');
  if (gap > 2.5) console.log(id.padEnd(28), 'legs/hips', gap.toFixed(1), 'above ground; lowest is arms/head at', (-armLow).toFixed(1));
}
