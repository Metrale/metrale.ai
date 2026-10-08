/**
 * Token contrast gate, both themes.
 *
 * Every text token clears WCAG AA (4.5:1) on every surface a page paints text
 * on, and every non-text mark (the copper rails, the focus ring) clears 3:1, in
 * the dark theme and in the light one. The pairings are listed once, in
 * site/scripts/brand/contrast.mjs, which the unit suite also asserts
 * (site/src/lib/token-contrast.test.js); this prints the table. The tokens come
 * from web-shared/metrale-tokens.css, the single source for the site and the
 * blog, resolved through the brand kit's palette.
 *
 *   bun .contrast-check.mjs          # from the repository root
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { pairings } from './site/scripts/brand/contrast.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const rows = pairings(readFileSync(resolve(here, 'web-shared/metrale-tokens.css'), 'utf8'));

const cells = rows.map((r) => [r.theme, r.kind, `--${r.fg} ${r.fgHex}`, `${r.on.startsWith('--') || r.on.includes(' ') ? r.on : '--' + r.on} ${r.onHex}`, r.ratio.toFixed(2), r.ratio >= r.floor ? 'ok' : `FAIL < ${r.floor}`]);
const head = ['theme', 'kind', 'foreground', 'on', 'ratio', ''];
const w = head.map((h, i) => Math.max(h.length, ...cells.map((c) => c[i].length)));
const line = (c) => c.map((x, i) => x.padEnd(w[i])).join('  ');
console.log(line(head));
console.log(w.map((n) => '-'.repeat(n)).join('  '));
for (const c of cells) console.log(line(c));
console.log('');

const failed = rows.filter((r) => r.ratio < r.floor);
if (failed.length) {
  console.error(`FAIL: ${failed.length} of ${rows.length} pairings fall below their floor. Change the token, not the floor.`);
  process.exit(1);
}
const tight = (kind) => Math.min(...rows.filter((r) => r.kind === kind).map((r) => r.ratio)).toFixed(2);
console.log(`PASS: ${rows.length} pairings in both themes; tightest text ${tight('text')}:1 (floor 4.5), tightest non-text ${tight('non-text')}:1 (floor 3).`);
