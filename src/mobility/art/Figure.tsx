import React from 'react';
import { Pose, solve } from './pose';
import { BodyColors, buildBody, Shape } from './body';

// Flat, solid-fill figure drawn from a solved pose. Colours come from a small
// set of body variants so the catalog shows a range of skin tones and hair
// while every illustration keeps the same construction.

export type Variant = BodyColors;

const SKINS: [string, string][] = [
  ['#F1C9A5', '#DDB08A'], ['#E0A97E', '#C99368'], ['#C68B5E', '#AE774D'],
  ['#9A623F', '#855234'], ['#6E4530', '#5C3927'],
];
const HAIRS = ['#2B2420', '#4A3327', '#7A4B2A', '#B9853F', '#8E8E89'];
const TOPS: [string, string][] = [['#217E73', '#1B6A61'], ['#C66D4E', '#AD5C40'], ['#D9AE48', '#C29A3C'], ['#83A58D', '#70907A'], ['#5B7FA6', '#4C6D91'], ['#D8A8B5', '#C2919F']];
// near thigh, far leg, near lower leg (a shade apart so a folded leg reads as two parts)
const BOTTOMS: [string, string, string][] = [
  ['#34424D', '#222B33', '#2B3740'], ['#52665A', '#3A4840', '#465A4E'], ['#62516C', '#44384C', '#55465E'], ['#405674', '#2C3B52', '#364A66'],
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
    bottom: bottom[0], bottomFar: bottom[1], bottomLow: bottom[2],
    hairStyle: (['short', 'bun', 'tail', 'bob'] as const)[(h >>> 12) % 4],
    shorts: ((h >>> 15) & 1) === 1,
    build: [0.94, 1, 1.07, 1.15][(h >>> 17) % 4],
  };
}

export const bgFor = (seed: string) => BADGE_BG[(hash(seed) >>> 20) % BADGE_BG.length];

// One body part: a soft edge around its whole silhouette (so an arm stays
// readable against a leg of the same colour), then the flat fills.
function Part({ shapes, edge = true }: { shapes: Shape[]; edge?: boolean }) {
  return (
    <g>
      {edge && <path d={shapes.map(x => x.d).join('')} fill="#1E1F1D" stroke="#1E1F1D" strokeWidth={1.9} strokeLinejoin="round" opacity={0.2} />}
      {shapes.map((x, i) => <path key={i} d={x.d} fill={x.fill} />)}
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
  // Scale to fill the frame. In a badge the bounding box has to sit inside
  // the circle, so wide, low figures are centred rather than cut off.
  const k = zoom ?? (badge
    ? Math.min(1.5, 160 / figH, 172 / figW, 212 / Math.hypot(figW, figH))
    : Math.min(1.6, 178 / figH, 186 / figW));
  const clipId = `c${hash(seed + (badge ? 'b' : 'p')).toString(36)}`;
  // A zoomed pose is a bust crop centred on the chest (neck and wrist work).
  // ...shifted toward an outstretched hand so wrist work stays in frame.
  const reach = s.armN[3].x - s.chest.x;
  const tx = zoom ? 100 - (s.chest.x + (Math.abs(reach) > 25 ? reach * 0.45 : 0)) * k : 100;
  const ty = zoom ? 100 + zoom * 15 - s.chest.y * k : Math.min(badge ? 180 : 190, 100 + (figH * k) / 2 + 2);
  const flip = pose.face === -1 ? -1 : 1;
  const side = s.front ? pose.look ?? 0 : flip;
  const body = buildBody(s, v, side, flip);

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
            <Part shapes={body.farLeg} /><Part shapes={body.nearLeg} />
            <Part shapes={body.torso} />
            <Part shapes={body.farArm} /><Part shapes={body.nearArm} />
            <Part shapes={body.head} />
          </>
        ) : (
          <>
            <Part shapes={body.farArm} edge={false} /><Part shapes={body.farLeg} edge={false} />
            <Part shapes={body.torso} /><Part shapes={body.head} />
            <Part shapes={body.nearLeg} /><Part shapes={body.nearArm} />
          </>
        )}
      </g></g>
    </svg>
  );
}
