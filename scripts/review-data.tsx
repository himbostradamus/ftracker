// Prints the review data (text and drawings for every movement) as JSON.
// Run by scripts/review.tsx on each page load so the page is never stale.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EXERCISES, GROUP_LABELS } from '../src/mobility/data/catalog';
import { POSES } from '../src/mobility/data/poses';
import { Figure } from '../src/mobility/art/Figure';
import { doseLabel } from '../src/mobility/lib/timeline';

const items = EXERCISES.map(e => ({
  id: e.id, name: e.name, group: GROUP_LABELS[e.group], desc: e.desc, steps: e.steps, breath: e.breath ?? '',
  errors: e.errors, easier: e.easier, caution: e.caution ?? '', aliases: e.aliases, alt: e.alt,
  meta: `${e.category} · ${e.difficulty} · ${e.position} · ${doseLabel({ ex: e.id, dose: e.dose }, e)}`,
  svg: renderToStaticMarkup(<Figure pose={POSES[e.id]} seed={e.id} size="100%" />),
}));

process.stdout.write(JSON.stringify(items));
