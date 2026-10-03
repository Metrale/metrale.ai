// SPDX-License-Identifier: AGPL-3.0-only
//
// The landing commit of every committed gate record: the parser on text the
// git call produces, and the generated data on every published record.
import { describe, expect, test } from 'bun:test';
import { parseRecordLanding } from '../../scripts/lib/record-landing.mjs';
import gates from './gates.generated.json';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);

describe('parseRecordLanding', () => {
  test('maps each added record to its commit, PR number and date; .sig files are not records', () => {
    const log = [
      `@${A}\t1790900000\tBatch: five things (#67)`,
      '',
      '.benchmarks/ttft-cold-gate/2026-10-01-b32255fa42.json',
      '.benchmarks/ttft-cold-gate/2026-10-01-b32255fa42.json.sig',
      `@${B}\t1790800000\tMerge pull request #12 from Metrale/x`,
      '',
      '.benchmarks/decode-floor/2026-09-24-a6d711dc0e.json',
    ].join('\n');
    const m = parseRecordLanding(log);
    expect([...m.keys()]).toEqual([
      '.benchmarks/ttft-cold-gate/2026-10-01-b32255fa42.json',
      '.benchmarks/decode-floor/2026-09-24-a6d711dc0e.json',
    ]);
    expect(m.get('.benchmarks/ttft-cold-gate/2026-10-01-b32255fa42.json')).toEqual({ sha: A, committed_at: 1790900000, pr: 67 });
    expect(m.get('.benchmarks/decode-floor/2026-09-24-a6d711dc0e.json').pr).toBe(12);
  });

  test('the newest add wins (an older add was followed by a delete); no PR number is null', () => {
    const p = '.benchmarks/x/2026-09-30-0000000000.json';
    const m = parseRecordLanding([`@${A}\t2\tre-add without a PR`, p, `@${B}\t1\tfirst add (#3)`, p].join('\n'));
    expect(m.get(p)).toEqual({ sha: A, committed_at: 2, pr: null });
  });

  test('empty or junk input lands nothing', () => {
    expect(parseRecordLanding('').size).toBe(0);
    expect(parseRecordLanding('.benchmarks/x/y.json\nnot a header').size).toBe(0);
  });
});

// ★ THE OWNER'S REPORT, 2026-10-03: every data point's card read "commit history
// unavailable". Every published record that is committed on the engine's main
// must name the commit that landed it, and be in the dashboard's history.
describe('every published data point has commit history', () => {
  const committed = Object.values(gates.benchmarks)
    .flatMap((b) => b.records)
    .filter((r) => !r.branch);

  test('there are committed records to check', () => {
    expect(committed.length).toBe(gates.sources.committed);
    expect(committed.length).toBeGreaterThan(0);
  });

  test('each names its landing commit and is in the dashboard history', () => {
    const missing = committed
      .filter((r) => !/^[0-9a-f]{40}$/.test(r.landed?.sha ?? '') || r.generated_ancestry !== 'yes')
      .map((r) => r.path);
    expect(missing).toEqual([]);
  });

  test('no data point, committed or from a branch, has an unknown commit', () => {
    const all = Object.values(gates.benchmarks).flatMap((b) => b.records);
    expect(all.filter((r) => r.generated_ancestry === 'unknown').map((r) => r.path)).toEqual([]);
  });

  test('a landing commit is never older than the measurement it lands', () => {
    for (const r of committed) expect(r.landed.committed_at).toBeGreaterThanOrEqual(r.recorded_at);
  });
});
