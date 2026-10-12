// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { BOOT_TYPE, PRELOADS_ID, deferBoot } from './defer-boot.js';

// The shape SvelteKit 2 prerenders, cut down from build/contact.html: the CSP
// meta naming the boot script's hash, a run of modulepreloads, a body, and the
// boot script at the end of it.
const BOOT = `
				{
					__sveltekit_2c8at8 = {
						base: new URL(".", location).pathname.slice(0, -1)
					};

					const element = document.currentScript.parentElement;

					Promise.all([
						import("./_app/immutable/entry/start.js"),
						import("./_app/immutable/entry/app.js")
					]).then(([kit, app]) => {
						kit.start(app, element, { node_ids: [0, 4, 13], data: [null,null,null], form: null, error: null });
					});
				}
			`;
const sha = (s) => `sha256-${createHash('sha256').update(s).digest('base64')}`;
const PRELOADS = [
  './_app/immutable/entry/start.js',
  './_app/immutable/chunks/runtime.js',
  './_app/immutable/entry/app.js',
  './_app/immutable/nodes/13.js',
];
const links = (hrefs) => hrefs.map((h) => `<link href="${h}" rel="modulepreload">`).join('\n\t\t');
const page = ({ head = links(PRELOADS), body = `<script>${BOOT}</script>` } = {}) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <script>/* theme */</script>
    <meta http-equiv="content-security-policy" content="script-src 'self' '${sha(BOOT)}'">
		${head}
		<link rel="canonical" href="https://metrale.ai/contact"/>
		<script type="application/ld+json">{"@context":"https://schema.org"}</script>
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents"><main><h1>Contact</h1></main>
			${body}
		</div>
  </body>
</html>`;

const scripts = (html) => [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].map((m) => ({ attrs: m[1], text: m[2] }));
const preloadHrefs = (html) => [...html.matchAll(/<link href="([^"]+)" rel="modulepreload">/g)].map((m) => m[1]);

test('the boot script is made inert with its bytes unchanged, so the CSP hash still names it', () => {
  const out = deferBoot(page());
  const boot = scripts(out).filter((s) => s.text.includes('__sveltekit_'));
  expect(boot).toHaveLength(1);
  expect(boot[0].attrs).toBe(` type="${BOOT_TYPE}"`);
  expect(boot[0].text).toBe(BOOT);
  expect(out).toContain(`'${sha(boot[0].text)}'`);
});

test('no other script changes: the theme script and the structured data keep running as before', () => {
  const before = scripts(page()).filter((s) => !s.text.includes('__sveltekit_'));
  const after = scripts(deferBoot(page())).filter((s) => !s.text.includes('__sveltekit_'));
  expect(after).toEqual(before);
});

test('every modulepreload moves, in order, into the template and none is left live in the head', () => {
  const out = deferBoot(page());
  const template = out.match(new RegExp(`<template id="${PRELOADS_ID}">([\\s\\S]*?)</template>`));
  expect(template).not.toBeNull();
  expect(preloadHrefs(template[1])).toEqual(PRELOADS);
  expect(preloadHrefs(out.replace(template[0], ''))).toEqual([]);
  expect(out.indexOf(template[0])).toBeLessThan(out.indexOf('</head>'));
});

test('everything outside the two rewrites is byte for byte the page SvelteKit wrote', () => {
  const html = page();
  const out = deferBoot(html);
  const undo = out
    .replace(new RegExp(`<template id="${PRELOADS_ID}">([\\s\\S]*?)</template>`), '$1')
    .replace(`<script type="${BOOT_TYPE}">`, '<script>');
  expect(undo).toBe(html.replace(/(<link href="[^"]+" rel="modulepreload">)\s*(?=<link rel="canonical")/, '$1'));
});

test('a page with no app to start is returned untouched', () => {
  const html = page({ head: '', body: '' });
  expect(deferBoot(html)).toBe(html);
});

test('a page whose shape it does not recognise stops the build instead of shipping half rewritten', () => {
  expect(() => deferBoot(page({ body: `<script>${BOOT}</script><script>${BOOT}</script>` }))).toThrow(/one SvelteKit boot script, found 2/);
  expect(() => deferBoot(page({ head: '' }))).toThrow(/boots but preloads no script/);
  expect(() => deferBoot(page({ body: '' }))).toThrow(/one SvelteKit boot script, found 0/);
  const split = `${links(PRELOADS.slice(0, 2))}\n<link rel="canonical" href="/"/>\n${links(PRELOADS.slice(2))}`;
  expect(() => deferBoot(page({ head: split }))).toThrow(/one run in the head, found 2 runs/);
  const late = page({ head: '', body: `${links(PRELOADS)}<script>${BOOT}</script>` });
  expect(() => deferBoot(late)).toThrow(/not in the head/);
});
