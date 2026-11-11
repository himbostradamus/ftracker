// Builds the app icon from the same figure system as the illustrations.
// Usage: npx vite-node scripts/icon.tsx   (then the PNG sizes via ImageMagick)
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync } from 'node:fs';
import { Figure } from '../src/mobility/art/Figure';
import { Pose } from '../src/mobility/art/pose';

const pose: Pose = { v: 'front', t: [-90, -66], h: -62, aF: [-74, -44], aN: [58, 150], lN: [84, 88], props: ['none'] };
const fig = renderToStaticMarkup(<Figure pose={pose} seed="icon-7" size={200} badge={false} />)
  .replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').replace(/<title>.*?<\/title>/, '').replace(/<ellipse[^>]*\/>/, '');
const svg = (pad: number) => {
  const k = 2.45 - pad / 60;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#217E73"/>
  <circle cx="256" cy="256" r="${214 - pad}" fill="#F6ECD6"/>
  <g transform="translate(${256 - 102 * k} ${268 - 118 * k}) scale(${k})">${fig}</g>
</svg>
`;
};
writeFileSync('assets-src/icon.svg', svg(0));
writeFileSync('assets-src/icon-maskable.svg', svg(40));
console.log('icon written');
