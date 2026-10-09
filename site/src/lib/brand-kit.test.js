// SPDX-License-Identifier: AGPL-3.0-only
//
// The brand comes from Metrale/metrale-assets, vendored into assets/brand/ at a
// pinned release (assets/brand.pin; CI runs assets/take-assets.sh --check, which
// fails on a hand edit there). Everything the three properties serve or build
// with is derived from those files by scripts/brand/kit.mjs: the icons, the
// social card, the manifest, Manrope and its fallback face, the logo artwork
// the lockup component draws, and the palette block of the token file. This
// holds every derived copy equal to what the kit says today, so a stale icon,
// a redrawn logo or a retyped colour is a failing test rather than a quiet drift.
import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, behind, derive, parseSvg } from '../../scripts/brand/kit.mjs';
import { ART } from '../../../web-shared/brand-art.js';
import { ICON_QUERY, brandFiles } from '../../../web-shared/brand-files.mjs';

const read = (rel) => readFileSync(join(REPO, rel), 'utf8');
const brand = JSON.parse(read('assets/brand/tokens/brand.json'));
const outputs = derive();

test('every file derived from the brand kit is what the vendored kit says today', () => {
  expect({ behind: behind(outputs), fix: 'cd site && node scripts/brand/kit.mjs' }).toEqual({
    behind: [],
    fix: 'cd site && node scripts/brand/kit.mjs',
  });
});

test('the derivation reads the kit, so the check above is not vacuous', () => {
  expect(Object.keys(outputs).length).toBeGreaterThanOrEqual(18);
  // The palette block names the kit's colours, by the kit's names.
  expect(outputs['web-shared/metrale-tokens.css']).toContain(`--brand-copper: ${brand.color.copper};`);
  expect(outputs['web-shared/metrale-tokens.css']).toContain(`--brand-ground: ${brand.color.ground};`);
  // The manifest's colours and icons are the kit's.
  const manifest = JSON.parse(outputs['site/static/site.webmanifest']);
  expect(manifest.theme_color).toBe(brand.color.ground);
  expect(manifest.icons.map((i) => i.src)).toContain(brandFiles.iconMaskable512);
  // A derived file that differs is reported: one byte changed is enough.
  const changed = { ...outputs, 'site/static/favicon.svg': outputs['site/static/favicon.svg'].toString().replace('#C65A2E', '#C65A2F') };
  expect(behind(changed)).toEqual(['site/static/favicon.svg']);
});

test("the palette leaves out the kit's cyan: the public sites use none", () => {
  expect(brand.color.cyan).toMatch(/^#[0-9A-F]{6}$/i); // the kit has one; the omission is deliberate
  const css = outputs['web-shared/metrale-tokens.css'];
  expect(css).not.toContain('--brand-cyan');
  expect(css.toUpperCase()).not.toContain(brand.color.cyan.toUpperCase());
});

test("the logo artwork is the kit's two cuts and two marks, with the kit's inks", () => {
  expect(ART.clear).toBe(brand.geometry.clearSpace);
  expect(ART.minWidth.logo).toBe(brand.minimumSize.horizontalPx);
  const fills = (nodes) => nodes.flatMap((n) => [n.a.fill, ...(n.children ? fills(n.children) : [])]).filter(Boolean);
  // The mark is copper on both grounds; the cuts differ in the rule and the letters.
  for (const art of [ART.logo.dark, ART.logo.light, ART.mark, ART.compact]) expect(fills(art.nodes)).toContain(brand.color.copper);
  expect(fills(ART.logo.dark.nodes)).toEqual(
    expect.arrayContaining([brand.color[brand.roles.ruleOnDark], brand.color[brand.roles.companyOnDark]])
  );
  expect(fills(ART.logo.light.nodes)).toEqual(
    expect.arrayContaining([brand.color[brand.roles.ruleOnLight], brand.color[brand.roles.companyOnLight]])
  );
  expect(ART.logo.dark).not.toEqual(ART.logo.light);
  expect(ART.mark.viewBox).toEqual([0, 0, ...brand.geometry.mark]);
});

test('the SVG reader refuses anything but plain shapes', () => {
  const ok =
    '<svg viewBox="0 0 10 10"><title>t</title><g transform="translate(1 1)"><path d="M0 0L1 1Z" fill="#000000"/></g><rect x="0" y="0" width="1" height="1" fill="#000000"/></svg>';
  expect(parseSvg('ok.svg', ok).nodes.map((n) => n.tag)).toEqual(['g', 'rect']);
  expect(() => parseSvg('bad.svg', '<svg viewBox="0 0 1 1"><script>x()</script></svg>')).toThrow();
  expect(() => parseSvg('bad.svg', '<svg viewBox="0 0 1 1"><circle r="1"/></svg>')).toThrow();
  expect(() => parseSvg('bad.svg', '<svg viewBox="0 0 1 1"><path d="M0 0" onclick="x()"/></svg>')).toThrow();
  expect(() => parseSvg('bad.svg', '<svg><path d="M0 0"/></svg>')).toThrow();
});

test('the lockup component draws the module and nothing of its own', () => {
  const lockup = read('web-shared/components/MetraleLockup.svelte');
  expect(lockup).toContain("import { ART } from '../brand-art.js'");
  expect(lockup).not.toMatch(/\bd="M\d/); // no path literal
  expect(lockup).not.toMatch(/#[0-9A-F]{6}\b/i); // no colour literal: the inks are the kit's, in the module
  for (const id of ['m-logo-ondark', 'm-logo-onlight', 'm-mark', 'm-compact']) expect(lockup).toContain(`id="${id}"`);
  const prime = read('site/src/lib/prime/PrimeMark.svelte');
  expect(prime).toContain('href="#m-compact"');
});

test('no stylesheet, component or page names a colour of the previous brand or any cyan', () => {
  // The kit's cyan, the previous kit's cyan bar and its violet, lavender and gold
  // inks, and the old theme-color violet. The chart series palette is data, not
  // brand, and is held by series-contrast.test.js instead.
  const banned = [brand.color.cyan, '#6FD9EC', '#5A96BD', '#49C3DB', '#CDBFF1', '#BE9DF8', '#E6DEFA', '#AE8A3F', '#EFB338', '#14111F'];
  const files = execFileSync(
    'git',
    ['ls-files', 'site/src', 'site/static/*.css', 'site/static/fonts', 'site/scripts', 'blog/src', 'web-shared', 'docs'],
    { cwd: REPO, encoding: 'utf8' }
  )
    .split('\n')
    .filter((f) => /\.(css|svelte|js|mjs|html)$/.test(f) && !f.endsWith('.test.js'));
  expect(files.length).toBeGreaterThan(100);
  const hits = [];
  for (const f of files) {
    // What is painted, not what is remembered: comments may record a past value.
    const text = read(f)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
      .toUpperCase();
    for (const hex of banned) if (text.includes(hex.toUpperCase())) hits.push(`${f}: ${hex}`);
    if (/--CH-(VIOLET|CYAN|GOLD)|--M-(INK|LAVENDER|VIOLET|CYAN|GOLD)/.test(text)) hits.push(`${f}: a retired brand token`);
  }
  expect(hits).toEqual([]);
});

test('pages link the brand files by their versioned names, and the fixed-name icons with the version query', () => {
  // A long-cached file that changes keeps being served in its old form under its old name
  // (web-shared/brand-files.mjs). Each linked file exists under its versioned name, and nothing
  // still links a plain name the kit's files used to be served under.
  // Each versioned name is a file the kit derivation writes, on the site or the blog, and it is there.
  const written = Object.keys(outputs);
  for (const name of Object.values(brandFiles)) {
    const homes = written.filter((p) => p.endsWith('/static' + name));
    expect(homes.length, name).toBeGreaterThan(0);
    for (const p of homes) expect(existsSync(join(REPO, p)), p).toBe(true);
  }
  expect(existsSync(join(REPO, 'blog/static' + brandFiles.ogImage))).toBe(true);
  for (const app of ['site/src/app.html', 'blog/src/app.html']) {
    const html = read(app);
    for (const icon of ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'])
      expect(html, `${app} ${icon}`).toContain(`/${icon}${ICON_QUERY}"`);
  }
  expect(read('site/src/app.html')).toContain(`https://metrale.ai${brandFiles.ogImage}"`);
  const files = execFileSync('git', ['ls-files', 'site/src', 'blog/src', 'site/static/site.webmanifest'], { cwd: REPO, encoding: 'utf8' })
    .split('\n')
    .filter((f) => /\.(svelte|js|mjs|html|webmanifest)$/.test(f) && !f.endsWith('.test.js'));
  const plain = /\/(og-image|icon-192|icon-512|icon-maskable-512)\.png/;
  expect(files.filter((f) => plain.test(read(f)))).toEqual([]);
});
