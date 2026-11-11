import React from 'react';
import { Pose, Pt, solve, LEN } from './pose';

// Flat, solid-fill figure drawn from a solved pose. Colours come from a small
// set of body variants so the catalog shows a range of skin tones and hair
// while every illustration keeps the same construction.

export interface Variant {
  skin: string; skinFar: string; hair: string; top: string; topFar: string; bottom: string;
  bottomFar: string; hairStyle: 'short' | 'bun' | 'tail'; shorts: boolean; build: number;
}

const SKINS: [string, string][] = [
  ['#F1C9A5', '#DDB08A'], ['#E0A97E', '#C99368'], ['#C68B5E', '#AE774D'],
  ['#9A623F', '#855234'], ['#6E4530', '#5C3927'],
];
const HAIRS = ['#2B2420', '#4A3327', '#7A4B2A', '#B9853F', '#8E8E89'];
const TOPS: [string, string][] = [['#217E73', '#1B6A61'], ['#C66D4E', '#AD5C40'], ['#D9AE48', '#C29A3C'], ['#83A58D', '#70907A'], ['#5B7FA6', '#4C6D91'], ['#D8A8B5', '#C2919F']];
const BOTTOMS: [string, string][] = [
  ['#2F3B45', '#252F37'], ['#4B5D52', '#3D4C43'], ['#5A4A63', '#493C51'], ['#3A4E6B', '#2F4058'],
];
export const BADGE_BG = ['#DDE9E0', '#F3E3C3', '#F0D5CB', '#F1DCE2', '#D9E8EE', '#E3E6D8'];

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function variantFor(seed: string): Variant {
  const h = hash(seed);
  const skin = SKINS[h % SKINS.length];
  const bottom = BOTTOMS[(h >>> 9) % BOTTOMS.length];
  return {
    skin: skin[0], skinFar: skin[1],
    hair: HAIRS[(h >>> 3) % HAIRS.length],
    top: TOPS[(h >>> 6) % TOPS.length][0], topFar: TOPS[(h >>> 6) % TOPS.length][1],
    bottom: bottom[0], bottomFar: bottom[1],
    hairStyle: (['short', 'bun', 'tail'] as const)[(h >>> 12) % 3],
    shorts: ((h >>> 15) & 1) === 1,
    build: [0.94, 1, 1.07, 1.15][(h >>> 17) % 4],
  };
}

export const bgFor = (seed: string) => BADGE_BG[(hash(seed) >>> 20) % BADGE_BG.length];

const line = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
const unit = (a: Pt, b: Pt): Pt => {
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
};

// A limb segment that narrows from one joint to the next: two circles joined
// by their outer edges.
function Taper({ a, b, ra, rb, fill }: { a: Pt; b: Pt; ra: number; rb: number; fill: string }) {
  const u = unit(a, b);
  const n = { x: -u.y, y: u.x };
  const d = `M${(a.x + n.x * ra).toFixed(1)} ${(a.y + n.y * ra).toFixed(1)} L${(b.x + n.x * rb).toFixed(1)} ${(b.y + n.y * rb).toFixed(1)} L${(b.x - n.x * rb).toFixed(1)} ${(b.y - n.y * rb).toFixed(1)} L${(a.x - n.x * ra).toFixed(1)} ${(a.y - n.y * ra).toFixed(1)}Z`;
  return (
    <g fill={fill}>
      <path d={d} /><circle cx={a.x} cy={a.y} r={ra} /><circle cx={b.x} cy={b.y} r={rb} />
    </g>
  );
}
const between = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

function Leg({ pts, v, far }: { pts: Pt[]; v: Variant; far?: boolean }) {
  const cloth = far ? v.bottomFar : v.bottom;
  const skin = far ? v.skinFar : v.skin;
  const k = v.build;
  const [hip, knee, ankle, toe] = pts;
  return (
    <g>
      {v.shorts ? (
        <>
          <Taper a={knee} b={ankle} ra={5 * k} rb={3.5 * k} fill={skin} />
          <Taper a={hip} b={knee} ra={7.4 * k} rb={5.4 * k} fill={skin} />
          <Taper a={hip} b={between(hip, knee, 0.5)} ra={8 * k} rb={7 * k} fill={cloth} />
        </>
      ) : (
        <>
          <Taper a={knee} b={ankle} ra={5.2 * k} rb={3.7 * k} fill={cloth} />
          <Taper a={hip} b={knee} ra={7.8 * k} rb={5.6 * k} fill={cloth} />
        </>
      )}
      <Taper a={ankle} b={toe} ra={3.9} rb={2.9} fill={skin} />
    </g>
  );
}

function Arm({ pts, v, far }: { pts: Pt[]; v: Variant; far?: boolean }) {
  const skin = far ? v.skinFar : v.skin;
  const k = v.build;
  const [sh, elbow, wrist, hand] = pts;
  return (
    <g>
      <Taper a={sh} b={elbow} ra={4.7 * k} rb={3.7 * k} fill={skin} />
      <Taper a={sh} b={between(sh, elbow, 0.3)} ra={5.2 * k} rb={4.6 * k} fill={far ? v.topFar : v.top} />
      <Taper a={elbow} b={wrist} ra={3.7 * k} rb={2.8} fill={skin} />
      <Taper a={wrist} b={hand} ra={3} rb={3.3} fill={skin} />
    </g>
  );
}

function Props({ names, s }: { names: string[]; s: ReturnType<typeof solve> }) {
  const out: React.ReactNode[] = [];
  const w = s.maxX - s.minX;
  for (const n of names) {
    if (n === 'mat') out.push(<rect key={n} x={s.minX - 10} y={-0.5} width={w + 20} height={4.5} rx={2.2} fill="#B9CCBF" />);
    if (n === 'wall') out.push(<rect key={n} x={s.maxX - 0.5} y={-176} width={9} height={178} rx={2} fill="#C9CDC6" />);
    if (n === 'wallL') out.push(<rect key={n} x={s.minX - 8.5} y={-176} width={9} height={178} rx={2} fill="#C9CDC6" />);
    if (n === 'door') out.push(<rect key={n} x={s.maxX - 1} y={-176} width={6} height={178} rx={2} fill="#B8A58A" />);
    if (n === 'chair') {
      const x = s.pelvis.x, y = s.pelvis.y + 10 ;
      out.push(
        <g key={n} fill="#B8A58A">
          <rect x={x - 22} y={y} width={40} height={5} rx={2} />
          <rect x={x - 21} y={y} width={4} height={-y} />
          <rect x={x + 13} y={y} width={4} height={-y} />
          <rect x={x - 22} y={y - 42} width={4} height={44} rx={2} />
        </g>,
      );
    }
    if (n === 'panel') out.push(<rect key={n} x={s.minX - 6} y={-170} width={w + 12} height={170} rx={4} fill="#D5D8D1" opacity={0.75} />);
    if (n === 'benchE' || n === 'benchH') {
      const p = n === 'benchE' ? s.armN[1] : s.armN[3];
      const y = p.y + 4;
      out.push(
        <g key={n} fill="#B8A58A">
          <rect x={p.x - 16} y={y} width={36} height={5} rx={2} />
          <rect x={p.x - 13} y={y} width={4} height={-y} />
          <rect x={p.x + 13} y={y} width={4} height={-y} />
        </g>,
      );
    }
    if (n === 'stool') {
      const x = s.pelvis.x, y = s.pelvis.y + 10;
      out.push(
        <g key={n} fill="#B8A58A">
          <rect x={x - 20} y={y} width={40} height={5} rx={2} />
          <rect x={x - 18} y={y} width={4} height={-y} />
          <rect x={x + 14} y={y} width={4} height={-y} />
        </g>,
      );
    }
  }
  return <>{out}</>;
}

export interface FigureProps {
  pose: Pose;
  seed: string;
  size?: number | string;
  badge?: boolean;         // circular coloured background, for catalog use
  title?: string;          // alternative text
  className?: string;
}

export function Figure({ pose, seed, size = 96, badge = true, title, className }: FigureProps) {
  const s = solve(pose);
  const v = variantFor(seed);
  const names = pose.props ?? ['mat'];
  const figW = s.maxX - s.minX + (names.some(n => n.startsWith('wall') || n === 'door') ? 18 : 0);
  const figH = -s.minY;
  // The figure is drawn at a constant scale unless it would not fit the frame.
  const zoom = pose.zoom;
  const k = zoom ?? Math.min(1.22, 156 / figH, 172 / figW);
  const clipId = `c${hash(seed + (badge ? 'b' : 'p')).toString(36)}`;
  // A zoomed pose is a bust crop centred on the chest (neck and wrist work).
  const tx = zoom ? 100 - s.chest.x * k : 100;
  const ty = zoom ? 128 - s.chest.y * k : badge ? 174 : 182;
  const u = unit(s.neck, s.head);
  const flip = pose.face === -1 ? -1 : 1;
  const side = s.front ? pose.look ?? 0 : flip;
  const profile = side !== 0;
  const f: Pt = { x: -u.y * side, y: u.x * side };
  const hairC = { x: s.head.x - f.x * 3.2 + u.x * 2.6, y: s.head.y - f.y * 3.2 + u.y * 2.6 };
  const knot = { x: s.head.x - f.x * 11 + u.x * (profile ? 5 : 11), y: s.head.y - f.y * 11 + u.y * (profile ? 5 : 11) };
  const k2 = v.build;
  // Torso: wider at the chest than the waist; shoulders and hips only show
  // their width when the figure faces the viewer.
  const torso = s.front ? (
    <g>
      <Taper a={s.hipF} b={s.hipN} ra={8.2 * k2} rb={8.2 * k2} fill={v.bottom} />
      <Taper a={between(s.pelvis, s.mid, 0.25)} b={s.mid} ra={11.5 * k2} rb={10.5 * k2} fill={v.top} />
      <Taper a={s.mid} b={between(s.mid, s.chest, 0.8)} ra={10.5 * k2} rb={11.5 * k2} fill={v.top} />
      <Taper a={s.shF} b={s.shN} ra={5.4 * k2} rb={5.4 * k2} fill={v.top} />
    </g>
  ) : (
    <g>
      <Taper a={s.pelvis} b={between(s.pelvis, s.mid, 0.3)} ra={8.6 * k2} rb={8.2 * k2} fill={v.bottom} />
      <Taper a={between(s.pelvis, s.mid, 0.3)} b={s.mid} ra={8.2 * k2} rb={8 * k2} fill={v.top} />
      <Taper a={s.mid} b={s.chest} ra={8 * k2} rb={9.2 * k2} fill={v.top} />
    </g>
  );
  const head = (
    <g>
      <Taper a={s.chest} b={s.head} ra={3.6} rb={3.4} fill={v.skin} />
      {v.hairStyle !== 'short' && <circle cx={knot.x} cy={knot.y} r={v.hairStyle === 'bun' ? 4.6 : 3.6} fill={v.hair} />}
      {v.hairStyle === 'tail' && profile && (
        <path d={line([knot, { x: knot.x - f.x * 5 - u.x * 9, y: knot.y - f.y * 5 - u.y * 9 }])} stroke={v.hair} strokeWidth={5} strokeLinecap="round" />
      )}
      <circle cx={hairC.x} cy={hairC.y} r={LEN.head + 0.4} fill={v.hair} />
      <circle cx={s.head.x + f.x * 0.8 - u.x * 0.6} cy={s.head.y + f.y * 0.8 - u.y * 0.6} r={LEN.head - 0.8} fill={v.skin} />
      {profile && <circle cx={s.head.x + f.x * 9.8 - u.x * 1.5} cy={s.head.y + f.y * 9.8 - u.y * 1.5} r={1.9} fill={v.skin} />}
    </g>
  );

  return (
    <svg
      viewBox="0 0 200 200" width={size} height={size} className={className}
      role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg"
    >
      {title && <title>{title}</title>}
      {badge && <circle cx="100" cy="100" r="100" fill={bgFor(seed)} />}
      <clipPath id={clipId}>{badge ? <circle cx="100" cy="100" r="100" /> : <rect width="200" height="200" />}</clipPath>
      <g clipPath={`url(#${clipId})`}><g transform={`translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${k.toFixed(3)})`}>
        {!names.includes('mat') && <ellipse cx={(s.minX + s.maxX) / 2} cy={1.5} rx={Math.max(16, (s.maxX - s.minX) / 2)} ry={3} fill="#20211F" opacity={0.08} />}
        <Props names={names} s={s} />
        {s.front ? (
          <>
            <Leg pts={s.legF} v={v} /><Leg pts={s.legN} v={v} />
            {torso}
            <Arm pts={s.armF} v={v} /><Arm pts={s.armN} v={v} />
            {head}
          </>
        ) : (
          <>
            <Arm pts={s.armF} v={v} far /><Leg pts={s.legF} v={v} far />
            {torso}{head}
            <Leg pts={s.legN} v={v} /><Arm pts={s.armN} v={v} />
          </>
        )}
      </g></g>
    </svg>
  );
}
