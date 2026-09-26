// SPDX-License-Identifier: AGPL-3.0-only
//
// The limit ledger folds what git can see into what earlier builds recorded.
// The engine's history may be one commit: every test here gives the fold
// exactly that, one observation per file, and asserts the ledger keeps every
// dated entry it already had.
import { describe, expect, test } from 'bun:test';
import { cleanLedger, foldLedger } from '../../scripts/lib/limit-ledger.mjs';

const GATE = 'ttft-warm-gate';
const CK = 'Qwen/Qwen3.6-35B-A3B-FP8';
const table = (bounds) => ({ [GATE]: { [CK]: { median_ms: bounds } } });
const series = (ledger, bound = 'max') => ledger[GATE]?.[CK]?.median_ms?.[bound];

// Two ceilings an earlier build recorded, the second a ratchet.
const PRIOR = table({
  max: [
    { since: 100, value: 400 },
    { since: 200, value: 250 },
  ],
});
// The single commit of a squashed history, dated after both.
const SQUASHED = 900;

describe('one commit of history', () => {
  test('the ledger keeps both prior entries when the one commit carries the current value', () => {
    const out = foldLedger(PRIOR, [{ table: table({ max: 250 }), since: SQUASHED }], table({ max: 250 }), SQUASHED);
    expect(series(out)).toEqual([
      { since: 100, value: 400 },
      { since: 200, value: 250 },
    ]);
  });

  test('a new value in that commit is appended on its date, the history before it kept', () => {
    const out = foldLedger(PRIOR, [{ table: table({ max: 210 }), since: SQUASHED }], table({ max: 210 }), SQUASHED);
    expect(series(out)).toEqual([
      { since: 100, value: 400 },
      { since: 200, value: 250 },
      { since: SQUASHED, value: 210 },
    ]);
  });

  test('a bound the commit no longer declares is withdrawn from then on, not erased', () => {
    const out = foldLedger(PRIOR, [{ table: table({ min: 5 }), since: SQUASHED }], table({ min: 5 }), SQUASHED);
    expect(series(out)).toEqual([
      { since: 100, value: 400 },
      { since: 200, value: 250 },
      { since: SQUASHED, value: null },
    ]);
    expect(series(out, 'min')).toEqual([{ since: SQUASHED, value: 5 }]);
  });

  test('NEGATIVE CONTROL: with no prior ledger the same commit yields one entry — the memory is the prior file', () => {
    const out = foldLedger({}, [{ table: table({ max: 250 }), since: SQUASHED }], table({ max: 250 }), SQUASHED);
    expect(series(out)).toEqual([{ since: SQUASHED, value: 250 }]);
  });
});

describe('the fold', () => {
  test('observations out of order are sorted, and a run of one value keeps its earliest date', () => {
    const obs = [
      { table: table({ max: 300 }), since: 50 },
      { table: table({ max: 250 }), since: 400 },
      { table: table({ max: 300 }), since: 30 },
    ];
    const out = foldLedger(PRIOR, obs, table({ max: 250 }), 400);
    expect(series(out)).toEqual([
      { since: 30, value: 300 },
      { since: 100, value: 400 },
      { since: 200, value: 250 },
    ]);
  });

  test('the prior ledger is not mutated', () => {
    const prior = structuredClone(PRIOR);
    foldLedger(prior, [{ table: table({ max: 210 }), since: SQUASHED }], table({ max: 210 }), SQUASHED);
    expect(prior).toEqual(PRIOR);
  });
});

describe('cleanLedger', () => {
  test('keeps well-formed entries and drops ones that could invent a date or a value', () => {
    const dirty = table({
      max: [{ since: 100, value: 400 }, { since: 'x', value: 1 }, { since: 150, value: 'high' }, { since: 200, value: null }, null],
      min: 'not a series',
    });
    expect(cleanLedger(dirty)).toEqual(
      table({
        max: [
          { since: 100, value: 400 },
          { since: 200, value: null },
        ],
      })
    );
  });

  test('absent or malformed input is an empty ledger', () => {
    expect(cleanLedger(undefined)).toEqual({});
    expect(cleanLedger({ g: null })).toEqual({});
  });
});
