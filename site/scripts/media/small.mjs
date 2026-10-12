#!/usr/bin/env node
// =============================================================================
// small.mjs — the 640 wide copy of every poster and still
// -----------------------------------------------------------------------------
// Every poster (static/media/<clip>.webp) and every still
// (static/media/art/<slot>.webp) ships a second time, 640 pixels wide, as
// <name>-640.webp. A phone draws a hero picture about 350 CSS pixels wide, so the
// small file is enough there at a third of the bytes; src/lib/content/media.js
// says why and names the file (smallOf).
//
// install.mjs, encode.mjs and reel.mjs call writeSmall() right after they write
// a poster or a still. Run on its own, this writes every small copy that is
// missing:
//
//   node scripts/media/small.mjs            write what is missing
//   node scripts/media/small.mjs --check    write nothing, exit 1 if anything is
//
// Needs ffmpeg with libwebp (FFMPEG overrides the binary). Unit tests in
// src/lib/content/media-small.test.js hold the committed files to the rule.
// =============================================================================

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SMALL_WIDTH, allClips, media, smallOf } from '../../src/lib/content/media.js';

const here = dirname(fileURLToPath(import.meta.url));
const STATIC = resolve(here, '..', '..', 'static');
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';

/**
 * Write the 640 wide copy of one full size webp, beside it.
 * @param {string} webp absolute path of the full size file
 * @returns {string} absolute path of the small file
 */
export function writeSmall(webp) {
  const out = smallOf(webp);
  if (out === webp) throw new Error(`small.mjs: ${webp} is not a .webp file`);
  execFileSync(
    FFMPEG,
    [
      ...['-y', '-hide_banner', '-loglevel', 'error', '-i', webp, '-frames:v', '1'],
      ...['-vf', `scale=${SMALL_WIDTH}:-2:flags=lanczos`, '-c:v', 'libwebp', '-quality', '80', '-compression_level', '6', out],
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] }
  );
  return out;
}

/** Every full size poster and still the site references, as static/ paths. */
export const pictures = () => [...new Set([...allClips.map((c) => c.poster), ...Object.values(media.art).map((a) => a.src)])];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const stale = pictures()
    .map((src) => resolve(STATIC, `.${src}`))
    .filter((full) => {
      if (!existsSync(full)) throw new Error(`small.mjs: ${full} is referenced and missing`);
      return !existsSync(smallOf(full));
    });
  if (check) {
    for (const full of stale) console.error(`small.mjs: no ${smallOf(full)}`);
    process.exit(stale.length ? 1 : 0);
  }
  for (const full of stale) console.log(`small.mjs: wrote ${writeSmall(full)}`);
  console.log(`small.mjs: ${stale.length} written, ${pictures().length} pictures`);
}
