// SPDX-License-Identifier: AGPL-3.0-only
//
// Every poster and still ships a 640 wide copy that a phone takes instead of the
// full size file (media.js says why, scripts/media/small.mjs writes it). A copy
// that is missing is a broken image on every phone, and one that is the wrong
// size is blurred or saves nothing, so the committed files are held here.
import { expect, test } from 'bun:test';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SMALL_WIDTH, allClips, media, smallOf, srcsetOf } from './media.js';

const STATIC = fileURLToPath(new URL('../../../static', import.meta.url));

/** Width and height from a WebP file's header (VP8, VP8L or VP8X). */
function webpSize(path) {
  const b = readFileSync(path);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') throw new Error(`${path} is not a WebP file`);
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (kind === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  throw new Error(`${path}: unknown WebP chunk ${kind}`);
}

const pictures = [
  ...new Map([...allClips.map((c) => ({ src: c.poster, width: c.width })), ...Object.values(media.art)].map((p) => [p.src, p])).values(),
];

test('the small copy is named beside the full size file, a query string kept', () => {
  expect(smallOf('/media/console-ask.webp')).toBe('/media/console-ask-640.webp');
  expect(smallOf('/media/art/art-gov.webp?retry=1')).toBe('/media/art/art-gov-640.webp?retry=1');
  expect(srcsetOf({ src: '/media/a.webp', width: 1280 })).toBe('/media/a-640.webp 640w, /media/a.webp 1280w');
});

test('every poster and still has a 640 wide copy, in proportion and smaller than the original', () => {
  expect(pictures.length).toBeGreaterThan(20);
  const wrong = [];
  for (const p of pictures) {
    const full = `${STATIC}${p.src}`;
    const small = `${STATIC}${smallOf(p.src)}`;
    if (!existsSync(small)) {
      wrong.push(`${smallOf(p.src)} is missing: run node scripts/media/small.mjs`);
      continue;
    }
    const [w, h] = webpSize(full);
    const [sw, sh] = webpSize(small);
    if (w !== p.width) wrong.push(`${p.src} is ${w} wide, the manifest says ${p.width}`);
    if (sw !== SMALL_WIDTH) wrong.push(`${smallOf(p.src)} is ${sw} wide`);
    if (Math.abs(sh - (h * SMALL_WIDTH) / w) > 2) wrong.push(`${smallOf(p.src)} is ${sw}x${sh}, out of proportion with ${w}x${h}`);
    if (statSync(small).size >= statSync(full).size) wrong.push(`${smallOf(p.src)} is no smaller than ${p.src}`);
  }
  expect(wrong).toEqual([]);
});
