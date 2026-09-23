// The roles file is data that ships. These tests read the real file the way the
// generator does, so a bad line fails here before it fails the build, and they
// pin the rules of the filter the careers page uses.
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATUSES, filterPositions, parsePositions, statusLabel, teamsOf } from './positions.js';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, 'positions.jsonl'), 'utf8');
const generated = JSON.parse(readFileSync(resolve(here, '..', 'positions.generated.json'), 'utf8'));

describe('positions.jsonl', () => {
  test('every line is a role with every field', () => {
    const roles = parsePositions(source);
    expect(roles.length).toBeGreaterThan(0);
    for (const r of roles) {
      expect(r.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(STATUSES).toContain(r.status);
      expect(r.does.length).toBeGreaterThan(0);
      expect(r.requirements.length).toBeGreaterThan(0);
    }
  });

  test('the generated file is the file as committed', () => {
    // The build regenerates it; a stale copy means someone edited the JSONL and
    // did not run `node scripts/gen-positions.mjs` (or a build).
    expect(generated.positions).toEqual(parsePositions(source));
  });

  test('no role claims a search is open unless its status says so', () => {
    for (const r of parsePositions(source)) {
      if (r.status !== 'open') expect(`${r.title} ${r.summary}`.toLowerCase()).not.toMatch(/\bopening\b|\bnow hiring\b/);
    }
  });
});

describe('parsePositions', () => {
  const good = (over = {}) =>
    JSON.stringify({
      id: 'a-role',
      title: 'A role',
      team: 'Engine',
      location: 'Anywhere',
      status: 'planned',
      summary: 'One paragraph.',
      does: ['One thing'],
      requirements: ['One thing'],
      ...over,
    });

  test('accepts a good line and skips blank ones', () => {
    expect(parsePositions(`\n${good()}\n\n`).length).toBe(1);
  });
  test('names the line of a bad one', () => {
    expect(() => parsePositions(`${good()}\nnot json`)).toThrow(/line 2/);
    expect(() => parsePositions(good({ status: 'maybe' }))).toThrow(/status/);
    expect(() => parsePositions(good({ extra: 1 }))).toThrow(/unknown field/);
    expect(() => parsePositions(good({ id: 'Not A Slug' }))).toThrow(/slug/);
    expect(() => parsePositions(`${good()}\n${good()}`)).toThrow(/twice/);
    expect(() => parsePositions(good({ requirements: [] }))).toThrow(/requirements/);
  });
});

describe('filterPositions', () => {
  const roles = parsePositions(source);
  test('an empty search and "All" match every role', () => {
    expect(filterPositions(roles, {}).length).toBe(roles.length);
  });
  test('a team narrows to that team', () => {
    const [team] = teamsOf(roles);
    for (const r of filterPositions(roles, { team })) expect(r.team).toBe(team);
    expect(filterPositions(roles, { team }).length).toBeGreaterThan(0);
  });
  test('every word of the search has to appear somewhere the reader can see', () => {
    const first = roles[0];
    const word = first.requirements[0].split(' ')[0];
    expect(filterPositions(roles, { q: word.toUpperCase() }).map((r) => r.id)).toContain(first.id);
    expect(filterPositions(roles, { q: 'zzzz-no-such-word' })).toEqual([]);
  });
  test('statuses have plain labels', () => {
    for (const s of STATUSES) expect(statusLabel(s)).toMatch(/^[A-Z][a-z]+$/);
  });
});
