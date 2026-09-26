// SPDX-License-Identifier: AGPL-3.0-only
import palette from '../../../assets/brand/tokens/brand.json';
import { ENGINE } from './data.js';

export { ENGINE };
// The kit's palette (assets/brand/tokens/brand.json): the M's three hues, its
// ground and its inks. Green is a UI signal the kit does not draw; it is the
// same value as --ch-green in web-shared/metrale-tokens.css.
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
  .map(([name, value]) => `--mk-${name}:${value}`)
  .join(';');

// A section that left /engine names where its readers go now: the news band
// became the product updates page, the hardware cards the platform's hardware
// page. The fragment is dropped there, since neither page has that anchor.
export const legacySections = [
  { id: 'proof', label: 'Project milestones' },
  { id: 'news', label: 'Metrale news', to: '/resources/updates' },
  { id: 'hardware', label: 'Verified hardware', to: '/platform/hardware' },
  { id: 'community', label: 'Community' },
  { id: 'contribute', label: 'Contribute' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'mission', label: 'Mission' },
  { id: 'faq', label: 'Frequently asked questions' },
  { id: 'reach', label: 'Contact Metrale' },
];

export function legacyEngineDestination(hash, search) {
  let id;
  try {
    id = decodeURIComponent(hash.replace(/^#/, ''));
  } catch {
    return null;
  }
  const section = legacySections.find((entry) => entry.id === id);
  if (!section) return null;
  return section.to ? `${section.to}${search}` : `${ENGINE}${search}#${id}`;
}

// Derived from the generated ladder. A missing baseline fails the build rather
// than leaving an unsubstantiated performance claim on the front page.
export function benchmarkHighlight(ladder) {
  if (!Array.isArray(ladder.rows) || ladder.rows.length === 0) throw new Error('Missing benchmark rows');
  const row = [...ladder.rows].sort((a, b) => b.c - a.c)[0];
  const baseline = row.baselines?.find((item) => item.id === row.best_baseline_id);
  if (![row.c, row.engine, baseline?.tok_s].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error('Invalid benchmark evidence');
  }
  const max = Math.max(row.engine, baseline.tok_s);
  return {
    concurrency: row.c,
    engine: row.engine,
    baseline: baseline.tok_s,
    baselineLabel: baseline.label,
    ratio: row.engine / baseline.tok_s,
    improved: row.engine > baseline.tok_s,
    engineWidth: (row.engine / max) * 100,
    baselineWidth: (baseline.tok_s / max) * 100,
  };
}
