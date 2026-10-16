// SPDX-License-Identifier: AGPL-3.0-only
//
// The BENCH.toml reader behind gen-gates.mjs#gate_context: the context a gate
// serves and the vLLM figure it declares. A context read wrongly moves a cell
// to another row, and a target dropped silently reads as "vLLM not measured",
// so every malformed shape is refused, and the reader is cross-checked against
// Bun's own TOML parser on every real kernels/gb10/*/BENCH.toml.

import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { declaredContextOf, mergeDeclaredContext } from '../../scripts/lib/bench-context.mjs';
import { parseToml } from '../../scripts/lib/bench-toml.mjs';
import { engineRoot } from '../../scripts/lib/engine-root.mjs';

const entry = (over) => ({ gate: 'ttft-cold-x', checkpoint: 'org/x', ...over });

describe('one entry', () => {
  test('context and targets are carried as numbers; absent ones are null and empty', () => {
    const got = declaredContextOf(
      {
        benchmarks: [
          entry({ label: 'x at 64k', serve_overrides: { max_model_len: '65536' }, targets: { median_ms_256: 488 } }),
          entry({ gate: 'ttft-warm-x' }),
        ],
      },
      'x'
    );
    expect(got).toEqual({
      'ttft-cold-x': {
        'org/x': {
          model: 'x',
          label: 'x at 64k',
          max_model_len: 65536,
          targets: { median_ms_256: 488 },
          target_context: null,
          note: null,
          caveats: {},
        },
      },
      'ttft-warm-x': {
        'org/x': { model: 'x', label: null, max_model_len: null, targets: {}, target_context: null, note: null, caveats: {} },
      },
    });
  });

  test('a caveat is carried beside its target with the note it points to; CONTROL: no caveat, neither carried', () => {
    const flagged = declaredContextOf(
      { benchmarks: [entry({ note: 'the account', targets: { c16: 115.73 }, target_caveats: { c16: 'likely vLLM stall' } })] },
      'x'
    )['ttft-cold-x']['org/x'];
    expect([flagged.note, flagged.caveats]).toEqual(['the account', { c16: 'likely vLLM stall' }]);
    const plain = declaredContextOf({ benchmarks: [entry({ note: 'the account', targets: { c16: 115.73 } })] }, 'x')['ttft-cold-x'][
      'org/x'
    ];
    expect([plain.note, plain.caveats]).toEqual([null, {}]);
  });

  test('the reference serve context is carried as a number; CONTROL: absent, it is null', () => {
    const at = (over) => declaredContextOf({ benchmarks: [entry({ targets: { c16: 1 }, ...over })] }, 'x')['ttft-cold-x']['org/x'];
    expect(at({ target_max_model_len: 262144 }).target_context).toBe(262144);
    expect(at({}).target_context).toBeNull();
  });

  test('serve_overrides without max_model_len serves the recipe context', () => {
    const got = declaredContextOf({ benchmarks: [entry({ serve_overrides: { kv_cache_dtype: 'fp8' } })] }, 'x');
    expect(got['ttft-cold-x']['org/x'].max_model_len).toBeNull();
  });

  test.each([
    ['a context that is not a digit string', { serve_overrides: { max_model_len: 65536 } }],
    ['a context with a unit', { serve_overrides: { max_model_len: '64k' } }],
    ['a zero-led context', { serve_overrides: { max_model_len: '065536' } }],
    ['targets that are not a table', { targets: 488 }],
    ['a target that is a string', { targets: { median_ms_256: '488' } }],
    ['a target that is not finite', { targets: { median_ms_256: Infinity } }],
    ['a label that is not a string', { label: 3 }],
    ['an entry with no checkpoint', { checkpoint: undefined }],
    ['a note that is not a string', { note: 3 }],
    ['caveats that are not a table', { note: 'n', targets: { c16: 1 }, target_caveats: 'stall' }],
    ['a caveat naming no target', { note: 'n', targets: { c16: 1 }, target_caveats: { c8: 'stall' } }],
    ['a caveat naming an inherited key', { note: 'n', targets: { c16: 1 }, target_caveats: { toString: 'stall' } }],
    ['an empty caveat', { note: 'n', targets: { c16: 1 }, target_caveats: { c16: ' ' } }],
    ['a caveat with no note to point to', { targets: { c16: 1 }, target_caveats: { c16: 'stall' } }],
    ['a caveat whose note is blank', { note: '  ', targets: { c16: 1 }, target_caveats: { c16: 'stall' } }],
    ['a reference context with no targets', { target_max_model_len: 262144 }],
    ['a reference context of zero', { targets: { c16: 1 }, target_max_model_len: 0 }],
    ['a negative reference context', { targets: { c16: 1 }, target_max_model_len: -1 }],
    ['a fractional reference context', { targets: { c16: 1 }, target_max_model_len: 1.5 }],
    ['a reference context as a string', { targets: { c16: 1 }, target_max_model_len: '262144' }],
  ])('refuses %s', (_, over) => {
    expect(() => declaredContextOf({ benchmarks: [entry(over)] }, 'x')).toThrow(TypeError);
  });

  test('the same (gate, checkpoint) twice in one file is refused; CONTROL: another checkpoint is not', () => {
    expect(() => declaredContextOf({ benchmarks: [entry(), entry()] }, 'x')).toThrow(/twice/);
    expect(() => declaredContextOf({ benchmarks: [entry(), entry({ checkpoint: 'org/y' })] }, 'x')).not.toThrow();
  });

  test('the same (gate, checkpoint) in two files is refused; CONTROL: the same gate for another checkpoint merges', () => {
    const a = declaredContextOf({ benchmarks: [entry()] }, 'x');
    const b = declaredContextOf({ benchmarks: [entry()] }, 'y');
    const c = declaredContextOf({ benchmarks: [entry({ checkpoint: 'org/y' })] }, 'y');
    expect(() =>
      mergeDeclaredContext([
        ['a', a],
        ['b', b],
      ])
    ).toThrow(/already declared/);
    expect(
      Object.keys(
        mergeDeclaredContext([
          ['a', a],
          ['c', c],
        ])['ttft-cold-x']
      )
    ).toEqual(['org/x', 'org/y']);
  });
});

describe('every real BENCH.toml', () => {
  const KERNELS = `${engineRoot()}/kernels/gb10/`;
  const files = readdirSync(KERNELS)
    .map((d) => [d, `${KERNELS}${d}/BENCH.toml`])
    .filter(([, p]) => {
      try {
        readFileSync(p);
        return true;
      } catch {
        return false;
      }
    });

  test('there are files to read', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test.each(files)('%s reads the same through the site parser as through Bun.TOML', (model, path) => {
    const text = readFileSync(path, 'utf8');
    expect(declaredContextOf(parseToml(text), model, path)).toEqual(declaredContextOf(Bun.TOML.parse(text), model, path));
  });

  test('all files merge without a duplicate (gate, checkpoint)', () => {
    const tables = files.map(([model, path]) => [path, declaredContextOf(parseToml(readFileSync(path, 'utf8')), model, path)]);
    expect(() => mergeDeclaredContext(tables)).not.toThrow();
  });
});
