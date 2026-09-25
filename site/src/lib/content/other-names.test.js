// SPDX-License-Identifier: AGPL-3.0-only

// The company is Metrale, its brand is Metrale AI and the engine is Metrale
// Engine. Another project's name belongs neither in what a visitor reads nor in
// the source a contributor reads, so this reads the site, the blog, the shared
// files, the docs tooling and the notes as text and fails on one (`OTHER_NAMES`
// in web-shared/sources.mjs). The only files that may carry one are those that
// point at where the open source history lives, the blog's redirect for one
// post's previous address, and the installers copied in at build from the
// registry of the command people install today.

import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OTHER_NAMES } from '../../../../web-shared/sources.mjs';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const ROOTS = ['README.md', 'site', 'blog', 'web-shared', 'docs', 'assets/brand'];
const KEEP = new Set([
  'web-shared/sources.mjs',
  'site/static/_redirects',
  'blog/static/_redirects',
  'site/static/install.sh',
  'site/static/install.ps1',
]);
const TEXT = /\.(js|mjs|cjs|ts|svelte|css|html|md|json|jsonl|txt|toml|yml|yaml|xml|svg|webmanifest|sh|ps1)$|(^|\/)_(headers|redirects)$/;

// What the repository holds: tracked files and new ones, never what git ignores
// (builds, caches, the guide's local knowledge base, the copied installers).
const listed = () =>
  execFileSync('git', ['-C', REPO, 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...ROOTS], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\0')
    .filter(Boolean);

test('no name of another project in the site, the blog, the shared files, the docs tooling or the notes', () => {
  const hits = [];
  const re = new RegExp(OTHER_NAMES.source, 'gi');
  for (const rel of listed()) {
    if (KEEP.has(rel) || !TEXT.test(rel) || !existsSync(join(REPO, rel))) continue;
    readFileSync(join(REPO, rel), 'utf8')
      .split('\n')
      .forEach((line, i) => {
        for (const m of line.matchAll(re)) hits.push(`${rel}:${i + 1}: ${m[0]}`);
      });
  }
  expect(hits.slice(0, 25)).toEqual([]);
});
