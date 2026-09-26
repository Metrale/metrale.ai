// SPDX-License-Identifier: AGPL-3.0-only
//
// The lower half of /engine: the copy it prints and the commands it hands out.
//
// Two things here break silently. The voice rules at the top of data.js are
// enforced on content/ by site.test.js and on nothing else, so the developer
// page's copy could drift back to em dashes and colons with every test green.
// And the install and run instructions restate another repository's README
// and installer. The note above `flagshipRecipe` says a constant cannot span
// repositories, but a test can read the registry checkout the build already
// needs: METRALE_RECIPES_ROOT is its recipes/ directory, so its parent is the
// registry, the same resolution scripts/check-flagship.mjs uses.
import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  CLI,
  community,
  contribute,
  faq,
  flagshipRecipe,
  getRunning,
  models,
  powershellInstallerUrl,
  quickInstall,
  roadmap,
  runCommand,
  runCommandRaw,
  stars,
} from './data.js';

const BLOCKS = { models, getRunning, stars, community, contribute, roadmap, faq };

/** Every string a block would print, paired with its path for the message. */
function strings(value, path = []) {
  if (typeof value === 'string') return [[path.join('.'), value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, [...path, i]));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => strings(v, [...path, k]));
  return [];
}
const all = Object.entries(BLOCKS).flatMap(([name, block]) => strings(block, [name]));
// The commands Get running hands out. Scoped to that block: `models.columns.command`
// is a column heading, not a command.
const commands = all.filter(([p]) => p.startsWith('getRunning.') && /\.command$/.test(p));
// Keys whose value is a command, an address or a hook, not prose.
const prose = all.filter(([p]) => !/(^|\.)(command|url|icon|tone)$/.test(p));

test('the blocks are populated, so the loops below are not vacuous', () => {
  expect(prose.length).toBeGreaterThan(80);
  expect(commands.length).toBeGreaterThanOrEqual(5);
  expect(faq.items.length).toBeGreaterThanOrEqual(9);
});

test('visible copy keeps the voice: no em dashes, colons, semicolons or exclamation marks', () => {
  for (const [path, s] of prose) {
    expect(s, `${path}: "${s}"`).not.toMatch(/[—;!]/);
    // A colon is allowed only inside an address.
    expect(s.replace(/https?:\/\/\S+/g, ''), `${path}: "${s}"`).not.toMatch(/:/);
  }
});

// What the old story must NOT say is content/licence.test.js's job, over every
// source file. This holds what the new story MUST say, where it is printed.
test('the licence is stated verbatim, and the engine has one tier', () => {
  expect(contribute.licence).toBe('Dual licensed under MIT OR Apache-2.0, at your option.');
  expect(contribute.licences.map((l) => l.text)).toEqual(['MIT', 'Apache-2.0']);
  const licence = faq.items.find((i) => /licence|license/i.test(i.q));
  expect(licence.a).toContain('MIT OR Apache-2.0, at your option');
  const tier = faq.items.find((i) => /paid tier/i.test(i.q));
  expect(tier.a).toMatch(/^No\. There is one engine and one licence/);
});

test('no FAQ answer carries a hand typed performance figure', () => {
  for (const item of faq.items) expect(item.a, item.q).not.toMatch(/\d+(\.\d+)?\s*[x×]\b|tok\/s|\bms\b|\d+\s*%/);
});

// The box is named in full ("DGX Spark"); its bare plural is derived from that name.
const BOX_PLURAL = new RegExp(`\\bGB10s\\b|\\b${'DGX Spark'.split(' ')[1]}s\\b`);

test('every hardware name is written in full', () => {
  for (const [path, s] of prose) expect(s, `${path}: "${s}"`).not.toMatch(BOX_PLURAL);
});

// --- lockstep with the registry -------------------------------------------

const RECIPES = process.env.METRALE_RECIPES_ROOT;
const registry = RECIPES ? dirname(resolve(RECIPES)) : null;
const registryFile = (rel) => {
  if (!registry)
    throw new Error('METRALE_RECIPES_ROOT is not set. Point it at the recipes/ directory of a registry checkout (site/AGENTS.md).');
  const path = resolve(registry, rel);
  if (!existsSync(path))
    throw new Error(`${path} is missing. METRALE_RECIPES_ROOT must be the recipes/ directory of a full registry checkout.`);
  return readFileSync(path, 'utf8');
};

test('every command the page hands out is one the launcher README documents', () => {
  const readme = registryFile('README.md');
  const documented = [runCommand, quickInstall, runCommandRaw, `${CLI} doctor`, `${CLI} run ${flagshipRecipe} --print`, `uvx ${CLI} list`];
  for (const cmd of documented) expect(readme, cmd).toContain(cmd);
  for (const [path, cmd] of commands) expect(readme, `${path}: ${cmd}`).toContain(cmd);
  // The Windows line the FAQ prints, exactly as the README prints it.
  expect(readme).toContain(`irm ${powershellInstallerUrl} | iex`);
  expect(faq.items.find((i) => /install/i.test(i.q)).a).toContain(`irm ${powershellInstallerUrl} | iex`);
});

test('what the page says the installer does, the installer does', () => {
  const sh = registryFile('scripts/install.sh');
  const claims = getRunning.installer.items.join(' ') + ' ' + getRunning.steps[0].note;
  expect(claims).toContain('SHA256SUMS');
  expect(sh).toContain('SHA256SUMS');
  expect(sh).toContain('$HOME/.local/bin');
  expect(claims).toContain('~/.local/bin');
  expect(sh).toContain('METRALECTL_NO_AGENT');
  expect(claims).toContain('METRALECTL_NO_AGENT=1');
  expect(sh).toContain('--uninstall');
  expect(claims).toContain('--uninstall');
  expect(sh).toMatch(/agent install/);
  const ps = registryFile('scripts/install.ps1');
  expect(ps).toMatch(/LOCALAPPDATA/);
  expect(claims).toContain(`%LOCALAPPDATA%\\Programs\\${CLI}`);
});
