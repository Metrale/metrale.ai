#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// kit.mjs — everything the site, the blog and the docs take from the brand kit
// -----------------------------------------------------------------------------
// The brand is Metrale/metrale-assets. assets/take-assets.sh vendors the files
// this repository uses into assets/brand/, pinned in assets/brand.pin. This
// script derives every brand file the three properties serve or build with
// from those, and nothing else:
//
//   site/static, blog/static      the kit's favicons, app icons and social card,
//                                 byte for byte; the site's manifest, the kit's
//                                 with the site's own fields added
//   site/static/fonts             Manrope and its licence
//   site/src/styles/              the kit's metric-matched 'Manrope Fallback' face
//   web-shared/brand-art.js       the kit's logo cuts and marks as data, drawn by
//                                 web-shared/components/MetraleLockup.svelte
//   web-shared/metrale-tokens.css the kit's palette as --brand-* (the block
//                                 between the BEGIN and END markers); the roles
//                                 below it name those
//
//   node scripts/brand/kit.mjs            write what is behind
//   node scripts/brand/kit.mjs --check    fail naming what is behind
//
// src/lib/brand-kit.test.js runs the same derivation, so a derived file that is
// not what the vendored kit says is a failing unit test.
// =============================================================================

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICON_QUERY, brandFiles } from '../../../web-shared/brand-files.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(here, '..', '..', '..');
const KIT = join(REPO, 'assets', 'brand');
const kit = (f, enc = 'utf8') => readFileSync(join(KIT, f), enc);

// The kit's guidelines: "Use `mark` above 48 px and `mark-compact` at 48 px and below."
// brand.json does not carry this one number, so it is stated here, once.
const COMPACT_MAX_PX = 48;
// The owner's ruling of 2026-10-08: the public sites use no cyan, so the kit's
// signal colour is not emitted and no stylesheet can name it. Lavender has no
// role in the v2 kit (it was an ink of the previous mark).
const OMIT = new Set(['cyan', 'lavender']);

// Files served exactly as the kit ships them. The ones a page or the manifest
// links carry the brand version in their name (web-shared/brand-files.mjs).
const COPIES = {
  'site/static/favicon.ico': 'favicon.ico',
  'site/static/favicon.svg': 'favicon.svg',
  'site/static/apple-touch-icon.png': 'dark/apple-touch-icon-180.png',
  [`site/static${brandFiles.icon192}`]: 'dark/icon-192.png',
  [`site/static${brandFiles.icon512}`]: 'dark/icon-512.png',
  [`site/static${brandFiles.iconMaskable512}`]: 'dark/icon-maskable-512.png',
  [`site/static${brandFiles.ogImage}`]: 'dark/og-image-1200x630.png',
  'site/static/logo.svg': 'svg/logo-horizontal-ondark.svg',
  'site/static/fonts/manrope-latin-wght-normal.woff2': 'fonts/manrope-latin-wght-normal.woff2',
  'site/static/fonts/MANROPE-LICENSE.txt': 'fonts/MANROPE-LICENSE.txt',
  'site/src/styles/manrope-fallback.css': 'fonts/manrope-fallback.css',
  'blog/static/favicon.ico': 'favicon.ico',
  'blog/static/favicon.svg': 'favicon.svg',
  'blog/static/apple-touch-icon.png': 'dark/apple-touch-icon-180.png',
  [`blog/static${brandFiles.ogImage}`]: 'dark/og-image-1200x630.png',
  [`blog/static${brandFiles.blogManrope}`]: 'fonts/manrope-latin-wght-normal.woff2',
  'blog/static/fonts/MANROPE-LICENSE.txt': 'fonts/MANROPE-LICENSE.txt',
  'blog/src/manrope-fallback.css': 'fonts/manrope-fallback.css',
};

// The kit's manifest names its icons by their plain names; the site serves
// them under the versioned ones, and the SVG under the query the pages use.
const MANIFEST_ICONS = {
  '/icon-192.png': brandFiles.icon192,
  '/icon-512.png': brandFiles.icon512,
  '/icon-maskable-512.png': brandFiles.iconMaskable512,
  '/favicon.svg': `/favicon.svg${ICON_QUERY}`,
};

// The site's manifest: the kit's (name, icons, colours, display) with what only
// the site knows added. A field the kit sets is never overridden here.
const SITE_MANIFEST = {
  id: '/',
  description: 'The inference economics platform for GPUs you already own.',
  lang: 'en',
  dir: 'ltr',
  scope: '/',
  start_url: '/',
  display_override: ['window-controls-overlay', 'standalone'],
  orientation: 'any',
  categories: ['developer', 'productivity', 'utilities'],
};

const TOKENS = 'web-shared/metrale-tokens.css';
const BEGIN = '/* BEGIN brand palette:';
const END = '/* END brand palette */';

const kebab = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

/**
 * A kit SVG as data: its viewBox and its drawing, element by element. The kit's
 * SVGs are flat (path, rect, a group with a transform); anything else in one is
 * a kit this script has not been taught, and it stops rather than guess.
 * @param {string} name a path under assets/brand/svg/
 * @param {string} [text] the file's text, read from the kit when not given
 */
export function parseSvg(name, text = kit(`svg/${name}`)) {
  const svg = text.trim();
  const open = svg.match(/^<svg\b([^>]*)>/);
  if (!open || !svg.endsWith('</svg>')) throw new Error(`svg/${name} is not one <svg> element`);
  if (/<script|<style|<image|<use|\bon[a-z]+=|href=/i.test(svg)) throw new Error(`svg/${name} carries more than plain shapes`);
  const viewBox = open[1]
    .match(/viewBox="([^"]+)"/)?.[1]
    .split(/\s+/)
    .map(Number);
  if (!viewBox || viewBox.length !== 4 || viewBox.some((n) => !Number.isFinite(n))) throw new Error(`svg/${name} has no numeric viewBox`);
  const body = svg.slice(open[0].length, -'</svg>'.length).replace(/<title>[^<]*<\/title>/, '');
  const root = { children: [] };
  const stack = [root];
  let rest = body;
  for (const m of body.matchAll(/<(\/?)([a-z]+)\b([^>]*?)(\/?)>/g)) {
    rest = rest.replace(m[0], '');
    const [, close, tag, attrs, selfClose] = m;
    if (!['g', 'path', 'rect'].includes(tag)) throw new Error(`svg/${name}: <${tag}> is not a shape this script draws`);
    if (close) {
      if (stack.pop().tag !== tag) throw new Error(`svg/${name}: </${tag}> closes nothing`);
      continue;
    }
    const a = Object.fromEntries([...attrs.matchAll(/([a-z-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
    const node = tag === 'g' ? { tag, a, children: [] } : { tag, a };
    stack.at(-1).children.push(node);
    if (tag === 'g' && !selfClose) stack.push(node);
  }
  if (stack.length !== 1 || rest.trim()) throw new Error(`svg/${name}: unbalanced or unparsed content`);
  return { viewBox, nodes: root.children };
}

/** Every derived file, as { 'repo/relative/path': Buffer | string }. Reads only assets/brand/. */
export function derive() {
  const brand = JSON.parse(kit('tokens/brand.json'));
  const out = {};
  for (const [to, from] of Object.entries(COPIES)) out[to] = kit(from, null);

  const manifest = JSON.parse(kit('site.webmanifest'));
  for (const k of Object.keys(SITE_MANIFEST))
    if (k in manifest) throw new Error(`the kit's manifest now sets ${k}; drop it from SITE_MANIFEST`);
  manifest.icons = manifest.icons.map((icon) => {
    if (!(icon.src in MANIFEST_ICONS))
      throw new Error(`the kit's manifest names ${icon.src}, which the site does not serve under a versioned name`);
    return { ...icon, src: MANIFEST_ICONS[icon.src] };
  });
  out['site/static/site.webmanifest'] = JSON.stringify({ ...SITE_MANIFEST, ...manifest }, null, 2) + '\n';

  const art = {
    clear: brand.geometry.clearSpace,
    minWidth: { logo: brand.minimumSize.horizontalPx, mark: brand.minimumSize.markPx },
    compactMaxWidth: COMPACT_MAX_PX,
    logo: { dark: parseSvg('logo-horizontal-ondark.svg'), light: parseSvg('logo-horizontal.svg') },
    mark: parseSvg('mark.svg'),
    compact: parseSvg('mark-compact.svg'),
  };
  out['web-shared/brand-art.js'] =
    '// Generated by site/scripts/brand/kit.mjs from assets/brand/svg (metrale-assets, assets/brand.pin). Do not edit.\n' +
    "// The kit's logo cuts and marks as data, with the kit's own inks: what MetraleLockup.svelte draws.\n" +
    `export const ART = ${JSON.stringify(art)};\n`;

  const palette = Object.entries(brand.color)
    .filter(([k]) => !OMIT.has(k))
    .map(([k, v]) => {
      if (!/^#[0-9A-F]{6}$/i.test(v)) throw new Error(`brand.json colour ${k} is not a hex colour: ${v}`);
      return `  --brand-${kebab(k)}: ${v};`;
    });
  const block =
    `${BEGIN} written by site/scripts/brand/kit.mjs from assets/brand/tokens/brand.json. Do not edit. */\n` +
    `:root {\n${palette.join('\n')}\n}\n${END}`;
  const css = readFileSync(join(REPO, TOKENS), 'utf8');
  const a = css.indexOf(BEGIN);
  const b = css.indexOf(END);
  if (a < 0 || b < a) throw new Error(`${TOKENS} has no brand palette markers`);
  out[TOKENS] = css.slice(0, a) + block + css.slice(b + END.length);
  return out;
}

/** The derived files that differ from what is on disk. */
export function behind(outputs = derive()) {
  return Object.entries(outputs)
    .filter(([rel, want]) => {
      const file = join(REPO, rel);
      if (!existsSync(file)) return true;
      const have = readFileSync(file);
      return !have.equals(Buffer.isBuffer(want) ? want : Buffer.from(want, 'utf8'));
    })
    .map(([rel]) => rel);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputs = derive();
  const stale = behind(outputs);
  const pin = readFileSync(join(REPO, 'assets', 'brand.pin'), 'utf8').match(/^tag=(.+)$/m)?.[1];
  if (process.argv.includes('--check')) {
    if (stale.length) {
      console.error(
        `kit: ${stale.length} derived file(s) are behind assets/brand (metrale-assets ${pin}):\n  ${stale.join('\n  ')}\nRun node scripts/brand/kit.mjs`
      );
      process.exit(1);
    }
    console.log(`kit: ${Object.keys(outputs).length} derived files match metrale-assets ${pin}`);
  } else {
    for (const rel of stale) writeFileSync(join(REPO, rel), outputs[rel]);
    console.log(
      `kit: wrote ${stale.length} of ${Object.keys(outputs).length} derived files from metrale-assets ${pin}${stale.length ? ':\n  ' + stale.map((r) => relative(REPO, join(REPO, r))).join('\n  ') : ''}`
    );
  }
}
