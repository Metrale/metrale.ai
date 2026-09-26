// SPDX-License-Identifier: AGPL-3.0-only
//
// Metrale Engine is licensed MIT OR Apache-2.0, and that is the only licence
// story a visitor may read: no edition split, no copyleft engine, no
// contributor agreement that exists to relicense. This reads every file a
// visitor's words come from (the content modules, the pages and components,
// the deck, the blog, the guide's prompt and llms.txt with its generator) and
// fails on a sentence from the old story.
//
// The SPDX line at the top of a source file is the licence of THIS repository's
// code, not a claim about the engine, so that one line is not read.

// cspell:ignore licens
import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { links } from './brand.js';

const REPO = join(import.meta.dir, '..', '..', '..', '..');
const ROOTS = ['site/src', 'site/static/llms.txt', 'site/scripts/gen-llms.mjs', 'site/deploy/cloudflare/prime-worker/src', 'blog/src'];
const TEXT = /\.(js|mjs|svelte|md|json|txt|html)$/;
const OLD_STORY = [
  /AGPL/,
  /Affero/i,
  /Community Edition/i,
  /Enterprise Edition/i,
  /\bCLA\b/,
  /re-?licens/i,
  /dual licensed[^.]*commercial/i,
];

const walk = (p) =>
  statSync(p).isDirectory()
    ? readdirSync(p).flatMap((n) => (n === 'node_modules' || n.endsWith('.generated.json') ? [] : walk(join(p, n))))
    : [p];

/** Every line of the old story, as `path:line: text`, SPDX lines left out. */
export function oldStory(files) {
  const hits = [];
  for (const f of files) {
    if (!TEXT.test(f) || f.endsWith('licence.test.js')) continue;
    readFileSync(f, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (line.includes('SPDX-License-Identifier')) return;
        if (OLD_STORY.some((re) => re.test(line))) hits.push(`${relative(REPO, f)}:${i + 1}: ${line.trim().slice(0, 120)}`);
      });
  }
  return hits;
}

test('no page, post, deck slide or answer tells the old licence story', () => {
  expect(oldStory(ROOTS.flatMap((r) => walk(join(REPO, r))))).toEqual([]);
});

// The control: the reader has to see a sentence of the old story when one is
// there, or the test above passes by reading nothing.
test('the reader finds the old story when it is present', () => {
  const f = join(mkdtempSync(join(tmpdir(), 'licence-')), 'control.js');
  writeFileSync(f, "// SPDX-License-Identifier: AGPL-3.0-only\nconst a = 'Community Edition under AGPL-3.0.';\n");
  const hits = oldStory([f]);
  expect(hits.length).toBe(1);
  expect(hits[0]).toEndWith(":2: const a = 'Community Edition under AGPL-3.0.';");
});

test('the licence links name the two licence files the engine ships', () => {
  expect(links.license).toMatch(/\/blob\/main\/LICENSE-MIT$/);
  expect(links.licenseApache).toMatch(/\/blob\/main\/LICENSE-APACHE$/);
});
