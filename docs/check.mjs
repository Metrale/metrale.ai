#!/usr/bin/env node
// docs/check.mjs — prove a built book before it ships.
//
// Runs over docs/build after docs/build.mjs. It fails when a reader could still
// see the engine's former name, when the title or the hosts did not move, or
// when something the pages need beside them is missing. A count of pages is
// printed so a build that silently lost chapters is noticed.
//
//   node docs/check.mjs

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leftovers } from './rebrand.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'build');
const fail = [];
const bad = (m) => fail.push(m);

if (!existsSync(join(OUT, 'index.html'))) {
  console.error('docs: no build. Run docs/build.mjs first.');
  process.exit(1);
}
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const pages = walk(OUT).filter((f) => f.endsWith('.html') && !f.includes(`${join('api')}`));

// What a reader sees: the page without its scripts, code and markup.
const visible = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<pre[\s\S]*?<\/pre>/g, ' ')
    .replace(/<code[\s\S]*?<\/code>/g, ' ')
    .replace(/<[^>]+>/g, ' ');

let seen = 0;
for (const f of pages) {
  const html = readFileSync(f, 'utf8');
  const left = leftovers(visible(html));
  if (left.length) {
    seen += left.length;
    if (seen <= 12) bad(`${relative(OUT, f)}: ${left.slice(0, 3).join(' | ')}`);
  }
  if (html.includes('atlascybernetics.ai')) bad(`${relative(OUT, f)} still names the old host`);
}
if (seen > 12) bad(`… and ${seen - 12} more places still say Atlas`);

const index = readFileSync(join(OUT, 'index.html'), 'utf8');
if (!index.includes('The Metrale Engine Book')) bad("the front page does not carry the book's new title");
if (!index.includes('metrale.js')) bad('the front page does not load the lockup script');
if (!index.includes('metrale.css')) bad('the front page does not load the Metrale layer');
for (const needed of [
  'llms.txt',
  '_headers',
  'og-image.png',
  'favicon.svg',
  'version.txt',
  'fonts/fonts.css',
  'fonts/urbanist-latin-wght-normal.woff2',
]) {
  if (!existsSync(join(OUT, needed))) bad(`${needed} is missing beside the pages`);
}
if (existsSync(join(OUT, 'llms.txt'))) {
  const llms = readFileSync(join(OUT, 'llms.txt'), 'utf8');
  if (!llms.includes('https://docs.metrale.ai')) bad('llms.txt does not name the new host');
}

console.log(`docs: ${pages.length} pages checked`);
if (fail.length) {
  for (const m of fail) console.error(`  FAIL  ${m}`);
  process.exit(1);
}
console.log('docs: the built book reads as Metrale Engine, names the new hosts, and ships what it needs');
