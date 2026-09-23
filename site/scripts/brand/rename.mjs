#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// rename.mjs — change the brand name everywhere a visitor can read it.
// -----------------------------------------------------------------------------
// The site keeps the name in one constant (`company.name` in brand.js) and
// builds the product names from it, but a brand also lives in page titles, alt
// text, aria labels, the manifest, the blog shell, the lockup's accessible
// name, and a few hundred sentences of copy. A rename is a pass over all of
// them, and the mistake is always the same one: a search and replace that also
// rewrites an identifier, a CSS class, a repository URL or a crate name.
//
// So this script sorts every occurrence into a category first, and only
// rewrites the categories that are words a visitor reads:
//
//   copy       replaced   content modules, page markup, app.html, the manifest,
//                         the lockup's names, the blog shell, the generators
//                         that print prose
//   gates      replaced   browser tests, unit tests and CI configuration that
//                         spell the public name or the public URL
//   route      replaced   the /why-<name> page: its folder is moved, every
//                         reference is rewritten, and a redirect is added
//   docs       listed     handoff documents, for a person to reread and edit
//   internals  listed     identifiers and paths that are not the brand: the
//                         `av-` class prefix, avarok-tokens.css, the theme key,
//                         the components/avarok folder, the GitHub organisation,
//                         crate and environment names, worker names
//   artwork    listed     the wordmark, the masters, favicons, icons and the
//                         social card, which need the new kit
//   generated  rebuilt    llms.txt, the site guide, the ledger, *.generated.json
//
// Words are matched with word boundaries, capitalised (Metrale) or in capitals
// (METRALE). The lowercase word is never rewritten: in prose a brand is
// capitalised, and in code a lowercase `avarok` is an object key or a string
// (`{ avarok: 0.5 }`, `path('avarok')`), so it is listed for a look instead.
// A compound (`why-avarok`, `Avarok-Cybersecurity`, `avarokctl`) is never a
// word match, which is what keeps the internals safe. The route is the one
// compound this script rewrites, on purpose, because it is a public URL.
//
//   node scripts/brand/rename.mjs --from Avarok --to Metrale            (report)
//   node scripts/brand/rename.mjs --from Avarok --to Metrale --apply    (do it)
//
// Then: `bun x --bun vite build`, `bun run guide -- --note "..."`, the unit and
// browser suites, and BRAND-CHANGE.md for the steps this script cannot do.
// =============================================================================

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(here, '..', '..');
const REPO = resolve(SITE, '..');
const posix = (p) => p.split(sep).join('/');
const rel = (p) => posix(relative(REPO, p));

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : (args[i + 1] ?? '');
};
const APPLY = args.includes('--apply');
const FROM = opt('from');
const TO = opt('to');
if (!FROM || !TO || !/^[A-Z][a-z]+$/.test(FROM) || !/^[A-Z][a-z]+$/.test(TO)) {
  console.error('usage: node scripts/brand/rename.mjs --from Avarok --to Metrale [--apply]  (one capitalised word each)');
  process.exit(2);
}

// ---- what is what ----------------------------------------------------------------

const SKIP_DIRS = new Set([
  'node_modules',
  'build',
  '.svelte-kit',
  '.git',
  'media',
  'lattice',
  'guide',
  'playwright-report',
  'test-results',
  '.wrangler',
  '.cache',
  'corpus',
]);
const GENERATED = /(\.generated\.json|SITE-GUIDE\.md|static\/llms\.txt|guide\/ledger\.json|guide\/site-guide\.json|sitemap\.xml)$/;

/** Every file under `dir`, skipping what is never edited. */
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (SKIP_DIRS.has(f)) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const COPY = [
  /^site\/src\/lib\/content\/[^/]+\.js$/,
  /^site\/src\/lib\/data\.js$/,
  // The b-roll scenes carry the alt text of the media pipeline's page.
  /^site\/src\/lib\/broll\/scenes\.js$/,
  /^site\/src\/routes\/.+\.svelte$/,
  /^site\/src\/lib\/components\/.+\.svelte$/,
  /^site\/src\/lib\/prime\/.+\.js$/,
  /^site\/src\/app\.html$/,
  /^site\/static\/site\.webmanifest$/,
  /^site\/static\/robots\.txt$/,
  // Cache rules and installed stills are keyed by page path, and the prompt
  // pack's alt text names the brand. The prompt sheet (PROMPTS.md) is rendered
  // from shots.json by scripts/media/brief.mjs, so the source changes, not it.
  /^site\/static\/_headers$/,
  /^site\/src\/lib\/content\/art\.json$/,
  /^site\/media-brief\/(shots|reel)\.json$/,
  /^site\/scripts\/gen-[\w-]+\.mjs$/,
  /^site\/scripts\/media\/og\.mjs$/,
  /^web-shared\/components\/AtlasLockup\.svelte$/,
  /^blog\/src\/.+\.(svelte|js|html)$/,
  /^site\/deploy\/cloudflare\/[\w-]+\/(wrangler\.toml|src\/.+\.js)$/,
];
const GATES = [
  /^site\/e2e\/.+\.(js|mjs)$/,
  /^site\/src\/lib\/.+\.test\.js$/,
  /^blog\/src\/.+\.test\.js$/,
  /^\.github\/workflows\/(site|lighthouse)\.yml$/,
  // The Lighthouse contracts list the gated pages by URL, the moved route among them.
  /^(site|blog)\/lighthouse\/lighthouserc\.\w+$/,
];
const DOCS = [
  /^site\/[A-Z-]+\.md$/,
  /^assets\/brand\/[A-Z-]+\.md$/,
  /^site\/media-brief\/.+\.md$/,
  /^site\/static\/.+README\.md$/,
  /^site\/deploy\/.+README\.md$/,
];
const ARTWORK = [
  /^assets\/brand\/.+\.(svg|png|json)$/,
  /^site\/static\/(favicon.*|icon-.*|apple-touch-icon\.png|og-image\.png|logo\.svg)$/,
  /^blog\/static\/(favicon.*|icon-.*|og.*\.png|logo.*)$/,
];
const kindOf = (r) => {
  if (GENERATED.test(r)) return 'generated';
  if (ARTWORK.some((re) => re.test(r))) return 'artwork';
  if (GATES.some((re) => re.test(r))) return 'gates';
  if (COPY.some((re) => re.test(r))) return 'copy';
  if (DOCS.some((re) => re.test(r))) return 'docs';
  return 'other';
};

// The word in its three cases, never inside a compound. `-`, `_` and a letter
// or digit on either side make a compound, and so do a `.` or a `/` that join
// two names (`Avarok.svelte`, `avarok.dev`, `docs/Avarok`, `Avarok/atlas`).
// Anything else is a boundary: the full stop that ends a sentence ("before
// Avarok."), the `/` that opens a regular expression literal (`/Avarok, the
// platform/` in a browser test). The first pass treated every `.` and `/` as
// a compound and missed both; the built pages and the browser suite caught it.
const lower = FROM.toLowerCase();
const upper = FROM.toUpperCase();
const toLower = TO.toLowerCase();
const toUpper = TO.toUpperCase();
const word = (w) => new RegExp(`(?<![\\w-])(?<![\\w.]/)(?<![\\w]\\.)${w}(?![\\w-])(?!\\.[\\w])(?!/[\\w.])`, 'g');
const RE_CAP = word(FROM);
const RE_UP = word(upper);
const RE_LOW = word(lower);
const ROUTE_FROM = `why-${lower}`;
const ROUTE_TO = `why-${toLower}`;
const RE_ROUTE = new RegExp(ROUTE_FROM, 'g');
// Anything else that contains the old name is an internal: a class prefix, a path,
// a crate, a key. Reported per file, never touched.
const RE_ANY = new RegExp(lower, 'gi');

const replaceWords = (s) => s.replace(RE_ROUTE, ROUTE_TO).replace(RE_CAP, TO).replace(RE_UP, toUpper);
const count = (s, re) => (s.match(re) ?? []).length;

// Lines that state the history need a person: a rename inside them is true but
// incomplete ("X was named Atlas until") or wrong ("the brand is X. It was Atlas").
const HISTORY = /named Atlas|was Atlas|formerly|rebrand|until September 2026|then named/i;

// ---- the pass --------------------------------------------------------------------

const files = walk(REPO).filter(
  (p) => /\.(js|mjs|svelte|html|json|toml|md|txt|yml|css|webmanifest)$/.test(p) || /(_redirects|_headers)$/.test(p)
);
const report = {
  copy: [],
  gates: [],
  docs: [],
  internals: [],
  artwork: [],
  generated: [],
  history: [],
  lowercase: [],
  kept: [],
  other: [],
};
let changedFiles = 0;
let changedWords = 0;

for (const file of files) {
  const r = rel(file);
  const kind = kindOf(r);
  if (kind === 'artwork') {
    // Binary or vector artwork is listed by name, not read for the word.
    if (/\.(svg|json)$/.test(file) && new RegExp(lower, 'i').test(readFileSync(file, 'utf8'))) report.artwork.push(r);
    else if (!/\.(svg|json)$/.test(file)) report.artwork.push(r);
    continue;
  }
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  if (!RE_ANY.test(src)) continue;
  RE_ANY.lastIndex = 0;
  // A file whose first lines say `brand-rename: keep` spells the old names on
  // purpose: a test about the three names, the assistant's account of the
  // history. It is listed and never rewritten.
  if (/brand-rename:\s*keep/.test(src.split('\n').slice(0, 12).join('\n'))) {
    report.kept.push(r);
    continue;
  }
  const words = count(src, RE_CAP) + count(src, RE_UP) + count(src, RE_ROUTE);
  const lowercase = count(src, RE_LOW);
  const all = count(src, RE_ANY);
  const internals = all - words - lowercase;
  if (kind === 'generated') {
    report.generated.push(r);
    continue;
  }
  if (kind === 'copy' || kind === 'gates') {
    if (words > 0) {
      report[kind].push({ file: r, words, internals });
      for (const [i, line] of src.split('\n').entries()) {
        if (RE_CAP.test(line) && HISTORY.test(line)) report.history.push(`${r}:${i + 1}: ${line.trim().slice(0, 120)}`);
        RE_CAP.lastIndex = 0;
      }
      if (APPLY) {
        writeFileSync(file, replaceWords(src));
        changedFiles++;
        changedWords += words;
      }
    }
    if (lowercase > 0) {
      for (const [i, line] of src.split('\n').entries()) {
        if (RE_LOW.test(line)) report.lowercase.push(`${r}:${i + 1}: ${line.trim().slice(0, 110)}`);
        RE_LOW.lastIndex = 0;
      }
    }
    if (internals > 0) report.internals.push({ file: r, internals });
    continue;
  }
  if (kind === 'docs') {
    report.docs.push({ file: r, words, internals });
    continue;
  }
  report.other.push({ file: r, words, internals });
}

// ---- the route: folder, redirect ---------------------------------------------------

const routeDir = join(SITE, 'src', 'routes', '(marketing)', ROUTE_FROM);
const routeDirTo = join(SITE, 'src', 'routes', '(marketing)', ROUTE_TO);
const redirects = join(SITE, 'static', '_redirects');
const routeNotes = [];
if (existsSync(routeDir)) {
  routeNotes.push(`move site/src/routes/(marketing)/${ROUTE_FROM} to ${ROUTE_TO}`);
  if (APPLY) renameSync(routeDir, routeDirTo);
}
const redirectLine = `/${ROUTE_FROM} /${ROUTE_TO} 301`;
const current = existsSync(redirects) ? readFileSync(redirects, 'utf8') : '';
if (!current.includes(redirectLine)) {
  routeNotes.push(`add "${redirectLine}" to site/static/_redirects so the old address keeps working`);
  if (APPLY) {
    mkdirSync(dirname(redirects), { recursive: true });
    writeFileSync(
      redirects,
      `${current.replace(/\s*$/, '')}\n# The page was /${ROUTE_FROM} before the rename.\n${redirectLine}\n`.replace(/^\n/, '')
    );
  }
}

// ---- the report --------------------------------------------------------------------

const n = (list) => list.reduce((a, x) => a + (x.words ?? 0), 0);
const say = (...l) => console.log(...l);
say(`brand rename: ${FROM} -> ${TO}${APPLY ? '' : '  (report only, add --apply to write)'}`);
say('');
say(`copy, replaced: ${report.copy.length} files, ${n(report.copy)} words`);
for (const x of report.copy) say(`  ${x.file}  ${x.words}${x.internals ? `  (+${x.internals} internal, untouched)` : ''}`);
say('');
say(`tests and gates, replaced: ${report.gates.length} files, ${n(report.gates)} words`);
for (const x of report.gates) say(`  ${x.file}  ${x.words}${x.internals ? `  (+${x.internals} internal, untouched)` : ''}`);
say('');
say(`the route: /${ROUTE_FROM} -> /${ROUTE_TO}`);
for (const x of routeNotes) say(`  ${x}`);
if (routeNotes.length === 0) say('  already done');
say('');
say(`history lines to reread by hand: ${report.history.length}`);
for (const x of report.history) say(`  ${x}`);
say('');
say(`lowercase, left alone, look at each: ${report.lowercase.length}`);
for (const x of report.lowercase) say(`  ${x}`);
say('');
say(`kept on purpose (marked "brand-rename: keep"): ${report.kept.length}`);
for (const x of report.kept) say(`  ${x}`);
say('');
say(`docs to reread and edit by hand: ${report.docs.length} files`);
for (const x of report.docs) say(`  ${x.file}  ${x.words} words`);
say('');
say(`internals, left alone on purpose: ${report.internals.length} files`);
for (const x of report.internals) say(`  ${x.file}  ${x.internals}`);
say('');
say(`artwork, needs the kit: ${report.artwork.length} files`);
for (const x of report.artwork) say(`  ${x}`);
say('');
say(`generated, rebuilt by the build and the guide: ${report.generated.length} files`);
for (const x of report.generated) say(`  ${x}`);
const unclassified = report.other.filter((x) => x.words > 0);
if (unclassified.length) {
  say('');
  say(`not classified but carrying the word, look at these: ${unclassified.length} files`);
  for (const x of unclassified) say(`  ${x.file}  words ${x.words}, internal ${x.internals}`);
}
const quiet = report.other.length - unclassified.length;
if (quiet) say(`(${quiet} more files mention the old name only inside identifiers, paths or data, and were left alone)`);
say('');
if (APPLY) say(`wrote ${changedFiles} files, ${changedWords} words. Next: BRAND-CHANGE.md.`);
