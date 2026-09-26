// SPDX-License-Identifier: AGPL-3.0-only
//
// The engine repository's name is spelled once, as ENGINE_SLUG in
// web-shared/sources.mjs, so renaming the repository is a one-line change.
// Code, tests and workflows read it from there. This fails on any other file
// that spells it, except the ones below, each of which is written FROM the
// constant or records it as data.

import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENGINE_SLUG } from '../../../web-shared/sources.mjs';

const REPO = join(import.meta.dir, '..', '..', '..');

// Written from ENGINE_SLUG by a generator, or a recorded fixture that carries
// it as data. Prose (README.md and the other notes) is left to the people who
// edit it and is not read here.
const WRITTEN_FROM_IT = [
  'web-shared/sources.mjs',
  /^site\/src\/lib\/[\w-]+\.generated\.json$/,
  /^site\/guide\//,
  'site/SITE-GUIDE.md',
  'site/static/llms.txt',
  /^site\/e2e\/fixtures\/corpus-small\./,
  // Served as a static file: security.txt cannot import a constant.
  'site/static/.well-known/security.txt',
];
const exempt = (f) => WRITTEN_FROM_IT.some((e) => (typeof e === 'string' ? e === f : e.test(f)));

export function spellers(files, read) {
  return files.filter((f) => !f.endsWith('.md') && !exempt(f) && read(f).includes(ENGINE_SLUG));
}

test('only web-shared/sources.mjs spells the engine repository', () => {
  const files = execFileSync('git', ['-C', REPO, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
    .split('\0')
    .filter((f) => f && !f.includes('node_modules/'));
  const read = (f) => {
    try {
      return readFileSync(join(REPO, f), 'utf8');
    } catch {
      return '';
    }
  };
  expect(spellers(files, read)).toEqual([]);
});

// The control: a file that spells it, and is not on the list, is found.
test('a file that spells it is found', () => {
  const text = { 'site/src/lib/x.js': `const u = 'https://github.com/${ENGINE_SLUG}';`, 'site/src/lib/y.js': 'nothing' };
  expect(spellers(Object.keys(text), (f) => text[f])).toEqual(['site/src/lib/x.js']);
});
