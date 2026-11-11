// Renders a contact sheet of illustrations for visual review.
// Usage: npx vite-node scripts/sheet.tsx [filter] [size]
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync } from 'node:fs';
import { POSES } from '../src/mobility/data/poses';
import { Figure } from '../src/mobility/art/Figure';

const filter = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : null;
const size = Number(process.argv[3] ?? 150);
const from = Number(process.argv[4] ?? 0), count = Number(process.argv[5] ?? 9999);
let ids = Object.keys(POSES);
if (filter) ids = ids.filter(id => filter.some(f => id.includes(f)));
ids = ids.slice(from, from + count);
const cells = ids.map(id => (
  `<div style="width:${size}px;text-align:center;font:11px sans-serif;margin:3px">` +
  renderToStaticMarkup(<Figure pose={POSES[id]} seed={id} size={size} />) +
  `<div>${id}</div></div>`
)).join('');
const out = process.env.SHEET_OUT ?? "sheet.html";
writeFileSync(out, `<body style="margin:6px;background:#FAFAF8;display:flex;flex-wrap:wrap;width:${(size + 6) * 8}px">${cells}</body>`);
console.log(ids.length, 'figures ->', out);
