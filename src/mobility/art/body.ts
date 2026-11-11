import { Pt, Solved } from './pose';

// Body drawing. Turns solved joint positions into filled shapes: contoured
// limbs, a shaped torso, feet with a heel and sole, and a head with a jaw and
// hair. Every illustration is built from these same parts.

export interface Shape { d: string; fill: string }

export interface BodyColors {
  skin: string; skinFar: string; hair: string; top: string; topFar: string;
  bottom: string; bottomFar: string; bottomLow: string;
  hairStyle: 'short' | 'bun' | 'tail' | 'bob'; shorts: boolean; build: number;
}

const add = (p: Pt, v: Pt, k: number): Pt => ({ x: p.x + v.x * k, y: p.y + v.y * k });
const add2 = (p: Pt, a: Pt, ka: number, b: Pt, kb: number): Pt => ({ x: p.x + a.x * ka + b.x * kb, y: p.y + a.y * ka + b.y * kb });
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const unit = (a: Pt, b: Pt): Pt => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l }; };
const norm = (v: Pt): Pt => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };
const perp = (u: Pt): Pt => ({ x: -u.y, y: u.x });
const P = (p: Pt) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
const R = (n: number) => n.toFixed(1);

// A limb segment: round at both joints, narrowing from a to b, with an
// optional outward swell (thigh, calf, forearm).
function seg(a: Pt, b: Pt, ra: number, rb: number, fill: string, bulge = 0): Shape {
  const n = perp(unit(a, b));
  const m = lerp(a, b, 0.38), rm = ra + (rb - ra) * 0.38 + bulge * 2;
  const A1 = add(a, n, ra), B1 = add(b, n, rb), B2 = add(b, n, -rb), A2 = add(a, n, -ra);
  return {
    fill,
    d: `M${P(A1)}Q${P(add(m, n, rm))} ${P(B1)}A${R(rb)} ${R(rb)} 0 0 0 ${P(B2)}Q${P(add(m, n, -rm))} ${P(A2)}A${R(ra)} ${R(ra)} 0 0 0 ${P(A1)}Z`,
  };
}

function ellipse(c: Pt, u: Pt, rAcross: number, rAlong: number, fill: string): Shape {
  const p1 = add(c, u, -rAlong), p2 = add(c, u, rAlong);
  const rot = (Math.atan2(u.y, u.x) * 180) / Math.PI + 90;
  return { fill, d: `M${P(p1)}A${R(rAcross)} ${R(rAlong)} ${R(rot)} 1 0 ${P(p2)}A${R(rAcross)} ${R(rAlong)} ${R(rot)} 1 0 ${P(p1)}Z` };
}
const circle = (c: Pt, r: number, fill: string): Shape => ellipse(c, { x: 0, y: -1 }, r, r, fill);

// Smooth closed outline through a ring of points (Catmull-Rom).
function blob(pts: Pt[], fill: string): Shape {
  const n = pts.length;
  let d = `M${P(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += `C${P(c1)} ${P(c2)} ${P(p2)}`;
  }
  return { fill, d: d + 'Z' };
}

// Profile foot: heel behind the ankle, a flat sole and a rounded toe. The
// sole is the side facing away from the knee.
function foot(knee: Pt, ankle: Pt, toe: Pt, fill: string): Shape[] {
  const fd = unit(ankle, toe), shin = unit(knee, ankle);
  let sn = perp(fd);
  const dot = sn.x * shin.x + sn.y * shin.y;
  // A pointed foot continues the shin: there the sole is simply "underneath".
  if (Math.abs(dot) < 0.2) { if (sn.y < 0) sn = { x: -sn.x, y: -sn.y }; } else if (dot < 0) sn = { x: -sn.x, y: -sn.y };
  const pointed = Math.abs(dot) < 0.2;
  const heel = pointed ? 1.5 : 4.2;
  const pts = [
    add2(ankle, fd, -heel, sn, -2.2),          // back of the heel
    add2(ankle, fd, -heel - 0.4, sn, 3.4),     // under the heel
    add2(ankle, fd, 5, sn, 3.5),               // arch
    add2(toe, fd, 0.5, sn, 3.5),               // ball of the foot
    add2(toe, fd, 3, sn, 1.8),                 // toe tip
    add2(toe, fd, 0.5, sn, 0.2),               // top of the toes
    add2(ankle, fd, 4, sn, -2.6),              // instep
  ];
  return [circle(ankle, 3.6, fill), blob(pts, fill)];
}

export interface Parts { farArm: Shape[]; farLeg: Shape[]; torso: Shape[]; head: Shape[]; nearLeg: Shape[]; nearArm: Shape[] }

function leg(pts: Pt[], c: BodyColors, far: boolean, front: boolean): Shape[] {
  const [hip, knee, ankle, toe] = pts;
  const k = c.build;
  const skin = far ? c.skinFar : c.skin, cloth = far ? c.bottomFar : c.bottom, low = far ? c.bottomFar : c.bottomLow;
  const out: Shape[] = [];
  if (c.shorts) {
    out.push(seg(knee, ankle, 5.1 * k, 3.5, skin, 0.5), seg(hip, knee, 7.5 * k, 5.3 * k, skin, 0.3), seg(hip, lerp(hip, knee, 0.52), 8.1 * k, 7.1 * k, cloth));
  } else {
    out.push(seg(knee, ankle, 5.3 * k, 3.7, low, 0.5), seg(hip, knee, 7.8 * k, 5.5 * k, cloth, 0.3));
  }
  out.push(...(front ? [seg(ankle, toe, 3.7, 3.1, skin)] : foot(knee, ankle, toe, skin)));
  return out;
}

function arm(pts: Pt[], c: BodyColors, far: boolean): Shape[] {
  const [sh, elbow, wrist, hand] = pts;
  const k = c.build;
  const skin = far ? c.skinFar : c.skin;
  return [
    seg(sh, elbow, 4.7 * k, 3.8 * k, skin, 0.2),
    seg(sh, lerp(sh, elbow, 0.34), 5.4 * k, 4.9 * k, far ? c.topFar : c.top),
    seg(elbow, wrist, 3.8 * k, 2.8, skin, 0.3),
    seg(wrist, hand, 2.9, 3.5, skin),
  ];
}

// `side` is the direction the face points relative to the head axis:
// 1 or -1 in profile, 0 when the figure faces the viewer.
export function buildBody(s: Solved, c: BodyColors, side: number, bodySide: number): Parts {
  const k = c.build;
  const front = s.front;
  const u0 = unit(s.pelvis, s.mid), u1 = unit(s.mid, s.chest), um = norm({ x: u0.x + u1.x, y: u0.y + u1.y });
  const torso: Shape[] = [];

  if (front) {
    const a0 = perp(u0), a1 = perp(u1), am = perp(um);
    const waist = lerp(s.pelvis, s.mid, 0.42);
    torso.push(blob([
      add(s.pelvis, a0, -11 * k), add(s.mid, am, -9.6 * k), add2(s.chest, a1, -12.2 * k, u1, -3),
      add2(s.chest, a1, -16.4 * k, u1, 2.5), add2(s.chest, a1, -6 * k, u1, 7),
      add2(s.chest, a1, 6 * k, u1, 7), add2(s.chest, a1, 16.4 * k, u1, 2.5),
      add2(s.chest, a1, 12.2 * k, u1, -3), add(s.mid, am, 9.6 * k), add(s.pelvis, a0, 11 * k),
      add(s.pelvis, u0, -5),
    ], c.top));
    torso.push(blob([
      add(s.pelvis, a0, -11.3 * k), add(waist, a0, -10.2 * k), add(waist, a0, 10.2 * k), add(s.pelvis, a0, 11.3 * k),
      add2(s.pelvis, u0, -8.5, a0, 6), add2(s.pelvis, u0, -8.5, a0, -6),
    ], c.bottom));
    torso.push(circle(add(s.chest, u1, 7.2), 5.2, c.skin));
  } else {
    const fr = (u: Pt): Pt => ({ x: -u.y * bodySide, y: u.x * bodySide });
    const f0 = fr(u0), f1 = fr(u1), fm = fr(um);
    const waist = lerp(s.pelvis, s.mid, 0.42);
    torso.push(blob([
      add(s.pelvis, f0, -7.9 * k), add(s.mid, fm, -7.3 * k), add(s.chest, f1, -8.3 * k),
      add2(s.chest, u1, 6.2, f1, -4.5 * k), add2(s.chest, u1, 6.4, f1, 3.2 * k),
      add2(s.chest, f1, 9.2 * k, u1, -2.5), add(s.mid, fm, 8.1 * k), add(s.pelvis, f0, 8.2 * k),
      add(s.pelvis, u0, -6.5),
    ], c.top));
    torso.push(blob([
      add(s.pelvis, f0, -8.1 * k), add(waist, f0, -7.7 * k), add(waist, f0, 8.4 * k), add(s.pelvis, f0, 8.5 * k),
      add2(s.pelvis, u0, -7.8, f0, 3.5), add2(s.pelvis, u0, -7.8, f0, -3.5),
    ], c.bottom));
  }

  // Head
  const u = unit(s.neck, s.head);
  const hc = s.head;
  const head: Shape[] = [seg(add(s.chest, u, 1), hc, 4.3, 4, c.skin)];
  if (side !== 0) {
    const f: Pt = { x: -u.y * side, y: u.x * side };
    if (c.hairStyle === 'bun') head.push(circle(add2(hc, f, -9.8, u, 7.4), 4.9, c.hair));
    if (c.hairStyle === 'tail') {
      const root = add2(hc, f, -9.4, u, 5);
      head.push(seg(root, add2(root, { x: 0, y: 1 }, 13, f, -3.5), 3.7, 1.9, c.hair));
    }
    if (c.hairStyle === 'bob') head.push(ellipse(add2(hc, f, -5.6, u, -3.6), u, 6.6, 8.2, c.hair));
    head.push(ellipse(add2(hc, f, -2.5, u, 2.2), u, 11.1, 11.3, c.hair));
    head.push(ellipse(add2(hc, f, 0.9, u, -0.3), u, 9.4, 10.2, c.skin));
    head.push(circle(add2(hc, f, 3.3, u, -5.3), 5.6, c.skin));
    head.push(circle(add2(hc, f, 10.1, u, -1.3), 1.8, c.skin));
    head.push(ellipse(add2(hc, f, -1.8, u, 6), u, 9.3, 5.4, c.hair));
    head.push(circle(add2(hc, f, -2.6, u, -1.4), 2.2, c.skinFar));
  } else {
    const a = perp(u);
    if (c.hairStyle === 'bun' || c.hairStyle === 'tail') head.push(circle(add(hc, u, 12.4), 4.7, c.hair));
    head.push(ellipse(add(hc, u, 1.4), u, 11.5, 11.7, c.hair));
    if (c.hairStyle === 'bob') head.push(ellipse(add(hc, u, -3.5), u, 12.6, 8.6, c.hair));
    head.push(circle(add2(hc, a, 9.5, u, -1), 2.3, c.skinFar), circle(add2(hc, a, -9.5, u, -1), 2.3, c.skinFar));
    head.push(ellipse(add(hc, u, -0.8), u, 9.2, 10.3, c.skin));
    head.push(ellipse(add(hc, u, 6.4), u, 9.3, 5, c.hair));
  }

  return {
    farArm: arm(s.armF, c, !front), farLeg: leg(s.legF, c, !front, front),
    torso, head,
    nearLeg: leg(s.legN, c, false, front), nearArm: arm(s.armN, c, false),
  };
}
