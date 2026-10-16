// SPDX-License-Identifier: AGPL-3.0-only
//
// target-render.test.js — what the battle panel and the context grid PRINT
// about a vLLM target that is not a clean bar, rendered from BENCH.toml text
// through the same reader gen-gates.mjs uses (bench-context.mjs).
//
//   - a flagged target (`target_caveats`) is never printed bare: its cell
//     carries a visible "† <caveat>" mark that links to the entry's target_note,
//     and that note reaches the page verbatim, while the engineering `note`
//     never does;
//   - a row served at another context than the vLLM serve behind its targets
//     (`target_max_model_len`) says so, and the row AT that context says
//     nothing; the verdict stays on every row.
//
// Rendered, not read from the grid's data: these are claims about the page.
// The two caveat assertions are independent: a target_note dropped from the TOML is
// refused by the reader (both fail), a mark dropped from a component fails
// only the mark. The plugin is scoped to THIS file's imports, like
// chart-nested-interactive.test.js.
import { describe, expect, test } from 'bun:test';
import { plugin } from 'bun';
import { compile } from 'svelte/compiler';
import { readFileSync } from 'node:fs';
import { battleSections } from './battle-grid.js';
import { contextSections } from './context-grid.js';
import { declaredLimit, limitFor, violationOf } from './gate-limits.js';
import { kindOf } from './gates.js';
import { noteId } from './target-notes.js';
import { declaredContextOf } from '../../scripts/lib/bench-context.mjs';
import { parseToml } from '../../scripts/lib/bench-toml.mjs';

plugin({
  name: 'target-render-ssr',
  setup(build) {
    build.onLoad({ filter: /\.svelte$/ }, (a) => ({
      contents: compile(readFileSync(a.path, 'utf8'), { filename: a.path, generate: 'server' }).js.code,
      loader: 'js',
    }));
  },
});

const { render } = await import('svelte/server');
const BattlePanel = (await import('./components/BattlePanel.svelte')).default;
const ContextGrid = (await import('./components/ContextGrid.svelte')).default;

const GLM = 'org/GLM-Flash';
const NOTE =
  'The C=16 target, 115.73, is a single sample of that run and most likely a stalled vLLM rep. ' +
  'Those reps come from another instrument, are not comparable with this one and are not a target. ' +
  'Against a non-stalled vLLM C=16 (~159 tok/s), the internal target is >= 164 tok/s (+3%).';
// The entry's engineering note, written for the engine: it must never reach the page.
const ENGINEERING = 'UNMEASURED until the first campaign; baseline_for drops it from enforcement.';

// The GLM shape: a decode ladder with a flagged C=16, and one TTFT gate per
// served context, every target from one vLLM serve at 256k.
const TOML = `
[[benchmarks]]
gate = "concurrency-sweep-glm"
checkpoint = "${GLM}"
note = "${ENGINEERING}"
target_note = "${NOTE}"
targets = { c1_aggregate_tok_s = 40.11, c16_aggregate_tok_s = 115.73 }
target_max_model_len = 262144
target_caveats = { c16_aggregate_tok_s = "likely vLLM stall" }
[benchmarks.serve_overrides]
max_model_len = "65536"
${[65536, 262144, 524288]
  .map(
    (ctx) => `
[[benchmarks]]
gate = "ttft-cold-glm-${ctx / 1024}k"
checkpoint = "${GLM}"
note = "${ENGINEERING}"
targets = { median_ms_256 = 488 }
target_max_model_len = 262144
[benchmarks.serve_overrides]
max_model_len = "${ctx}"`
  )
  .join('\n')}
`;

const BATTLES = [
  {
    id: 'ttft-battle',
    name: 'TTFT battle',
    gate_prefixes: ['ttft-cold-'],
    metrics: [{ pattern: 'median_ms_{n}', better: 'lower' }],
    note: '',
  },
  {
    id: 'decode-battle',
    name: 'Decode battle',
    gate_prefixes: ['concurrency-sweep'],
    metrics: [{ pattern: 'c{n}_aggregate_tok_s', better: 'higher' }],
    note: '',
  },
];
// 64k wins, 512k loses: the qualifier must sit beside both verdicts.
const RECORDS = [
  ['concurrency-sweep-glm', { c1_aggregate_tok_s: 43.2, c16_aggregate_tok_s: 120 }],
  ['ttft-cold-glm-64k', { median_ms_256: 400 }],
  ['ttft-cold-glm-256k', { median_ms_256: 450 }],
  ['ttft-cold-glm-512k', { median_ms_256: 600 }],
].map(([gate, metrics]) => ({ benchmark_id: gate, target_model: GLM, recorded_at: 1792000000, git_sha: 'a', metrics }));

// The 64k cell wins against vLLM (400 vs 488) and is still over its own limit.
const LIMITS = { 'ttft-cold-glm-64k': { [GLM]: { median_ms_256: { max: [{ since: 1, value: 350 }] } } } };
const inputs = () => ({
  context: declaredContextOf(parseToml(TOML), 'glm-5.3-flash'),
  limits: LIMITS,
  recordsFor: (gate) => RECORDS.filter((r) => r.benchmark_id === gate),
  limitFor: (r, m) => limitFor(r, m, LIMITS),
  declaredLimit: (g, c, m) => declaredLimit(LIMITS, g, c, m, Number.MAX_SAFE_INTEGER),
  violationOf,
  kindOf,
});
const strip = (s) => s.replace(/<!--[^]*?-->/g, '');
const decode = (s) =>
  s.replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&');
const battlePage = (id) => {
  const battle = battleSections({ ...inputs(), battles: BATTLES })
    .get(GLM)
    .find((b) => b.id === id);
  return strip(render(BattlePanel, { props: { battle, checkpoint: GLM } }).body);
};
const gridPage = () => strip(render(ContextGrid, { props: { section: contextSections(inputs())[0] } }).body);
/** The table cell holding a vLLM line for `figure`. */
const cellWith = (page, figure) => [...page.matchAll(/<td[^>]*>([^]*?)<\/td>/g)].map((m) => m[1]).find((td) => td.includes(figure)) ?? '';

const MARK = /<a class="cm[^"]*" href="#([^"]+)"[^>]*><span aria-hidden="true">†<\/span> likely vLLM stall/;

describe('a flagged target is marked where it is printed, and its account reaches the page', () => {
  for (const [where, page, scope] of [
    ['the decode battle', () => battlePage('decode-battle'), `bp-decode-battle-${GLM}`],
    ['the context grid', gridPage, 'cg-glm-5.3-flash-concurrency'],
  ]) {
    test(`${where}: the C=16 cell carries the mark, linked to the note`, () => {
      const cell = cellWith(page(), '115.73 tok/s');
      expect(cell).toContain('vLLM (256k serve) 115.73 tok/s');
      expect(cell).toMatch(MARK);
      expect(MARK.exec(cell)[1]).toBe(noteId(scope, 'concurrency-sweep-glm'));
    });
    test(`${where}: the full note text is on the page under that id`, () => {
      const html = page();
      const at = html.indexOf(`id="${noteId(scope, 'concurrency-sweep-glm')}"`);
      expect(at).toBeGreaterThan(-1);
      expect(decode(html.slice(at, html.indexOf('</p>', at)))).toContain(NOTE);
    });
    test(`${where}: the engineering note never reaches the page`, () => {
      expect(decode(page())).not.toContain(ENGINEERING);
    });
    test(`CONTROL ${where}: the C=1 cell, not flagged, carries no mark`, () => {
      expect(cellWith(page(), '40.11 tok/s')).not.toMatch(/class="cm/);
    });
  }
});

describe('a row served at another context than the vLLM serve says so', () => {
  test('64k: vLLM not run there, the bar is its 256k serve', () => {
    const byContext = Object.fromEntries(
      [...battlePage('ttft-battle').matchAll(/<th scope="row"[^>]*>([^]*?)<\/th>/g)].map((m) => {
        const text = decode(m[1].replace(/<[^>]+>/g, ' '))
          .replace(/\s+/g, ' ')
          .trim();
        return [text.split(' ')[2], text];
      })
    );
    expect(byContext['64k']).toContain('vLLM not run at 64k; bar is its 256k serve');
    expect(byContext['512k']).toContain('vLLM not run at 512k (its serve max is 256k)');
    expect(byContext['256k']).toBe('cold · 256k');
  });
  test('the verdict stays on the qualified rows: 64k wins, 512k loses', () => {
    const page = battlePage('ttft-battle');
    const rows = [...page.matchAll(/<tr>([^]*?)<\/tr>/g)].map((m) => decode(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' '));
    expect(rows.find((r) => r.includes('cold · 64k'))).toContain('Win');
    expect(rows.find((r) => r.includes('cold · 512k'))).toContain('Loss');
  });
  test('every vLLM line names the serve', () => {
    expect(cellWith(battlePage('ttft-battle'), '488 ms')).toContain('vLLM (256k serve) 488 ms');
  });
  test('the context grid qualifies its rows the same way', () => {
    const page = gridPage();
    const rows = [...page.matchAll(/<th scope="row"[^>]*>([^]*?)<\/th>/g)].map((m) =>
      decode(m[1].replace(/<[^>]+>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim()
    );
    expect(rows.find((r) => r.startsWith('64k'))).toContain('vLLM not run at 64k; bar is its 256k serve');
    expect(rows.find((r) => r.startsWith('512k'))).toContain('vLLM not run at 512k (its serve max is 256k)');
    expect(rows.find((r) => r.startsWith('256k'))).not.toContain('vLLM not run');
  });
});

// Text read with the tags removed and NOTHING put in their place: what a
// screen reader joins, so a space Svelte trims at a tag edge shows up here.
const spoken = (html) => decode(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ');

describe('what a screen reader reads', () => {
  test('the value is ours, the mark is the caveat, the receipt names its cell', () => {
    const cell = spoken(cellWith(battlePage('decode-battle'), '115.73 tok/s'));
    expect(cell).toContain('ours 120 tok/s');
    expect(cell).toContain('† likely vLLM stall, about this target');
    expect(cell).toContain('Record, 14 Oct 2026: Decode battle, GLM-Flash, 64k, C=16');
  });
  test('the context grid receipt names its table and context', () => {
    expect(spoken(gridPage())).toContain('Record, 14 Oct 2026: TTFT · cold, GLM-Flash, 64k context');
  });
});

describe('a cell over its own limit', () => {
  test('says so with the limit, apart from the verdict: a win can be over its own limit', () => {
    const page = battlePage('ttft-battle');
    const cell = cellWith(page, '400 ms');
    expect(spoken(cell)).toContain('Win');
    expect(spoken(cell)).toContain('over its own limit (≤ 350 ms)');
    expect(cell).toMatch(/class="bp-line [^"]*\bbp-over\b[^"]*"/);
  });
  test('CONTROL: a cell with no own limit says so instead', () => {
    expect(spoken(cellWith(battlePage('ttft-battle'), '450 ms'))).toContain('no own limit yet');
  });
});

describe('the panel explains only what it prints', () => {
  test('the TTFT battle glosses cold/warm and not C; the decode battle the reverse', () => {
    const ttft = spoken(battlePage('ttft-battle'));
    const decodePanel = spoken(battlePage('decode-battle'));
    expect(ttft).toContain('cold = empty prefix cache');
    expect(ttft).not.toContain('C = concurrent requests');
    expect(decodePanel).toContain('C = concurrent requests');
    expect(decodePanel).not.toContain('cold = empty prefix cache');
  });
  test('without script the scroll hint is not sent: nothing would check whether the table scrolls', () => {
    expect(battlePage('decode-battle')).not.toContain('Scroll sideways');
    expect(gridPage()).not.toContain('Scroll sideways');
  });
});
