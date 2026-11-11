// Parametric figure geometry. A pose is a small set of segment directions;
// the same solver feeds the catalog badges, the player illustration and the
// SVG export script, so an exercise looks the same wherever it appears.
//
// Angles are absolute screen directions in degrees:
//   0 = pointing right, 90 = pointing down, -90 = pointing up, 180 = left.
// The torso and head point from the pelvis outward; limbs point from the
// shoulder or hip outward.

export type Limb = [number, number] | [number, number, number];

// A limb placed by where its hand or foot ends up, instead of by angles: the
// elbow or knee is solved. `to` is a named body point, 'floor', or a
// position relative to the pelvis (figure facing right).
export type Anchor =
  | 'floor' | 'head' | 'chest' | 'pelvis' | 'hipN' | 'hipF' | 'shN' | 'shF'
  | 'kneeN' | 'ankleN' | 'toeN' | 'kneeF' | 'ankleF' | 'toeF' | 'elbowN' | 'handN';
export interface Reach {
  to: Anchor | [number, number];
  off?: [number, number];       // offset from the anchor; for 'floor', off[0] is the distance ahead of the shoulder or hip
  bend?: 1 | -1;                // which way the elbow or knee points
  end?: number;                 // hand or foot direction (degrees)
}
export type LimbSpec = Limb | Reach;
const isReach = (l: LimbSpec): l is Reach => !Array.isArray(l);

export type PartName = 'aF' | 'lF' | 'torso' | 'head' | 'lN' | 'aN';
export interface Arrow {
  at: Anchor | [number, number];
  off?: [number, number];
  dir: number;                  // direction of travel, degrees
  len?: number;
  bend?: number;                // sideways bow of the arrow; 0 = straight
  both?: boolean;               // arrowhead at both ends (back-and-forth movement)
}

export interface Pose {
  v?: 'side' | 'front';        // camera: profile (default) or facing the viewer
  t: number | [number, number]; // torso direction (or lower spine, upper spine)
  h?: number;                   // head direction; defaults to the upper spine
  aN: LimbSpec;                 // near arm: upper arm, forearm[, hand], or a reach
  aF?: LimbSpec;                    // far arm (defaults to the near arm)
  lN: LimbSpec;                 // near leg: thigh, shin[, foot], or a reach
  lF?: LimbSpec;                    // far leg (defaults to the near leg)
  props?: string[];             // mat | wall | wallL | chair | door | none
  rot?: number;                 // rotate the whole figure (degrees)
  face?: 1 | -1;                // profile facing: 1 = right (default), -1 = left
  fs?: Partial<Record<'aN' | 'aF' | 'lN' | 'lF', [number, number]>>; // foreshortening per limb segment
  ts?: number;                  // torso foreshortening (folded toward the viewer)
  look?: 1 | -1;                // front view only: head turned to one side
  zoom?: number;                // bust crop: scale factor, centred on the chest
  lift?: number;                // raise the figure off the ground (jumping)
  order?: PartName[];           // back-to-front drawing order, when the default hides something
  arrows?: Arrow[];             // movement arrows for dynamic exercises
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
  arrows: Pt[][];               // [start, control, end] per arrow
  arrowBoth: boolean[];
}

function limb(origin: Pt, l: Limb, a: number, b: number, c: number, defEnd: number, f: [number, number] = [1, 1]): Pt[] {
  const p1 = step(origin, l[0], a * f[0]);
  const p2 = step(p1, l[1], b * f[1]);
  const p3 = step(p2, l[2] ?? defEnd, c);
  return [origin, p1, p2, p3];
}

// Two-segment reach: place the middle joint so the limb ends at the target
// (or points straight at it when it is out of range).
function reachLimb(origin: Pt, target: Pt, a: number, b: number, c: number, bend: number, end?: number): Pt[] {
  const dx = target.x - origin.x, dy = target.y - origin.y;
  const d = Math.min(a + b - 0.05, Math.max(Math.abs(a - b) + 0.05, Math.hypot(dx, dy)));
  const base = Math.atan2(dy, dx);
  const inner = Math.acos(Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d))));
  const mid = { x: origin.x + Math.cos(base + bend * inner) * a, y: origin.y + Math.sin(base + bend * inner) * a };
  const tip = { x: origin.x + Math.cos(base) * d, y: origin.y + Math.sin(base) * d };
  const fore = Math.atan2(tip.y - mid.y, tip.x - mid.x);
  const dir = end === undefined ? fore : rad(end);
  return [origin, mid, tip, { x: tip.x + Math.cos(dir) * c, y: tip.y + Math.sin(dir) * c }];
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
  const swap = (n: string) => (n.endsWith('N') ? n.slice(0, -1) + 'F' : n.endsWith('F') ? n.slice(0, -1) + 'N' : n);
  const mirror = (l: LimbSpec): LimbSpec => {
    if (!front) return l;
    if (!isReach(l)) return l.map(a => 180 - a) as Limb;
    return {
      ...l, bend: l.bend ? (-l.bend as 1 | -1) : l.bend,
      to: Array.isArray(l.to) ? [-l.to[0], l.to[1]] : (swap(l.to) as Anchor),
      off: l.off ? [-l.off[0], l.off[1]] : l.off,
      end: l.end === undefined ? undefined : 180 - l.end,
    };
  };
  const aN = pose.aN, aF = pose.aF ?? mirror(pose.aN);
  const lN = pose.lN, lF = pose.lF ?? mirror(pose.lN);
  // Feet default to pointing forward (profile) or down-and-out (front view).
  // Profile: toes point toward the front of the body, except when the shin
  // trails backward along the floor (kneeling, prone), where the foot points.
  const footDef = (shin: number, out = 0) => {
    if (front) return 90 - out * 32;
    const d = ((shin + 540) % 360) - 180;
    return Math.abs(d) > 145 ? shin : shin - 90;
  };
  const footLen = LEN.foot * (front ? 0.75 : 1);
  const named: Record<string, Pt> = { head, chest, pelvis, hipN, hipF, shN, shF };
  let floorY = 9;
  const target = (r: Reach, origin: Pt): Pt => {
    const off = r.off ?? [0, 0];
    if (Array.isArray(r.to)) return { x: r.to[0] + off[0], y: r.to[1] + off[1] };
    if (r.to === 'floor') return { x: origin.x + off[0], y: floorY - 3.4 + off[1] };
    const p = named[r.to] ?? pelvis;
    return { x: p.x + off[0], y: p.y + off[1] };
  };
  const leg = (hip: Pt, l: LimbSpec, out: number, f?: [number, number]): Pt[] => {
    if (!isReach(l)) return limb(hip, l, LEN.thigh, LEN.shin, footLen, footDef(l[1], out), f);
    const t = target(l, hip);
    const pts = reachLimb(hip, t, LEN.thigh * (f?.[0] ?? 1), LEN.shin * (f?.[1] ?? 1), footLen, l.bend ?? -1, l.end);
    if (l.end === undefined) {
      const shin = (Math.atan2(pts[2].y - pts[1].y, pts[2].x - pts[1].x) * 180) / Math.PI;
      pts[3] = step(pts[2], footDef(shin, out), footLen);
    }
    return pts;
  };
  let legN = leg(hipN, lN, 1, pose.fs?.lN);
  let legF = leg(hipF, lF, -1, pose.fs?.lF ?? (pose.lF ? undefined : pose.fs?.lN));
  Object.assign(named, { kneeN: legN[1], ankleN: legN[2], toeN: legN[3], kneeF: legF[1], ankleF: legF[2], toeF: legF[3] });
  // The floor is wherever the lowest part of the lower body rests.
  floorY = Math.max(pelvis.y + 8.5, ...[...legN, ...legF].map((p, i) => p.y + (i % 4 === 0 ? 8 : i % 4 === 3 ? 3.4 : 5)));
  const arm = (sh: Pt, l: LimbSpec, f?: [number, number]): Pt[] =>
    isReach(l)
      ? reachLimb(sh, target(l, sh), LEN.upperArm * (f?.[0] ?? 1), LEN.foreArm * (f?.[1] ?? 1), LEN.hand, l.bend ?? 1, l.end)
      : limb(sh, l, LEN.upperArm, LEN.foreArm, LEN.hand, l[1], f);
  let armN = arm(shN, aN, pose.fs?.aN);
  Object.assign(named, { elbowN: armN[1], handN: armN[2] });
  let armF = arm(shF, aF, pose.fs?.aF ?? (pose.aF ? undefined : pose.fs?.aN));

  const arrowPts: Pt[][] = (pose.arrows ?? []).map(a => {
    const start = target({ to: a.at, off: a.off }, pelvis);
    const len = a.len ?? 22;
    const end = step(start, a.dir, len);
    const ctrl = step({ x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }, a.dir + 90, a.bend ?? 0);
    return [start, ctrl, end];
  });

  let all: Record<string, Pt | Pt[]> = { pelvis, mid, chest, neck, head, hipN, hipF, shN, shF, armN, armF, legN, legF, arrowFlat: arrowPts.flat() };
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
  (all.arrowFlat as Pt[]).forEach(p => add(p, 5));

  const maxY = Math.max(...pts.map(q => q.p.y + q.r));
  const minY0 = Math.min(...pts.map(q => q.p.y - q.r));
  const minX0 = Math.min(...pts.map(q => q.p.x - q.r));
  const maxX0 = Math.max(...pts.map(q => q.p.x + q.r));
  const cx = (minX0 + maxX0) / 2;
  const lift = pose.lift ?? 0;
  map(p => ({ x: p.x - cx, y: p.y - maxY - lift }));

  const flat = all.arrowFlat as Pt[];
  return {
    ...(all as unknown as Omit<Solved, 'ground' | 'minX' | 'maxX' | 'minY' | 'front' | 'arrows' | 'arrowBoth'>),
    ground: 0, minX: minX0 - cx, maxX: maxX0 - cx, minY: minY0 - maxY - lift, front,
    arrows: arrowPts.map((_, i) => flat.slice(i * 3, i * 3 + 3)),
    arrowBoth: (pose.arrows ?? []).map(a => !!a.both),
  };
}
