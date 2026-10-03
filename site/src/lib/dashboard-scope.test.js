// SPDX-License-Identifier: AGPL-3.0-only
//
// The dashboard's scope rules, on the published records (gates.generated.json)
// and the generated model list, plus mutated copies where a rule needs a case
// the data does not have yet (a second hardware class, a record with no class).
import { describe, expect, test } from 'bun:test';
import gates from './gates.generated.json';
import vendors from './models.generated.json';
import { flagshipRecipe } from './data.js';
import { SUBJECTS } from './concurrency-subjects.js';
import { recordsFor, tabs } from './gates.js';
import {
  ALL_MODELS,
  classOf,
  flagshipModelOf,
  inScope,
  resolveScope,
  scopeOptions,
  scopedRecordsFor,
  subjectsInScope,
  tabsInScope,
} from './dashboard-scope.js';

const rec = (over) => ({ benchmark_id: 'bfcl-subset', target_model: 'm/a', perf_class: 'gb10@spark-28c2', ...over });
const allRecords = Object.values(gates.benchmarks).flatMap((b) => b.records);
const FLAGSHIP = flagshipModelOf(vendors, flagshipRecipe);
const SUBJECT_TABS = ['concurrency', 'cost'];
const TAB_BENCHES = tabs.flatMap((t) => t.benches);
const drawn = allRecords.filter((r) => TAB_BENCHES.includes(r.benchmark_id));

describe('the options come from the records', () => {
  const opts = scopeOptions(gates.benchmarks, TAB_BENCHES);

  test('every class and model listed has a drawn record, and every drawn record is listed', () => {
    expect(opts.classes.length).toBeGreaterThan(0);
    for (const cls of opts.classes)
      for (const m of opts.modelsByClass[cls]) expect(drawn.some((r) => classOf(r) === cls && r.target_model === m)).toBe(true);
    for (const r of drawn) expect(opts.modelsByClass[classOf(r)]).toContain(r.target_model);
  });

  test('a model whose records are all on a bench with no tab is not offered (unsloth/Qwen3.6-27B-NVFP4: video-fidelity only)', () => {
    expect(allRecords.some((r) => r.target_model === 'unsloth/Qwen3.6-27B-NVFP4')).toBe(true);
    expect(opts.modelsByClass.gb10).not.toContain('unsloth/Qwen3.6-27B-NVFP4');
    // control: counting every bench would offer it
    expect(scopeOptions(gates.benchmarks, Object.keys(gates.benchmarks)).modelsByClass.gb10).toContain('unsloth/Qwen3.6-27B-NVFP4');
  });

  test('GB10 is the only class with records today', () => {
    expect(opts.classes).toEqual(['gb10']);
  });

  test('a class appears only with a record, and a record without a class names none', () => {
    const b = {
      x: { records: [rec({}), rec({ perf_class: 'h100@box', target_model: 'm/b' }), rec({ perf_class: undefined, target_model: 'm/c' })] },
    };
    expect(scopeOptions(b, ['x'])).toEqual({ classes: ['gb10', 'h100'], modelsByClass: { gb10: ['m/a'], h100: ['m/b'] } });
    expect(classOf({ perf_class: '' })).toBeNull();
  });
});

describe('the default is the flagship', () => {
  test("the flagship recipe's checkpoint, and it has records on GB10", () => {
    expect(FLAGSHIP).toBe('Qwen/Qwen3.6-35B-A3B-FP8');
    expect(resolveScope({ hw: null, model: null }, scopeOptions(gates.benchmarks, TAB_BENCHES), FLAGSHIP)).toEqual({
      hw: 'gb10',
      model: FLAGSHIP,
    });
  });

  test('an unknown recipe is refused, not defaulted', () => {
    expect(() => flagshipModelOf(vendors, 'no-such-recipe')).toThrow(/not in models.generated.json/);
  });
});

describe('resolveScope', () => {
  const opts = { classes: ['gb10', 'h100'], modelsByClass: { gb10: ['m/a', 'm/f'], h100: ['m/b'] } };

  test('a known pair stands, and "all" stands on any class', () => {
    expect(resolveScope({ hw: 'h100', model: 'm/b' }, opts, 'm/f')).toEqual({ hw: 'h100', model: 'm/b' });
    expect(resolveScope({ hw: 'h100', model: ALL_MODELS }, opts, 'm/f')).toEqual({ hw: 'h100', model: ALL_MODELS });
  });

  test('an unknown class lands on the first; a model with no record on the class lands on the flagship', () => {
    expect(resolveScope({ hw: 'tpu', model: 'm/a' }, opts, 'm/f')).toEqual({ hw: 'gb10', model: 'm/a' });
    expect(resolveScope({ hw: 'gb10', model: 'm/b' }, opts, 'm/f')).toEqual({ hw: 'gb10', model: 'm/f' });
  });

  test('when the flagship has no record on the class, every model is shown rather than an empty page', () => {
    expect(resolveScope({ hw: 'h100', model: null }, opts, 'm/f')).toEqual({ hw: 'h100', model: ALL_MODELS });
  });

  test('no classes at all: no class, every model', () => {
    expect(resolveScope({ hw: 'gb10', model: 'm/a' }, { classes: [], modelsByClass: {} }, 'm/f')).toEqual({ hw: null, model: ALL_MODELS });
  });
});

describe('what a scope keeps', () => {
  test('a record is in scope on its class and model; "all" keeps every model of the class', () => {
    expect(inScope(rec({}), { hw: 'gb10', model: 'm/a' })).toBe(true);
    expect(inScope(rec({}), { hw: 'gb10', model: 'm/b' })).toBe(false);
    expect(inScope(rec({}), { hw: 'h100', model: ALL_MODELS })).toBe(false);
    expect(inScope(rec({ perf_class: undefined }), { hw: 'gb10', model: ALL_MODELS })).toBe(false);
    expect(inScope(rec({}), { hw: 'gb10', model: ALL_MODELS })).toBe(true);
  });

  test('scoped records on the real data: the flagship keeps only its own', () => {
    const scoped = scopedRecordsFor(recordsFor, { hw: 'gb10', model: FLAGSHIP });
    const kept = tabs.flatMap((t) => t.benches.flatMap((b) => scoped(b)));
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.every((r) => r.target_model === FLAGSHIP)).toBe(true);
  });

  test('subjects follow the model: the flagship has the MoE subject, the 27B has two, "all" has every one', () => {
    expect(subjectsInScope(SUBJECTS, { model: FLAGSHIP }).map((s) => s.id)).toEqual(['qwen36-35b-a3b']);
    expect(subjectsInScope(SUBJECTS, { model: 'unsloth/Qwen3.8-27B-NVFP4' }).map((s) => s.id)).toEqual(['qwen38-27b', 'qwen38-27b-dflash']);
    expect(subjectsInScope(SUBJECTS, { model: ALL_MODELS })).toBe(SUBJECTS);
  });
});

describe('tabsInScope', () => {
  const ctx = { recordsFor, subjects: SUBJECTS, subjectTabIds: SUBJECT_TABS };

  test('every tab for every model', () => {
    expect(tabsInScope(tabs, { hw: 'gb10', model: ALL_MODELS }, ctx)).toEqual(tabs);
  });

  test('a model sees only the tabs where it has records, and the subject tabs only with a subject', () => {
    for (const model of scopeOptions(gates.benchmarks, TAB_BENCHES).modelsByClass.gb10) {
      const scope = { hw: 'gb10', model };
      const got = tabsInScope(tabs, scope, ctx).map((t) => t.id);
      for (const t of tabs) {
        const want = SUBJECT_TABS.includes(t.id)
          ? SUBJECTS.some((s) => s.checkpoint === model)
          : t.benches.some((b) => recordsFor(b).some((r) => inScope(r, scope)));
        expect(got.includes(t.id)).toBe(want);
      }
    }
  });

  test('a model without a subject has no Concurrency or Cost tab', () => {
    const scope = { hw: 'gb10', model: 'm/no-subject' };
    const fake = (b) => (b === 'bfcl-subset' ? [rec({ target_model: 'm/no-subject' })] : []);
    const ids = tabsInScope(tabs, scope, { ...ctx, recordsFor: fake }).map((t) => t.id);
    expect(ids).toEqual(['bfcl']);
  });

  test('a class with no records has no tabs', () => {
    expect(tabsInScope(tabs, { hw: 'h100', model: ALL_MODELS }, { ...ctx, subjects: [] })).toEqual([]);
  });
});
