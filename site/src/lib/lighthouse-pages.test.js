// SPDX-License-Identifier: AGPL-3.0-only
//
// Every public page is held to 100 in all four Lighthouse categories, so every
// public page is in lighthouse/lighthouserc.json. A page added later fails here
// until it joins the list.
//
// A public page is one the sitemap lists, or any other route with a +page.svelte
// (/diligence is noindex and still public). The only routes left out are the ones
// the registry marks `sitemap: false`: /broll, a render page for the media
// recorder that nothing links to, and /404.
import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pages, SITE } from '$lib/content/index.js';
import { GET as sitemap } from '../routes/sitemap.xml/+server.js';

const ROUTES = fileURLToPath(new URL('../routes/', import.meta.url));
const RC = fileURLToPath(new URL('../../lighthouse/lighthouserc.json', import.meta.url));
const PR_YML = fileURLToPath(new URL('../../../.github/workflows/pr.yml', import.meta.url));

const htmlFile = (path) => (path === '/' ? '/index.html' : `${path}.html`);
const gated = new Set(JSON.parse(readFileSync(RC, 'utf8')).ci.collect.url.map((u) => new URL(u).pathname));
const excluded = new Set(pages.filter((p) => p.sitemap === false).map((p) => p.path));

/** Paths of the static route files, with (group) segments dropped. Dynamic routes come in through the sitemap. */
function routeFiles(dir = ROUTES, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) routeFiles(full, out);
    else if (e.name === '+page.svelte') {
      const segments = relative(ROUTES, dir)
        .split(sep)
        .filter((s) => s && !/^\(.*\)$/.test(s));
      if (!segments.some((s) => s.startsWith('['))) out.push('/' + segments.join('/'));
    }
  }
  return out;
}

async function sitemapPaths() {
  const xml = await sitemap().text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].slice(SITE.length) || '/');
}

test('every page in the sitemap is in the Lighthouse gate', async () => {
  const paths = await sitemapPaths();
  expect(paths.length).toBeGreaterThan(0);
  expect(paths.filter((p) => !gated.has(htmlFile(p)))).toEqual([]);
});

test('every other public route is in the Lighthouse gate', () => {
  const missing = routeFiles().filter((p) => !excluded.has(p) && !gated.has(htmlFile(p)));
  expect(missing).toEqual([]);
});

test('the Lighthouse gate names no page that does not exist', async () => {
  const known = new Set([...(await sitemapPaths()), ...routeFiles()].map(htmlFile));
  expect([...gated].filter((f) => !known.has(f))).toEqual([]);
});

test('the pages left out of the gate are only the render page and the 404', () => {
  expect([...excluded].sort()).toEqual(['/404', '/broll']);
  for (const p of excluded) expect(gated.has(htmlFile(p))).toBe(false);
});

// The gate holds every page to 100 on a phone and on a desktop. The file's own
// settings are Lighthouse's default, the mobile run; pr.yml runs the list once
// as that and once more with the desktop preset. Either leg can be lost without
// a page failing: a preset written into the file turns the mobile leg into a
// second desktop run, and a matrix without `mobile` never runs it.
test('the Lighthouse gate runs every page on both form factors', () => {
  const { settings } = JSON.parse(readFileSync(RC, 'utf8')).ci.collect;
  expect(settings.preset).toBeUndefined();
  expect(settings.formFactor).toBeUndefined();
  expect(settings.screenEmulation).toBeUndefined();
  expect(settings.throttling).toBeUndefined();

  const yml = readFileSync(PR_YML, 'utf8');
  const job = yml.slice(yml.indexOf('\n  lighthouse-shard:'), yml.indexOf('\n  lighthouse:'));
  expect(job.match(/^ {8}form: \[(.*)\]$/m)?.[1]).toBe('mobile, desktop');
  expect(job).toContain('mobile) ;;');
  expect(job).toContain('desktop) args+=("--collect.settings.preset=desktop") ;;');
  expect(job).toContain('npx --yes @lhci/cli@0.15.1 autorun --config=site/lighthouse/lighthouserc.json "${args[@]}"');
});
