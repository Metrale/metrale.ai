// SPDX-License-Identifier: AGPL-3.0-only
//
// Below 900 px the categories wrap to a scrolling row that runs to both edges
// of the screen: a negative margin on each side cancels the bar's padding. A
// row like that must be as much wider than the bar as its margins take back,
// or it stops short and its last link falls out of view (it did, by 64 px, at
// 390 px). This holds the width to the margins in the stylesheet, so the next
// change to one cannot forget the other.
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const narrow = css.slice(css.indexOf('@media (max-width: 900px)'));
const nav = narrow.match(/\n\s*\.nav\s*\{([^}]*)\}/)?.[1] ?? '';

test('the narrow-screen category row is wider than the bar by exactly its two negative margins', () => {
  const margin = nav.match(/margin:\s*0\s+(-[\d.]+rem)/)?.[1];
  const width = nav.match(/width:\s*calc\(100%\s*\+\s*([\d.]+rem)\)/)?.[1];
  expect(margin, 'the row bleeds with a negative margin').toBeDefined();
  expect(width, 'the row widens by calc(100% + …)').toBeDefined();
  expect(parseFloat(width)).toBe(-2 * parseFloat(margin));
});
