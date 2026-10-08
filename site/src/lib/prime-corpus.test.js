// SPDX-License-Identifier: AGPL-3.0-only
//
// How a page or a document becomes passages the chatbot can cite
// (scripts/prime/chunk.mjs), and how the record of which models have run on
// which hardware is sorted by its evidence (scripts/prime/coverage.mjs). The
// builder itself reads the build, so it is not run here; the cutting and the
// sorting are what can go quietly wrong.
import { expect, test } from 'bun:test';
import {
  htmlToText,
  sectionsFromHtml,
  mergeSmallSiblings,
  chunkText,
  slug,
  markdownSections,
  frontMatter,
  withdraw,
  isWithdrawn,
} from '../../scripts/prime/chunk.mjs';
import {
  archKey,
  coverage,
  coveragePassages,
  kernelTargets,
  readmeTargets,
  recipeCoverage,
  recipeScalars,
  recordCoverage,
  tomlScalars,
} from '../../scripts/prime/coverage.mjs';
import { Index } from '../../deploy/cloudflare/prime-worker/src/corpus.js';
import { ENGINE_REPO } from '../../../web-shared/sources.mjs';

test('html becomes the words a visitor reads, with entities decoded once', () => {
  expect(
    htmlToText('<p>Faster &amp; <b>stronger</b>.</p><script>x()</script><svg><path d="M0"/></svg><p>Next&nbsp;line &amp;quot;</p>')
  ).toBe('Faster & stronger.\nNext line &quot;');
});

test('a page is cut at its headings, each with the nearest anchor', () => {
  const html =
    '<p>Opening words that come first.</p><section id="proof"><h2>Proof</h2><p>The ladder.</p></section><section class="x"><h2 id="tour">The console</h2><p>Five tabs.</p><h3>Ask</h3><p>Pick a model.</p></section>';
  const s = sectionsFromHtml(html);
  expect(s.map((x) => [x.heading, x.id, x.level, x.trail])).toEqual([
    ['', '', 0, []],
    ['Proof', 'proof', 2, ['Proof']],
    ['The console', 'tour', 2, ['The console']],
    ['Ask', 'tour', 3, ['The console', 'Ask']],
  ]);
  expect(htmlToText(s[1].html)).toBe('The ladder.');
});

test('long text is cut at sentence ends under the limit, and crumbs are folded in', () => {
  const sentence = 'This is a sentence about the engine that runs on the silicon you own. ';
  const text = sentence.repeat(40);
  const chunks = chunkText(text, { max: 500 });
  expect(chunks.length).toBeGreaterThan(4);
  for (const c of chunks) expect(c.length).toBeLessThanOrEqual(500);
  for (const c of chunks) expect(c.trim().endsWith('.')).toBe(true);
  expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(text.trim().replace(/\s+/g, ' '));
  expect(chunkText('Short.', { max: 500, min: 80 })).toEqual(['Short.']);
  expect(chunkText('', {})).toEqual([]);
  // One run with no sentence end at all is cut by length rather than dropped.
  expect(chunkText('x'.repeat(1200), { max: 500 }).length).toBe(3);
});

test('markdown is cut at its headings, links keep their address, fences are trimmed', () => {
  const md = [
    '# Title',
    'Intro with a [link](https://a.test/x) and ![an image](i.png).',
    '',
    '## Build',
    '',
    '```sh',
    ...Array.from({ length: 20 }, (_, i) => `line ${i}`),
    '```',
    '',
    'After.',
    '',
    '### Deep',
    '| a | b |',
    '|---|---|',
    '| 1 | 2 |',
  ].join('\n');
  const s = markdownSections(md, { fenceLines: 3 });
  expect(s.map((x) => [x.heading, x.level])).toEqual([
    ['Title', 1],
    ['Build', 2],
    ['Deep', 3],
  ]);
  expect(s[0].text).toBe('Intro with a link (https://a.test/x) and .');
  expect(s[1].text).toContain('line 2');
  expect(s[1].text).not.toContain('line 3');
  expect(s[1].text).toContain('After.');
  expect(s[2].text).toBe('| a | b |\n\n| 1 | 2 |');
  expect(slug('GB10 deployment: the guide')).toBe('gb10-deployment-the-guide');
});

test('front matter is read and the body kept', () => {
  const { meta, body } = frontMatter('---\ntitle: "Seven tenets"\ndate: 2026-08-01\n---\n# Hello\ntext');
  expect(meta).toEqual({ title: 'Seven tenets', date: '2026-08-01' });
  expect(body).toBe('# Hello\ntext');
  expect(frontMatter('plain').body).toBe('plain');
});

test('small sub sections under one parent become one passage, each led by its heading', () => {
  const html =
    '<section id="team"><h2>Team: Deep roots</h2><p>Five people.</p><h3>Kyle Croll</h3><p>CEO. Navy veteran.</p><h3>Thomas Braun</h3><p>CTO. Started the engine.</p></section><section id="deck"><h2>The deck</h2><p>On request.</p></section>';
  const merged = mergeSmallSiblings(sectionsFromHtml(html));
  expect(merged.map((s) => s.heading)).toEqual(['Team: Deep roots', 'The deck']);
  expect(htmlToText(merged[0].html)).toBe('Five people.\nKyle Croll. CEO. Navy veteran.\nThomas Braun. CTO. Started the engine.');
  expect(merged[0].id).toBe('team');
  // Too big to merge stays apart.
  const big = mergeSmallSiblings(sectionsFromHtml('<h2>A</h2><p>x</p><h3>B</h3><p>' + 'y'.repeat(2000) + '</p>'));
  expect(big.map((s) => s.heading)).toEqual(['A', 'B']);
});

// ---- withdrawn claims ------------------------------------------------------------

test('a sentence that makes a withdrawn claim leaves the passage, and the rest stays', () => {
  expect(withdraw('Metrale runs on GB10. We submitted to MLPerf v6.1. It is fast.')).toBe('Metrale runs on GB10. It is fast.');
  expect(withdraw('We are Qwen Dev Ambassadors. A recipe for every release.')).toBe('A recipe for every release.');
  expect(withdraw('The fused kernel merged into Hugging Face Transformers. Next.')).toBe('Next.');
  expect(withdraw('NVIDIA Inception member, upstream merge into Hugging Face Transformers, AMD-provided hardware')).toBe('');
  expect(withdraw('MLCommons named the project a contributor.')).toBe('');
  expect(withdraw('Sparkrun has been retired.')).toBe('');
});

test('a commit title is a line, and goes as a whole', () => {
  const history = '2026-07-24 tbraun96: site: news band, MLPerf v6.1 and AMD Strix desktop (#367)\n2026-07-25 contributor: docs: typo';
  expect(withdraw(history)).toBe('2026-07-25 contributor: docs: typo');
});

test('what is not a withdrawn claim is left alone', () => {
  for (const s of [
    'Weights download from the Hugging Face Hub into ~/.cache/huggingface.',
    'The Qwen3.6 recipe ships with every release.',
    'A brand ambassador can be playful.',
    'AMD provided a Strix Halo desktop, and the engine runs on it through SCALE.',
  ]) {
    expect(isWithdrawn(s)).toBe(false);
    expect(withdraw(s)).toBe(s);
  }
});

// ---- which models have run on which hardware (scripts/prime/coverage.mjs) ---------

const rec = (bench, model, { cls = 'gb10', box = 'spark-28c2', at = 1790230160, verdict = 'PASS', recipe = '' } = {}) => ({
  path: `.benchmarks/${bench}/${at}.json`,
  benchmark_id: bench,
  target_model: model,
  served_by: recipe,
  hardware: { gpu: 'NVIDIA GB10', gpu_count: 1 },
  perf_class: cls ? `${cls}@${box}` : '',
  recorded_at: at,
  verdict,
});
const MOE = 'Qwen/Qwen3.6-35B-A3B-FP8';
const DENSE = 'unsloth/Qwen3.8-27B-NVFP4';
const BENCHMARKS = {
  'concurrency-sweep-moe': {
    name: 'Concurrency Sweep (MoE)',
    records: [
      rec('concurrency-sweep-moe', MOE, { recipe: 'qwen3.6/qwen3.6-35b-a3b-fp8-nvfp4head' }),
      rec('concurrency-sweep-moe', MOE, { box: 'spark-43fa', at: 1790645191 }),
    ],
  },
  'concurrency-sweep': { name: 'Concurrency Sweep', records: [rec('concurrency-sweep', DENSE)] },
  'bfcl-subset': { name: 'BFCL (subset)', records: [rec('bfcl-subset', DENSE, { verdict: 'info' })] },
  // A gate whose name makes a withdrawn claim, and a record with no class: both left out.
  'mlperf-agentic-subset': { name: 'MLPerf agentic subset', records: [rec('mlperf-agentic-subset', DENSE)] },
  'no-class': { name: 'No class', records: [rec('no-class', 'some/model', { cls: '' })] },
};
const RECIPES = [
  {
    id: 'qwen3.6/qwen3.6-35b-a3b-fp8-mtp',
    text: 'recipe_version: "2"\r\nmodel: Qwen/Qwen3.6-35B-A3B-FP8\r\nruntime: metrale\r\ncontainer: metrale/metrale-inference-gb10:latest\r\nmax_nodes: 1\r\nmetadata:\r\n  description: |\r\n    model: not/this-one\r\n',
  },
  {
    id: 'deepseek-v4/deepseek-v4-flash-nvfp4-ep2',
    text: 'model: nvidia/DeepSeek-V4-Flash-NVFP4\nruntime: metrale\ncontainer: metrale/metrale-inference-gb10:latest  # the image\nmin_nodes: 2\nmax_nodes: 2\n',
  },
  {
    id: 'diffusion-gemma/diffusion-gemma-bf16',
    text: '# a comment\nrecipe_version: "1"\ndescription: vLLM serving one GB10 node\nmodel: google/diffusiongemma-26B-A4B-it\ncontainer: vllm-node\n',
  },
];
const README = [
  '## Requirements',
  '',
  '### Other hardware targets',
  '',
  'The tree also builds kernel sets for other hardware. They are built from',
  'source and are not covered by the GB10 certification.',
  '',
  '| Target | Directory | Architecture | Model sets |',
  '|---|---|---|---:|',
  '| NVIDIA H100 / H200 | `kernels/hopper` | `sm_90a` | 1 |',
  '| AMD Strix Halo, through SCALE | `kernels/strix` | `gfx1151` | 1 |',
  '| AMD Strix Halo, native HIP | `kernels/strix-hip` | `gfx1151` | 1 |',
  '',
  '## Quick start',
  '| Not this | `kernels/nope` | `x` | 9 |',
].join('\r\n');
const TREES = [
  {
    dir: 'gb10',
    hardware: { vendor: 'nvidia', arch: 'sm_121f' },
    models: [
      { dir: 'qwen3.8-27b', hf_id: 'Qwen/Qwen3.8-27B', params: '27B' },
      { dir: 'qwen3.6-35b-a3b', hf_id: MOE, params: '35B' },
    ],
  },
  {
    dir: 'hopper',
    hardware: { vendor: 'nvidia', arch: 'sm_90a', inherits: 'gb10' },
    models: [{ dir: 'qwen3.8-27b', hf_id: 'Qwen/Qwen3.8-27B' }],
  },
  { dir: 'strix', hardware: { vendor: 'amd', arch: 'gfx1151' }, models: [{ dir: 'qwen3.6-27b' }] },
  { dir: 'strix-hip', hardware: { vendor: 'hip', arch: 'gfx1151' }, models: [{ dir: 'qwen3.6-27b' }] },
];
const CARDS = [
  { name: 'NVIDIA DGX Spark', chip: 'GB10 · Blackwell SM121', status: 'Verified', body: 'One binary.' },
  { name: 'AMD Strix Halo', chip: 'gfx1151 · RDNA 3.5', status: 'Runs through SCALE', body: 'Compiled through SCALE.' },
  { name: 'NVIDIA H100 and H200', chip: 'Hopper · SM90', status: 'Bring up', body: 'Receipts in the changelog.' },
  { name: 'Intel Arc Pro B70', chip: 'Battlemage', status: 'In talks', body: 'Nothing is signed.' },
];
const SUBJECTS = {
  'qwen36-35b-a3b': {
    title: 'The MoE ladder',
    workload: { checkpoint: MOE },
    box: { name: 'dgx2 (spark-43fa)', gpu: 'NVIDIA GB10 Grace Blackwell, 121.7 GB unified' },
    series: [{ id: 'metrale' }, { id: 'vllm-mtp', engine: 'vLLM 0.27.1' }],
    rows: [
      {
        c: 1,
        engine: 81.9,
        baselines: [{ id: 'vllm-mtp', label: 'vLLM + MTP', parity: 'matched', tok_s: 52.11 }],
        ratio_vs_matched: 1.572,
      },
      {
        c: 128,
        engine: 748.6,
        baselines: [{ id: 'vllm-mtp', label: 'vLLM + MTP', parity: 'matched', tok_s: 672.94 }],
        ratio_vs_matched: 1.112,
      },
    ],
    summary: { rungs: 2, won: 2, min_ratio: 1.112, max_ratio: 1.572 },
    results_doc_url: 'https://github.com/x/engine/blob/main/bench/moe.json',
  },
};
const ACCOUNT = {
  benchmarks: BENCHMARKS,
  subjects: SUBJECTS,
  labels: [{ id: 'qwen36-35b-a3b', label: 'Qwen 3.6 35B A3B' }],
  recipes: RECIPES,
  trees: TREES,
  readme: README,
  cards: CARDS,
  engine: { repo: 'https://github.com/x/engine', ref: 'abc123def456' },
};

test('signed records are grouped by hardware class, checkpoint and gate, and a withdrawn gate is left out', () => {
  const m = recordCoverage(BENCHMARKS);
  expect(m).toHaveLength(1);
  expect(m[0]).toMatchObject({ class: 'gb10', gpu: 'NVIDIA GB10', gpus_per_box: 1, boxes: ['spark-28c2', 'spark-43fa'], records: 4 });
  expect(m[0].models.map((x) => [x.checkpoint, x.records])).toEqual([
    [MOE, 2],
    [DENSE, 2],
  ]);
  const moe = m[0].models[0];
  expect(moe.recipes).toEqual(['qwen3.6/qwen3.6-35b-a3b-fp8-nvfp4head']);
  expect(moe.gates).toEqual([
    {
      id: 'concurrency-sweep-moe',
      name: 'Concurrency Sweep (MoE)',
      records: 2,
      verdicts: { PASS: 2 },
      first: '2026-09-24',
      last: '2026-09-29',
      newest: `${ENGINE_REPO}/blob/main/.benchmarks/concurrency-sweep-moe/1790645191.json`,
    },
  ]);
  expect(m[0].models[1].verdicts).toEqual({ PASS: 1, info: 1 });
  expect(JSON.stringify(m)).not.toMatch(/mlperf|some\/model/i);
});

test('a recipe says what it serves, with which engine, on which hardware and on how many boxes, whatever its line endings', () => {
  const s = recipeScalars(RECIPES[0].text);
  expect(s).toMatchObject({ model: MOE, runtime: 'metrale', recipe_version: '2' });
  expect(s.description).toBeUndefined();
  expect(recipeCoverage(RECIPES)).toEqual([
    {
      id: 'deepseek-v4/deepseek-v4-flash-nvfp4-ep2',
      checkpoint: 'nvidia/DeepSeek-V4-Flash-NVFP4',
      engine: 'Metrale Engine',
      hardware: 'gb10',
      image: 'metrale/metrale-inference-gb10:latest',
      nodes: 2,
    },
    {
      id: 'diffusion-gemma/diffusion-gemma-bf16',
      checkpoint: 'google/diffusiongemma-26B-A4B-it',
      engine: 'vLLM',
      hardware: null,
      image: 'vllm-node',
      nodes: 1,
    },
    {
      id: 'qwen3.6/qwen3.6-35b-a3b-fp8-mtp',
      checkpoint: MOE,
      engine: 'Metrale Engine',
      hardware: 'gb10',
      image: 'metrale/metrale-inference-gb10:latest',
      nodes: 1,
    },
  ]);
});

test("the README's table of other hardware is read under its own heading, and a TOML section by its keys", () => {
  expect(readmeTargets(README)).toEqual({
    note: 'The tree also builds kernel sets for other hardware. They are built from source and are not covered by the GB10 certification.',
    rows: [
      { dir: 'hopper', name: 'NVIDIA H100 / H200', arch: 'sm_90a', model_sets: 1 },
      { dir: 'strix', name: 'AMD Strix Halo, through SCALE', arch: 'gfx1151', model_sets: 1 },
      { dir: 'strix-hip', name: 'AMD Strix Halo, native HIP', arch: 'gfx1151', model_sets: 1 },
    ],
  });
  expect(readmeTargets('# No such table')).toEqual({ note: '', rows: [] });
  const toml =
    '# head\r\n[hardware]\r\nname = "gb10"\r\narch = "sm_121f" # nvcc\r\nsm_count = 48\r\n[[model_types]]\r\nname = "not this"\r\n';
  expect(tomlScalars(toml, 'hardware')).toEqual({ name: 'gb10', arch: 'sm_121f', sm_count: '48' });
  expect(tomlScalars(toml, 'model')).toEqual({});
  expect(
    ['sm_121f', 'GB10 · Blackwell SM121', 'sm_90a', 'Hopper · SM90', 'gfx1151 · RDNA 3.5', 'metal3.1', 'Battlemage'].map(archKey)
  ).toEqual(['sm121', 'sm121', 'sm90', 'sm90', 'gfx1151', null, null]);
});

test("the site's status goes to the target with its architecture, and of two that share one, to the one its words name", () => {
  const { targets, site_only } = kernelTargets(TREES, readmeTargets(README), CARDS);
  expect(targets.map((t) => [t.dir, t.name, t.site?.status ?? null])).toEqual([
    ['gb10', 'NVIDIA DGX Spark (GB10 · Blackwell SM121)', 'Verified'],
    ['hopper', 'NVIDIA H100 / H200', 'Bring up'],
    ['strix', 'AMD Strix Halo, through SCALE', 'Runs through SCALE'],
    ['strix-hip', 'AMD Strix Halo, native HIP', null],
  ]);
  expect(targets[0].models.map((m) => m.family)).toEqual(['qwen3.6-35b-a3b', 'qwen3.8-27b']);
  expect(targets[1]).toMatchObject({ inherits: 'gb10', models: [{ family: 'qwen3.8-27b', hf_id: 'Qwen/Qwen3.8-27B', params: '' }] });
  expect(site_only).toEqual([{ name: 'Intel Arc Pro B70', chip: 'Battlemage', status: 'In talks', says: 'Nothing is signed.' }]);
});

test('the account puts the certified hardware first and counts its records and recipes, beside every ladder', () => {
  const cov = coverage(ACCOUNT);
  expect(cov.targets.map((t) => [t.dir, t.records, t.recipes])).toEqual([
    ['gb10', 4, 2],
    ['hopper', 0, 0],
    ['strix', 0, 0],
    ['strix-hip', 0, 0],
  ]);
  expect(cov.ladders).toHaveLength(1);
  expect(cov.ladders[0]).toMatchObject({
    id: 'qwen36-35b-a3b',
    label: 'Qwen 3.6 35B A3B',
    checkpoint: MOE,
    against: 'vLLM + MTP, vLLM 0.27.1',
  });
  expect(cov.ladders[0].rows[1]).toEqual({ c: 128, engine: 748.6, baseline: 'vLLM + MTP', baseline_tok_s: 672.94, ratio: 1.112 });
  expect(cov.note).toMatch(/not covered by the GB10 certification/);
});

test('the account becomes passages, the overview first, that the search before the first round finds', () => {
  const passages = coveragePassages(coverage(ACCOUNT), { site: 'https://metrale.ai' });
  expect(new Set(passages.map((p) => p.kind))).toEqual(new Set(['record']));
  const [overview] = passages;
  expect(overview.section).toMatch(/^Overview/);
  // The answer first, so a reader that keeps only the start keeps it.
  expect(overview.text).toMatch(
    /^Signed gate records, the strongest evidence, exist only for NVIDIA DGX Spark \(GB10 · Blackwell SM121\)\./
  );
  expect(overview.text).toContain('4 on NVIDIA GB10, 2 boxes');
  expect(overview.text).toContain('NVIDIA H100 / H200, Bring up, 1');
  expect(overview.text).toContain('AMD Strix Halo, native HIP, no status, 1');
  expect(overview.text).toContain('Intel Arc Pro B70, In talks');
  expect(overview.text).toContain('1 recipe launches vLLM');
  for (const p of passages) expect(p.text.length).toBeLessThanOrEqual(1400);
  const hopper = passages.find((p) => p.title === 'NVIDIA H100 / H200');
  expect(hopper).toMatchObject({ section: 'Bring up on the site', url: 'https://metrale.ai/platform/hardware' });
  expect(hopper.text).toContain('No signed gate record on this hardware.');
  expect(passages.find((p) => p.title === 'AMD Strix Halo, native HIP').url).toBe(
    'https://github.com/x/engine/blob/main/README.md#other-hardware-targets'
  );
  expect(passages.find((p) => p.title === 'Launch recipes').text).toContain('deepseek-v4-flash-nvfp4-ep2 (2 boxes)');
  // Only the overview is titled in the general question's words, so a general
  // question reads it first, and a question naming a target reads that target.
  expect(passages.filter((p) => /hardware/i.test(p.title)).map((p) => p.section)).toEqual([overview.section]);
  const index = new Index(passages.map((p, i) => ({ ...p, id: `record:${i}`, tier: 'public' })));
  const first = (q) => index.search(q)[0].doc;
  expect(first('Which models have been tested on what hardware?').section).toMatch(/^Overview/);
  expect(first('Does it run on an H100?').title).toBe('NVIDIA H100 / H200');
});
