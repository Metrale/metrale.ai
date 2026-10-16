// SPDX-License-Identifier: AGPL-3.0-only
//
// The bench/battles.toml reader behind gen-gates.mjs#battles. A battle read
// wrongly moves a gate into the wrong scoreboard or judges it in the wrong
// direction, so every malformed shape the engine's reader refuses is refused
// here too, and the reader is cross-checked against Bun's own TOML parser on a
// file in the engine's layout (multi-line inline-table arrays, comments).

import { describe, expect, test } from 'bun:test';
import { battlesOf, patternProblem } from '../../scripts/lib/battles.mjs';
import { parseToml } from '../../scripts/lib/bench-toml.mjs';

const FILE = `# a comment
schema = 1

[[battles]]
id = "ttft-battle"
name = "TTFT battle"
gate_prefixes = ["ttft-cold-", "ttft-warm-"]
metrics = [
  { pattern = "median_ms", better = "lower" },
  { pattern = "median_ms_{n}", better = "lower" },
]
note = "Time to first token."

[[battles]]
id = "decode-battle"
name = "Decode battle"
gate_prefixes = ["concurrency-sweep"]
metrics = [{ pattern = "c{n}_aggregate_tok_s", better = "higher" }]
# a comment between keys
note = "Aggregate decode throughput."
`;

const battle = (over) => ({
  id: 'b',
  name: 'B',
  gate_prefixes: ['x-'],
  metrics: [{ pattern: 'm_{n}', better: 'lower' }],
  ...over,
});
const file = (...battles) => ({ schema: 1, battles });

describe('a well-formed file', () => {
  test('reads the same through the site parser as through Bun.TOML', () => {
    expect(battlesOf(parseToml(FILE))).toEqual(battlesOf(Bun.TOML.parse(FILE)));
  });

  test('carries id, name, prefixes, metric rules and note in file order', () => {
    expect(battlesOf(parseToml(FILE))).toEqual([
      {
        id: 'ttft-battle',
        name: 'TTFT battle',
        gate_prefixes: ['ttft-cold-', 'ttft-warm-'],
        metrics: [
          { pattern: 'median_ms', better: 'lower' },
          { pattern: 'median_ms_{n}', better: 'lower' },
        ],
        note: 'Time to first token.',
      },
      {
        id: 'decode-battle',
        name: 'Decode battle',
        gate_prefixes: ['concurrency-sweep'],
        metrics: [{ pattern: 'c{n}_aggregate_tok_s', better: 'higher' }],
        note: 'Aggregate decode throughput.',
      },
    ]);
  });

  test('an absent note reads as empty, not undefined', () => {
    expect(battlesOf(file(battle({})))[0].note).toBe('');
  });
});

describe('a malformed file is refused', () => {
  test.each([
    ['another schema', { schema: 2, battles: [battle({})] }, /schema is 2/],
    ['no battles', { schema: 1, battles: [] }, /declares no \[\[battles\]\]/],
    ['a battle that is not a table', file('b'), /battle 0 is not a table/],
    ['no id', file(battle({ id: '' })), /lacks an id or a name/],
    ['no name', file(battle({ name: undefined })), /lacks an id or a name/],
    ['an id twice', file(battle({}), battle({})), /declared twice/],
    ['no prefixes', file(battle({ gate_prefixes: [] })), /gate_prefixes/],
    ['an empty prefix (it would claim every gate)', file(battle({ gate_prefixes: [''] })), /gate_prefixes/],
    ['no metrics', file(battle({ metrics: [] })), /declares no metrics/],
    ['a metric that is not a table', file(battle({ metrics: ['m'] })), /not a table/],
    ['an unknown direction', file(battle({ metrics: [{ pattern: 'm', better: 'up' }] })), /neither lower nor higher/],
    ['two {n} in a pattern', file(battle({ metrics: [{ pattern: 'c{n}_{n}', better: 'lower' }] })), /one \{n\}/],
    ['a note that is not text', file(battle({ note: 3 })), /note is not a string/],
  ])('%s', (_, parsed, message) => {
    expect(() => battlesOf(parsed)).toThrow(message);
  });

  test('CONTROL: the same shapes with the fault removed read', () => {
    expect(battlesOf(file(battle({}), battle({ id: 'c', note: 'n' })))).toHaveLength(2);
  });
});

describe('a metric pattern', () => {
  test.each([
    ['median_ms', null],
    ['median_ms_{n}', null],
    ['c{n}_aggregate_tok_s', null],
    ['', 'an empty metric pattern'],
    ['m_{n}_{n}', 'may hold one {n}'],
    ['m_{x}', 'may hold one {n}'],
    ['m_}', 'may hold one {n}'],
  ])('%s', (pattern, problem) => {
    const got = patternProblem(pattern);
    if (problem === null) expect(got).toBeNull();
    else expect(got).toContain(problem);
  });
});
