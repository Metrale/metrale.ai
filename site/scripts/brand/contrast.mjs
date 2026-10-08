// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// contrast.mjs — every colour pairing the token file promises, in both themes
// -----------------------------------------------------------------------------
// One table, read by the CI gate (.contrast-check.mjs at the repository root,
// which prints it) and by the unit suite (src/lib/token-contrast.test.js, which
// fails naming each pairing under its floor). WCAG 2.2: text 4.5:1 (AA, small
// text), non-text 3:1 (focus rings, rails, chart marks: SC 1.4.11).
//
// A pairing is listed here because the site paints it: text tokens on every
// surface, the ink on a filled control, copper text on the copper tints the
// chips, tags and selected states use (10 to 18% of the hue over the
// surface, and stacked inside an active tab), the status colours on their own tints, and the non-text copper
// (rails, focus rings) on every surface.
// =============================================================================

import { contrast, over, readTokens } from './tokens.mjs';

export const TEXT = 4.5;
export const NON_TEXT = 3;
const SURFACES = ['bg', 'bg2', 'card', 'card-2'];
// Every share of copper the stylesheets put behind text (color-mix with --sx).
const TINTS = [0.1, 0.12, 0.14, 0.16, 0.18];

/**
 * @param {string} css web-shared/metrale-tokens.css
 * @returns {{ theme: string, kind: 'text' | 'non-text', fg: string, on: string, fgHex: string, onHex: string, ratio: number, floor: number }[]}
 */
export function pairings(css) {
  const tokens = readTokens(css);
  const rows = [];
  for (const theme of ['dark', 'light']) {
    const t = tokens[theme];
    const hex = (name) => {
      const v = t[name];
      if (!/^#[0-9a-f]{6}$/i.test(v ?? '')) throw new Error(`--${name} resolves to "${v}" in the ${theme} theme, not a hex colour`);
      return v.toUpperCase();
    };
    const add = (kind, fg, fgHex, on, onHex) => {
      const floor = kind === 'text' ? TEXT : NON_TEXT;
      rows.push({ theme, kind, fg, on, fgHex, onHex, ratio: contrast(fgHex, onHex), floor });
    };
    for (const s of [...SURFACES, 'sunk']) for (const ink of ['t1', 't2', 't3']) add('text', ink, hex(ink), s, hex(s));
    for (const s of SURFACES) {
      for (const ink of ['accent', 'accent-deep', 'sx-text', 'green', 'amber', 'red']) add('text', ink, hex(ink), s, hex(s));
      for (const share of TINTS) {
        const tint = over(hex('sx'), hex(s), share);
        add('text', 'accent-deep', hex('accent-deep'), `${Math.round(share * 100)}% --sx over --${s}`, tint);
      }
      add('text', 'green', hex('green'), `12% --green over --${s}`, over(hex('green'), hex(s), 0.12));
      add('text', 'amber', hex('amber'), `12% --amber over --${s}`, over(hex('amber'), hex(s), 0.12));
      add('text', 'accent-deep', hex('accent-deep'), `--accent-soft over --${s}`, over(t['accent-soft'], hex(s)));
      // A count badge inside an active tab: 18% copper over the tab's own 12%
      // (ModelSlider .eg-family.is-active .eg-family-n). Axe cannot resolve
      // stacked color-mix() grounds, so it is computed here.
      add(
        'text',
        'accent-deep',
        hex('accent-deep'),
        `18% --sx over 12% --sx over --${s}`,
        over(hex('sx'), over(hex('sx'), hex(s), 0.12), 0.18)
      );
      for (const mark of ['sx', 'focus']) add('non-text', mark, hex(mark), s, hex(s));
    }
    for (const fill of ['accent-fill', 'accent-fill-hover', 'accent-deep']) add('text', 'on-accent', hex('on-accent'), fill, hex(fill));
  }
  return rows;
}
