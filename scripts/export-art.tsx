// Writes every illustration as a standalone SVG plus a manifest mapping each
// exercise id to its file, body variant and provenance.
// Usage: npx vite-node scripts/export-art.tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mkdirSync, writeFileSync } from 'node:fs';
import { EXERCISES } from '../src/mobility/data/catalog';
import { POSES } from '../src/mobility/data/poses';
import { Figure, variantFor } from '../src/mobility/art/Figure';

const dir = 'assets-src/illustrations';
mkdirSync(dir, { recursive: true });
const manifest = EXERCISES.map(e => {
  const v = variantFor(e.id);
  writeFileSync(`${dir}/${e.id}.svg`, renderToStaticMarkup(<Figure pose={POSES[e.id]} seed={e.id} size={400} title={e.alt} />) + '\n');
  return {
    id: e.id, name: e.name, file: `illustrations/${e.id}.svg`, status: 'drawn',
    view: POSES[e.id].v ?? 'side', crop: POSES[e.id].zoom ? 'bust' : 'full',
    variant: { skin: v.skin, hair: v.hair, hairStyle: v.hairStyle, top: v.top, bottom: v.bottom, shorts: v.shorts, build: v.build },
    alt: e.alt,
    provenance: 'Original. Generated from the pose in src/mobility/data/poses.ts by src/mobility/art/Figure.tsx.',
    demonstration: e.demo.status === 'none' ? 'none (no video exists yet)' : e.demo.path,
  };
});
writeFileSync('assets-src/illustration-manifest.json', JSON.stringify({ count: manifest.length, source: 'src/mobility/data/poses.ts', entries: manifest }, null, 2) + '\n');
console.log('wrote', manifest.length, 'illustrations');
