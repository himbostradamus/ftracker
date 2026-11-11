// Parametric figure geometry. A pose is a small set of segment directions;
// the same solver feeds the catalog badges, the player illustration and the
// SVG export script, so an exercise looks the same wherever it appears.
//
// Angles are absolute screen directions in degrees:
//   0 = pointing right, 90 = pointing down, -90 = pointing up, 180 = left.
// The torso and head point from the pelvis outward; limbs point from the
// shoulder or hip outward.

export type Limb = [number, number] | [number, number, number];

export interface Pose {
  v?: 'side' | 'front';        // camera: profile (default) or facing the viewer
  t: number | [number, number]; // torso direction (or lower spine, upper spine)
  h?: number;                   // head direction; defaults to the upper spine
  aN: Limb;                     // near arm: upper arm, forearm[, hand]
  aF?: Limb;                    // far arm (defaults to the near arm)
  lN: Limb;                     // near leg: thigh, shin[, foot]
  lF?: Limb;                    // far leg (defaults to the near leg)
  props?: string[];             // mat | wall | wallL | chair | door | none
  rot?: number;                 // rotate the whole figure (degrees)
  face?: 1 | -1;                // profile facing: 1 = right (default), -1 = left
  fs?: Partial<Record<'aN' | 'aF' | 'lN' | 'lF', [number, number]>>; // foreshortening per limb segment
  ts?: number;                  // torso foreshortening (folded toward the viewer)
  look?: 1 | -1;                // front view only: head turned to one side
  zoom?: number;                // bust crop: scale factor, centred on the chest
  lift?: number;                // raise the figure off the ground (jumping)
  note?: 'L' | 'R';             // which limb is "near" when it matters
}

export interface Pt { x: number; y: number }

export const LEN = {
  torso: 44, neck: 7, head: 10.5, upperArm: 23, foreArm: 21, hand: 5,
  thigh: 31, shin: 30, foot: 11,
};

const rad = (d: number) => (d * Math.PI) / 180;
const step = (p: Pt, deg: number, len: number): Pt => ({
  x: p.x + Math.cos(rad(deg)) * len,
  y: p.y + Math.sin(rad(deg)) * len,
});

export interface Solved {
  pelvis: Pt; mid: Pt; chest: Pt; neck: Pt; head: Pt;
  hipN: Pt; hipF: Pt; shN: Pt; shF: Pt;
  armN: Pt[]; armF: Pt[]; legN: Pt[]; legF: Pt[];
  ground: number; minX: number; maxX: number; minY: number;
  front: boolean;
}

function limb(origin: Pt, l: Limb, a: number, b: number, c: number, defEnd: number, f: [number, number] = [1, 1]): Pt[] {
  const p1 = step(origin, l[0], a * f[0]);
  const p2 = step(p1, l[1], b * f[1]);
  const p3 = step(p2, l[2] ?? defEnd, c);
  return [origin, p1, p2, p3];
}

function rotatePt(p: Pt, deg: number): Pt {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

// Solve joint positions with the pelvis at the origin, then normalise so the
// lowest point rests on y = 0 and the figure is centred on x = 0.
export function solve(pose: Pose): Solved {
  const front = pose.v === 'front';
  const [t1, t2] = Array.isArray(pose.t) ? pose.t : [pose.t, pose.t];
  const pelvis: Pt = { x: 0, y: 0 };
  const tl = (LEN.torso / 2) * (pose.ts ?? 1);
  const mid = step(pelvis, t1, tl);
  const chest = step(mid, t2, tl);
  const hdir = pose.h ?? t2;
  const neck = step(chest, hdir, LEN.neck);
  const head = step(neck, hdir, LEN.head);

  // Shoulder and hip width only show when the figure faces the viewer.
  const across = (dir: number, w: number): Pt => ({
    x: Math.cos(rad(dir + 90)) * w, y: Math.sin(rad(dir + 90)) * w,
  });
  const sw = front ? 13 : 1.5;
  const hw = front ? 7 : 1;
  const so = across(t2, sw), ho = across(t1, hw);
  const shN = { x: chest.x + so.x, y: chest.y + so.y + (front ? 0 : 3) };
  const shF = { x: chest.x - so.x, y: chest.y - so.y + (front ? 0 : 3) };
  const hipN = { x: pelvis.x + ho.x, y: pelvis.y + ho.y };
  const hipF = { x: pelvis.x - ho.x, y: pelvis.y - ho.y };

  // An unspecified far limb copies the near one in profile and mirrors it
  // when the figure faces the viewer.
  const mirror = (l: Limb): Limb => (front ? (l.map(a => 180 - a) as Limb) : l);
  const aN = pose.aN, aF = pose.aF ?? mirror(pose.aN);
  const lN = pose.lN, lF = pose.lF ?? mirror(pose.lN);
  let armN = limb(shN, aN, LEN.upperArm, LEN.foreArm, LEN.hand, aN[1], pose.fs?.aN);
  let armF = limb(shF, aF, LEN.upperArm, LEN.foreArm, LEN.hand, aF[1], pose.fs?.aF ?? (pose.aF ? undefined : pose.fs?.aN));
  // Feet default to pointing forward (profile) or down-and-out (front view).
  // Profile: toes point toward the front of the body, except when the shin
  // trails backward along the floor (kneeling, prone), where the foot points.
  const footDef = (shin: number) => {
    if (front) return 90;
    const d = ((shin + 540) % 360) - 180;
    return Math.abs(d) > 145 ? shin : shin - 90;
  };
  let legN = limb(hipN, lN, LEN.thigh, LEN.shin, LEN.foot, footDef(lN[1]), pose.fs?.lN);
  let legF = limb(hipF, lF, LEN.thigh, LEN.shin, LEN.foot, footDef(lF[1]), pose.fs?.lF ?? (pose.lF ? undefined : pose.fs?.lN));

  let all: Record<string, Pt | Pt[]> = { pelvis, mid, chest, neck, head, hipN, hipF, shN, shF, armN, armF, legN, legF };
  const map = (f: (p: Pt) => Pt) => {
    const out: Record<string, Pt | Pt[]> = {};
    for (const k of Object.keys(all)) {
      const v = all[k];
      out[k] = Array.isArray(v) ? v.map(f) : f(v);
    }
    all = out;
  };
  if (pose.face === -1) map(p => ({ x: -p.x, y: p.y }));
  if (pose.rot) map(p => rotatePt(p, pose.rot!));

  const pts: { p: Pt; r: number }[] = [];
  const add = (p: Pt, r: number) => pts.push({ p, r });
  for (const k of ['armN', 'armF'] as const) (all[k] as Pt[]).forEach(p => add(p, 4));
  for (const k of ['legN', 'legF'] as const) (all[k] as Pt[]).forEach((p, i) => add(p, i === 3 ? 3.5 : 5.5));
  add(all.pelvis as Pt, 9); add(all.chest as Pt, 9); add(all.head as Pt, LEN.head);

  const maxY = Math.max(...pts.map(q => q.p.y + q.r));
  const minY0 = Math.min(...pts.map(q => q.p.y - q.r));
  const minX0 = Math.min(...pts.map(q => q.p.x - q.r));
  const maxX0 = Math.max(...pts.map(q => q.p.x + q.r));
  const cx = (minX0 + maxX0) / 2;
  const lift = pose.lift ?? 0;
  map(p => ({ x: p.x - cx, y: p.y - maxY - lift }));

  return {
    ...(all as unknown as Omit<Solved, 'ground' | 'minX' | 'maxX' | 'minY' | 'front'>),
    ground: 0, minX: minX0 - cx, maxX: maxX0 - cx, minY: minY0 - maxY - lift, front,
  };
}
