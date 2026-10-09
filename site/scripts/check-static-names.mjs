#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// check-static-names.mjs — a long-cached static file that changes, changes name
// -----------------------------------------------------------------------------
// Files under site/static and blog/static are served by their names, and most
// are cached for a month in browsers and as long again at the edge (each
// static/_headers says for how long). A file that changes content under the
// same name is served in its old form until those copies expire: after the
// brand v2 deploy the site kept serving the first kit's font sheet, icons and
// social card. So this compares the tracked files against a base commit and
// fails on any file whose content changed, whose name did not, and whose cache
// lifetime is longer than a day, unless the pages link it with a version query
// (?v=N) that changed too, which is how the fixed-name icons are versioned.
//
//   node site/scripts/check-static-names.mjs <base commit>    # the PR workflow passes the PR's base
// =============================================================================

import { execFileSync } from 'node:child_process';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';

/** A day: the longest a changed file may keep its name (favicon.ico, which cannot be renamed, is cached for one). */
export const LONGEST_SAME_NAME = 86400;
export const ROOTS = ['site/static', 'blog/static'];
// The documents that link files with a version query, per root.
const LINKERS = { 'site/static': ['site/src/app.html'], 'blog/static': ['blog/src/app.html'] };

/** _headers as [{ path, headers }] in file order (header names lower-cased). */
export function parseHeaders(text) {
  const rules = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) rules.push({ path: line.trim(), headers: {} });
    else if (rules.length) {
      const i = line.indexOf(':');
      rules.at(-1).headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
    }
  }
  return rules;
}

const escape = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
const matches = (pattern, path) => new RegExp('^' + pattern.split('*').map(escape).join('.*') + '$').test(path);

/** Seconds a path may be cached by its Cache-Control rule; 0 with no rule (Pages revalidates), Infinity when immutable. */
export function cacheLifetime(rules, path) {
  const rule = rules.find((r) => 'cache-control' in r.headers && matches(r.path, path));
  if (!rule) return 0;
  const value = rule.headers['cache-control'];
  if (/\bimmutable\b/.test(value)) return Infinity;
  const age = value.match(/\bmax-age=(\d+)/);
  return age ? Number(age[1]) : 0;
}

/** The version query a document links a file with (`name?v=3` gives `3`), or null. */
export function linkedVersion(html, url) {
  const name = posix.basename(url);
  return html.match(new RegExp(`/${escape(name)}\\?v=([\\w.-]+)`))?.[1] ?? null;
}

/**
 * The changed files that keep their name although they are cached for longer than a day.
 * @param {{ root: string, path: string, before: string, after: string }[]} files tracked files with their blob ids
 * @param {(root: string) => object[]} rulesOf the _headers rules of a root, at the head
 * @param {(root: string, side: 'base' | 'head') => string[]} linkersOf the linking documents' text
 */
export function staleUnderSameName(files, rulesOf, linkersOf) {
  const problems = [];
  for (const f of files) {
    if (!f.before || !f.after || f.before === f.after) continue;
    const url = '/' + posix.relative(f.root, f.path);
    if (url === '/_headers') continue;
    const lifetime = cacheLifetime(rulesOf(f.root), url);
    if (lifetime <= LONGEST_SAME_NAME) continue;
    const now =
      linkersOf(f.root, 'head')
        .map((html) => linkedVersion(html, url))
        .find(Boolean) ?? null;
    const then =
      linkersOf(f.root, 'base')
        .map((html) => linkedVersion(html, url))
        .find(Boolean) ?? null;
    if (now && now !== then) continue;
    problems.push(`${f.path}: changed under the same name, cached ${lifetime === Infinity ? 'immutably' : `${lifetime} s`}`);
  }
  return problems;
}

function main(base) {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const tree = (ref) =>
    new Map(
      git('ls-tree', '-r', ref, '--', ...ROOTS)
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [meta, path] = line.split('\t');
          return [path, meta.split(' ')[2]];
        })
    );
  const before = tree(base);
  const after = tree('HEAD');
  const files = [...after].map(([path, blob]) => ({
    root: ROOTS.find((r) => path.startsWith(r + '/')),
    path,
    before: before.get(path),
    after: blob,
  }));
  const show = (ref, path) => {
    try {
      return git('show', `${ref}:${path}`);
    } catch {
      return '';
    }
  };
  const rules = Object.fromEntries(ROOTS.map((r) => [r, parseHeaders(show('HEAD', `${r}/_headers`))]));
  const problems = staleUnderSameName(
    files,
    (root) => rules[root],
    (root, side) => LINKERS[root].map((p) => show(side === 'head' ? 'HEAD' : base, p))
  );
  const changed = files.filter((f) => f.before && f.before !== f.after).length;
  if (problems.length) {
    console.error(
      `static names: ${problems.length} long-cached file(s) changed content and kept their name, so visitors and the edge keep the old one for up to a month:\n  ${problems.join('\n  ')}\nGive each a new name (the brand files' versions are in web-shared/brand-files.mjs), or bump the ?v= it is linked with.`
    );
    process.exit(1);
  }
  console.log(
    `static names: ${files.length} tracked files, ${changed} changed since ${base.slice(0, 12)}, none long-cached under the same name`
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const base = process.argv[2];
  if (!base) {
    console.error('usage: check-static-names.mjs <base commit>');
    process.exit(2);
  }
  main(base);
}
