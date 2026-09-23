// SPDX-License-Identifier: AGPL-3.0-only
import palette from '../../../assets/brand/tokens/brand.json';
import { ENGINE } from './data.js';

export { ENGINE };
// The kit's palette (assets/brand/tokens/brand.json): the M's three hues, its
// ground and its inks. Green is a UI signal the kit does not draw; it is the
// same value as --ch-green in web-shared/avarok-tokens.css.
const { ground, violet, cyan, gold, ink, product } = palette.color;
export const brandStyle = Object.entries({
  purple: violet[1],
  cyan: cyan[0],
  green: '#12B981',
  gold: gold[0],
  ink: ground.dark,
  paper: 'var(--bg)',
  'gray-text': 'var(--t3)',
  'wordmark-dark': ink.onDark[0],
  'tagline-dark': product.onDark,
})
  .map(([name, value]) => `--atlas-${name}:${value}`)
  .join(';');

export const legacySections = [
  { id: 'proof', label: 'Project milestones' },
  { id: 'news', label: 'Avarok news' },
  { id: 'hardware', label: 'Verified hardware' },
  { id: 'community', label: 'Community' },
  { id: 'contribute', label: 'Contribute' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'mission', label: 'Mission' },
  { id: 'faq', label: 'Frequently asked questions' },
  { id: 'reach', label: 'Contact Avarok' },
];

export function legacyEngineDestination(hash, search) {
  let id;
  try {
    id = decodeURIComponent(hash.replace(/^#/, ''));
  } catch {
    return null;
  }
  return legacySections.some((section) => section.id === id) ? `${ENGINE}${search}#${id}` : null;
}

// Derived from the generated ladder. A missing baseline fails the build rather
// than leaving an unsubstantiated performance claim on the front page.
export function benchmarkHighlight(ladder) {
  if (!Array.isArray(ladder.rows) || ladder.rows.length === 0) throw new Error('Missing benchmark rows');
  const row = [...ladder.rows].sort((a, b) => b.c - a.c)[0];
  const baseline = row.baselines?.find((item) => item.id === row.best_baseline_id);
  if (![row.c, row.atlas, baseline?.tok_s].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error('Invalid benchmark evidence');
  }
  const max = Math.max(row.atlas, baseline.tok_s);
  return {
    concurrency: row.c,
    atlas: row.atlas,
    baseline: baseline.tok_s,
    baselineLabel: baseline.label,
    ratio: row.atlas / baseline.tok_s,
    improved: row.atlas > baseline.tok_s,
    atlasWidth: (row.atlas / max) * 100,
    baselineWidth: (baseline.tok_s / max) * 100,
  };
}
