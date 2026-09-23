// SPDX-License-Identifier: AGPL-3.0-only
// brand-rename: keep. The older names below are what the tests check, not copy.
//
// The Worker behind Metrale Prime (deploy/cloudflare/prime-worker) is deployed
// by hand, so it is tested here, in the suite CI runs. xAI is a fake that
// streams frames the way the real API does (checked 2026-09-21), KV is a Map.
import { beforeEach, expect, test } from 'bun:test';
import worker, { cleanConversation, corsFor } from '../../deploy/cloudflare/prime-worker/src/index.js';
import { Index, tokenize, resetIndex } from '../../deploy/cloudflare/prime-worker/src/corpus.js';
import { streamChat, costUsd, addUsage, usageSummary } from '../../deploy/cloudflare/prime-worker/src/xai.js';
import { runTool, TOOLS } from '../../deploy/cloudflare/prime-worker/src/tools.js';
import { systemPrompt } from '../../deploy/cloudflare/prime-worker/src/prompt.js';
import { fleetModel } from './economics.js';

const ORIGIN = 'https://metrale.ai';

// ---- fakes -------------------------------------------------------------------------

const kv = () => {
  const store = new Map();
  return {
    store,
    get: async (k, type) => {
      const v = store.get(k);
      if (v === undefined) return null;
      return type === 'json' ? JSON.parse(v) : v;
    },
    put: async (k, v) => void store.set(k, typeof v === 'string' ? v : JSON.stringify(v)),
    list: async ({ prefix = '' } = {}) => ({
      keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })),
      list_complete: true,
    }),
  };
};

const DOCS = [
  {
    id: 'page:1',
    tier: 'public',
    kind: 'page',
    title: 'Pricing · Metrale',
    section: 'Find your payback period',
    url: `${ORIGIN}/pricing#payback`,
    text: 'Three scenarios, every input editable, evidence class on every field. The license per GPU per year is proposed.',
  },
  {
    id: 'page:2',
    tier: 'public',
    kind: 'page',
    title: 'Benchmarks · Metrale',
    section: 'The ladder',
    url: `${ORIGIN}/benchmarks`,
    text: 'The concurrency ladder against vLLM on the GB10 box. Every rung in the campaign log. Atlas wins every rung.',
  },
  {
    id: 'doc:3',
    tier: 'public',
    kind: 'doc',
    title: 'Architecture',
    section: 'Kernels',
    url: 'https://github.com/x/atlas/blob/main/docs/ARCHITECTURE.md#kernels',
    text: 'NVFP4 GEMM kernels are hand tuned per hardware target. The avarok-kernels crate holds them.',
  },
  {
    id: 'deck:4',
    tier: 'partner',
    kind: 'deck',
    title: 'The deck',
    section: 'page 5',
    url: '',
    text: 'Raising a seed round to scale engine performance into repeatable revenue.',
  },
];
const DATA = {
  pages: [
    { path: '/', title: 'Metrale, the inference economics platform', description: 'Faster inference.' },
    { path: '/pricing', title: 'Pricing · Metrale', description: 'Priced against productive GPU capacity.' },
  ],
  routes: {
    pricing: '/pricing',
    benchmarks: '/benchmarks',
    demoForm: '/demo#book',
    why: '/why-metrale',
    company: '/company',
    openSource: '/engine',
    waitlist: '/waitlist',
    platform: '/platform',
    demo: '/demo',
    deployment: '/platform/deployment',
    diligence: '/diligence',
  },
  links: {
    contributing: 'https://github.com/x/atlas/blob/main/CONTRIBUTING.md',
    issues: 'https://github.com/x/atlas/issues',
    discord: 'https://discord.gg/x',
    blog: 'https://blog.example',
  },
  contacts: { sales: 'sales@example.test', press: 'press@example.test' },
  ladder: {
    title: 'Ladder',
    subtitle: 'Atlas vs vLLM',
    aggregate: 'mean',
    workload: { isl_tokens: 128, osl_tokens: 1024 },
    box: { gpu: 'NVIDIA GB10, 121.7 GB' },
    results_doc_url: 'https://github.com/x/atlas/blob/main/bench/RESULTS.md',
    rows: [
      { c: 1, atlas: 23.59, baseline: 'vLLM + MTP', baseline_tok_s: 19.72, ratio: 1.196 },
      { c: 128, atlas: 478.11, baseline: 'vLLM + MTP', baseline_tok_s: 358.57, ratio: 1.333 },
    ],
    summary: { won: 8, rungs: 8 },
  },
  history: {
    as_of: '2026-09-21',
    summary: { stars: 701, forks: 106, license: 'AGPL-3.0' },
    releases: [{ tag: 'b463', date: '2026-09-21', name: 'b463' }],
    commits: [{ sha: 'abc', date: '2026-09-21', author: 'tbraun96', message: 'fix' }],
    pulls: [],
    contributors: [{ login: 'tbraun96', contributions: 326 }],
  },
};

const baseEnv = (over = {}) => {
  const PRIME = kv();
  PRIME.store.set(
    'corpus:public',
    JSON.stringify({ built: '2026-09-21T00:00:00Z', site: ORIGIN, commit: 'abc123def', docs: DOCS.filter((d) => d.kind !== 'deck') })
  );
  PRIME.store.set('corpus:partner', JSON.stringify({ built: '2026-09-21T00:00:00Z', docs: DOCS.filter((d) => d.kind === 'deck') }));
  PRIME.store.set('corpus:data', JSON.stringify(DATA));
  return {
    ALLOWED_ORIGINS: `${ORIGIN},http://localhost:5173`,
    ALLOWED_ORIGIN_SUFFIXES: '.atlas-site.pages.dev',
    SITE: ORIGIN,
    PRIME_MODEL: 'grok-4.7',
    PRIME_EFFORT: 'low',
    PRIME_DAILY_BUDGET_USD: '5',
    PRIME_RATE_PER_MINUTE: '3',
    PRIME_RATE_PER_DAY: '50',
    PRIME_MAX_ROUNDS: '4',
    LOG_TTL_DAYS: '30',
    XAI_API_KEY: 'xai-test',
    PRIME_PARTNER_CODE: 'open-sesame',
    PRIME_ADMIN_CODE: 'admin',
    PRIME,
    ...over,
  };
};

/** A streamed xAI response made of the given deltas, the way the real one looks. */
function sse(frames) {
  const body = frames.map((f) => (f === '[DONE]' ? 'data: [DONE]\n\n' : `data: ${JSON.stringify(f)}\n\n`)).join('');
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}
const chunk = (delta, finish = null) => ({
  id: 'x',
  object: 'chat.completion.chunk',
  model: 'grok-4.7',
  choices: [{ index: 0, delta, ...(finish ? { finish_reason: finish } : {}) }],
});
const usageChunk = (ticks, { prompt = 1000, cached = 800, completion = 40, reasoning = 20 } = {}) => ({
  id: 'x',
  object: 'chat.completion.chunk',
  model: 'grok-4.7',
  choices: [],
  usage: {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: prompt + completion + reasoning,
    prompt_tokens_details: { cached_tokens: cached },
    completion_tokens_details: { reasoning_tokens: reasoning },
    cost_in_usd_ticks: ticks,
  },
});

/** A fake xAI: the first call asks for a search, the second writes the answer. */
function fakeXai(log) {
  let calls = 0;
  return async (url, init) => {
    log.push(JSON.parse(init.body));
    calls++;
    if (calls === 1) {
      return sse([
        chunk({ role: 'assistant', reasoning_content: 'The visitor asks about ' }),
        chunk({ reasoning_content: 'pricing. I should search.' }),
        chunk({
          tool_calls: [{ index: 0, id: 'call-1', type: 'function', function: { name: 'search_site', arguments: '{"query":"pric' } }],
        }),
        chunk({ tool_calls: [{ index: 0, function: { arguments: 'ing payback"}' } }] }, 'tool_calls'),
        usageChunk(11800000),
        '[DONE]',
      ]);
    }
    return sse([
      chunk({ role: 'assistant', content: 'The payback model has ' }),
      chunk({ content: 'three scenarios [1].' }, 'stop'),
      usageChunk(20000000, { prompt: 2000, cached: 0, completion: 30, reasoning: 10 }),
      '[DONE]',
    ]);
  };
}

/** Read every event off a streamed response. */
async function events(res) {
  expect(res.headers.get('content-type')).toContain('text/event-stream');
  const text = await res.text();
  return text
    .split('\n\n')
    .filter((f) => f.startsWith('event:'))
    .map((f) => {
      const [, event] = f.match(/^event: (.+)$/m);
      const [, data] = f.match(/^data: (.+)$/m);
      return { event, data: JSON.parse(data) };
    });
}

const post = (body, { origin = ORIGIN } = {}) =>
  new Request('https://prime.test/chat', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9' },
    body: JSON.stringify(body),
  });
const ctx = () => {
  const waits = [];
  return { waitUntil: (p) => waits.push(p), waits };
};

const realFetch = globalThis.fetch;
beforeEach(() => {
  resetIndex();
  globalThis.fetch = realFetch;
});

// ---- retrieval ------------------------------------------------------------------------

test('the three names of the company are one word to the index, and words are stemmed', () => {
  expect(tokenize('Atlas Avarok Metrale')).toEqual(['metrale', 'metrale', 'metrale']);
  expect(tokenize('GPUs kernels benchmarks running')).toEqual(['gpu', 'kernel', 'benchmark', 'runn']);
  expect(tokenize('the of a to')).toEqual([]);
});

test('search ranks a passage whose title carries the question first, and respects tiers and kinds', () => {
  const index = new Index(DOCS);
  const hits = index.search('what is the payback model on the pricing page', { tiers: ['public'] });
  expect(hits[0].doc.id).toBe('page:1');
  expect(hits.some((h) => h.doc.kind === 'deck')).toBe(false);
  const partner = index.search('seed round', { tiers: ['public', 'partner'] });
  expect(partner[0].doc.id).toBe('deck:4');
  expect(index.search('seed round', { tiers: ['public'] })).toEqual([]);
  expect(index.search('kernels', { tiers: ['public'], kinds: ['page'] }).every((h) => h.doc.kind === 'page')).toBe(true);
  expect(index.search('', { tiers: ['public'] })).toEqual([]);
});

// ---- the xAI client ---------------------------------------------------------------------

test('a streamed answer with a fragmented tool call is assembled into one call', async () => {
  const log = [];
  const fetchImpl = fakeXai(log);
  const seen = [];
  for await (const ev of streamChat({
    apiKey: 'k',
    model: 'grok-4.7',
    effort: 'low',
    messages: [{ role: 'user', content: 'hi' }],
    tools: TOOLS,
    fetchImpl,
  }))
    seen.push(ev);
  const finish = seen.find((e) => e.type === 'finish');
  expect(finish.reason).toBe('tool_calls');
  expect(finish.toolCalls).toEqual([{ id: 'call-1', name: 'search_site', arguments: '{"query":"pricing payback"}' }]);
  expect(finish.reasoning).toBe('The visitor asks about pricing. I should search.');
  expect(seen.filter((e) => e.type === 'reasoning')).toHaveLength(2);
  expect(seen.find((e) => e.type === 'usage').usage.cost_in_usd_ticks).toBe(11800000);
  expect(log[0].reasoning_effort).toBe('low');
  expect(log[0].stream_options).toEqual({ include_usage: true });
  expect(log[0].tools.map((t) => t.function.name)).toContain('search_site');
});

test("the cost is xAI's own figure when it is there, and the price table when it is not", () => {
  const u = usageChunk(11800000).usage;
  expect(costUsd(u, 'grok-4.7')).toBeCloseTo(0.00118, 6);
  // 200 uncached at $2, 800 cached at $0.50, 60 out at $6, per million.
  const noTicks = { ...u, cost_in_usd_ticks: 0 };
  expect(costUsd(noTicks, 'grok-4.7')).toBeCloseTo((200 * 2 + 800 * 0.5 + 60 * 6) / 1e6, 9);
  expect(costUsd(noTicks, 'grok-4.3')).toBeCloseTo((200 * 1.25 + 800 * 0.2 + 60 * 2.5) / 1e6, 9);
  expect(addUsage(usageSummary(u), usageSummary(u))).toEqual({
    prompt_tokens: 2000,
    cached_tokens: 1600,
    completion_tokens: 80,
    reasoning_tokens: 40,
  });
});

test('a plain JSON completion, not a stream, still yields the answer', async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { role: 'assistant', content: 'Plain.' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 1 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  const seen = [];
  for await (const ev of streamChat({ apiKey: 'k', model: 'grok-4.7', messages: [], fetchImpl })) seen.push(ev);
  expect(seen.map((e) => e.type)).toEqual(['content', 'usage', 'finish']);
});

test('an upstream 500 is retried once and then surfaces as a transient error', async () => {
  let n = 0;
  const fetchImpl = async () => {
    n++;
    return new Response('down', { status: 503 });
  };
  const it = streamChat({ apiKey: 'k', model: 'grok-4.7', messages: [], fetchImpl, maxAttempts: 2 });
  await expect(it.next()).rejects.toMatchObject({ name: 'XaiError', status: 503, transient: true });
  expect(n).toBe(2);
});

// ---- the tools ----------------------------------------------------------------------------

test('search_site numbers its passages once per answer, and the numbers survive a second search', async () => {
  const index = new Index(DOCS);
  const sources = [];
  const ctxT = { index, tiers: ['public'], data: DATA, env: {}, site: ORIGIN, sources };
  const a = await runTool('search_site', JSON.stringify({ query: 'pricing payback' }), ctxT);
  const b = await runTool('search_site', JSON.stringify({ query: 'payback model pricing page' }), ctxT);
  expect(a.results[0].n).toBe(1);
  expect(b.results.find((r) => r.url === `${ORIGIN}/pricing#payback`).n).toBe(1);
  expect(sources.map((s) => s.n)).toEqual([...new Set(sources.map((s) => s.n))]);
});

test("estimate_economics runs the page's own model and says so", async () => {
  const r = await runTool('estimate_economics', JSON.stringify({ scenario: 'fleet', inputs: { gpus: 64, uplift: 1.3 } }), {
    index: new Index([]),
    tiers: ['public'],
    data: DATA,
    env: {},
    site: ORIGIN,
    sources: [],
  });
  expect(r.modeled).toBe(true);
  expect(r.cite_as).toBe(1);
  expect(r.result).toEqual(fleetModel({ gpus: 64, uplift: 1.3 }));
  expect(r.evidence.licensePerGpuYear).toMatch(/PROPOSED/);
  const api = await runTool('estimate_economics', JSON.stringify({ scenario: 'api' }), {
    index: new Index([]),
    tiers: ['public'],
    data: DATA,
    env: {},
    site: ORIGIN,
    sources: [],
  });
  expect(api.inputs_used.boxTokensPerSecond).toBe(478.11);
  expect(api.evidence.boxTokensPerSecond).toMatch(/MEASURED at C=128/);
  const bad = await runTool('estimate_economics', JSON.stringify({ scenario: 'magic' }), {
    index: new Index([]),
    tiers: ['public'],
    data: DATA,
    env: {},
    site: ORIGIN,
    sources: [],
  });
  expect(bad.error).toBeDefined();
});

test('get_benchmark, list_pages, next_steps and repo_activity read the structured half', async () => {
  const c = { index: new Index([]), tiers: ['public'], data: DATA, env: {}, site: ORIGIN, sources: [] };
  const l = await runTool('get_benchmark', '{}', c);
  expect(l.rows).toHaveLength(2);
  expect(l.cite_as).toBe(1);
  expect(c.sources[0]).toMatchObject({ n: 1, title: 'The concurrency ladder', url: `${ORIGIN}/benchmarks` });
  expect(l.rows[1]).toMatchObject({ concurrency: 128, metrale_tok_s: 478.11, matched_baseline_tok_s: 358.57 });
  const p = await runTool('list_pages', JSON.stringify({ query: 'pricing' }), c);
  expect(p.pages).toEqual([
    { path: '/pricing', url: `${ORIGIN}/pricing`, title: 'Pricing · Metrale', description: 'Priced against productive GPU capacity.' },
  ]);
  const n = await runTool('next_steps', JSON.stringify({ audience: 'contributor' }), c);
  expect(n.steps.some((s) => s.url.includes('CONTRIBUTING'))).toBe(true);
  expect(n.steps.some((s) => s.url.includes('good+first+issue'))).toBe(true);
  const r = await runTool('repo_activity', JSON.stringify({ kind: 'releases', limit: 5 }), c);
  expect(r.releases[0].tag).toBe('b463');
});

test('capture_lead posts to the forms Worker as the prime source, once, and keeps the lead in KV without one', async () => {
  const posted = [];
  const fetchImpl = async (url, init) => {
    posted.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ ok: true, id: 'prime-1' }), { status: 200 });
  };
  const c = {
    index: new Index([]),
    tiers: ['public'],
    data: DATA,
    env: { FORMS_ENDPOINT: 'https://forms.test/lead' },
    site: ORIGIN,
    sources: [],
    page: '/pricing',
    fetchImpl,
  };
  const ok = await runTool(
    'capture_lead',
    JSON.stringify({ name: 'Ada', email: 'ada@buyer.test', company: 'Buyer', interest: 'a pilot', notes: '64 H100' }),
    c
  );
  expect(ok).toMatchObject({ ok: true, id: 'prime-1' });
  expect(posted[0].body).toMatchObject({ source: 'prime', name: 'Ada', email: 'ada@buyer.test', page: '/pricing', website: '' });
  expect(posted[0].body.notes).toContain('64 H100');
  const twice = await runTool('capture_lead', JSON.stringify({ name: 'Ada', email: 'ada@buyer.test', interest: 'again' }), c);
  expect(twice.ok).toBe(false);
  const bad = await runTool('capture_lead', JSON.stringify({ name: 'Ada', email: 'nope', interest: 'x' }), { ...c, leadCaptured: false });
  expect(bad.ok).toBe(false);
  const env = { PRIME: kv() };
  const kept = await runTool('capture_lead', JSON.stringify({ name: 'Ada', email: 'ada@buyer.test', interest: 'the deck' }), {
    ...c,
    env,
    leadCaptured: false,
  });
  expect(kept.ok).toBe(true);
  expect([...env.PRIME.store.keys()].some((k) => k.startsWith('lead:'))).toBe(true);
});

test('an answer gets a few searches, then is told to write with what it has', async () => {
  const c = { index: new Index(DOCS), tiers: ['public'], data: DATA, env: {}, site: ORIGIN, sources: [], maxSearches: 2 };
  expect((await runTool('search_site', JSON.stringify({ query: 'pricing' }), c)).results).toBeDefined();
  expect((await runTool('search_site', JSON.stringify({ query: 'ladder' }), c)).results).toBeDefined();
  expect((await runTool('search_site', JSON.stringify({ query: 'kernels' }), c)).error).toMatch(/search limit/);
});

test('a lead is not sent on the turn its details arrive in', async () => {
  const c = { index: new Index([]), tiers: ['public'], data: DATA, env: { PRIME: kv() }, site: ORIGIN, sources: [], turns: 1 };
  const first = await runTool('capture_lead', JSON.stringify({ name: 'Ada', email: 'ada@buyer.test', interest: 'a pilot' }), c);
  expect(first.ok).toBe(false);
  expect(first.error).toMatch(/confirm/i);
  const second = await runTool('capture_lead', JSON.stringify({ name: 'Ada', email: 'ada@buyer.test', interest: 'a pilot' }), {
    ...c,
    turns: 2,
  });
  expect(second.ok).toBe(true);
});

test('a stream that sends nothing is dropped after the first-token timeout and asked once more', async () => {
  let n = 0;
  const silent = () => new Response(new ReadableStream({ start() {} }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
  const fetchImpl = async () => {
    n++;
    if (n === 1) return silent();
    return sse([chunk({ content: 'Late but here.' }, 'stop'), usageChunk(1000), '[DONE]']);
  };
  const seen = [];
  for await (const ev of streamChat({ apiKey: 'k', model: 'grok-4.7', messages: [], fetchImpl, firstTokenTimeoutMs: 50 })) seen.push(ev);
  expect(n).toBe(2);
  expect(seen.find((e) => e.type === 'content').text).toBe('Late but here.');
  await expect(
    streamChat({ apiKey: 'k', model: 'grok-4.7', messages: [], fetchImpl: async () => silent(), firstTokenTimeoutMs: 30 }).next()
  ).rejects.toMatchObject({ name: 'XaiError', transient: true });
});

// ---- the prompt ------------------------------------------------------------------------------

test("the system prompt names the visitor's audience and page, and the partner tier only when unlocked", () => {
  const base = { site: ORIGIN, pages: DATA.pages, manifest: { built: '2026-09-21', commit: 'abc' }, today: '2026-09-21' };
  const s = systemPrompt({ ...base, audience: 'investor', page: DATA.pages[1], partner: false });
  expect(s).toContain('Metrale Prime');
  expect(s).toContain('evaluating an investment');
  expect(s).toContain('The visitor is on /pricing');
  expect(s).not.toContain('partner tier');
  expect(s).toContain('No exclamation marks');
  expect(systemPrompt({ ...base, audience: '', page: null, partner: true })).toContain('partner tier');
});

// ---- the request ----------------------------------------------------------------------------

test('cleanConversation keeps the newest turns and the first, and rejects what it must', () => {
  expect(cleanConversation({}).error).toBeDefined();
  expect(cleanConversation({ messages: [{ role: 'assistant', content: 'hi' }] }).error).toBeDefined();
  expect(
    cleanConversation({
      messages: [
        { role: 'system', content: 'x' },
        { role: 'user', content: 'q' },
      ],
    }).error
  ).toBeDefined();
  const long = 'x'.repeat(5000);
  const many = [
    { role: 'user', content: 'I run a neocloud' },
    ...Array.from({ length: 8 }, (_, i) => ({ role: i % 2 ? 'user' : 'assistant', content: long })),
    { role: 'user', content: 'final' },
  ];
  const c = cleanConversation({ messages: many, audience: 'infra', page: '/pricing' });
  expect(c.error).toBeUndefined();
  expect(c.messages[0].content).toBe('I run a neocloud');
  expect(c.messages.at(-1).content).toBe('final');
  expect(c.messages.length).toBeLessThan(many.length);
  expect(c.audience).toBe('infra');
  expect(cleanConversation({ messages: [{ role: 'user', content: 'q' }], audience: 'alien' }).audience).toBe('');
});

test('only our own pages may call, and the health check says what it runs', async () => {
  const env = baseEnv();
  expect(corsFor('https://evil.test', env)).toBeNull();
  expect(corsFor('https://preview.atlas-site.pages.dev', env)).not.toBeNull();
  expect(
    (await worker.fetch(post({ messages: [{ role: 'user', content: 'hi' }] }, { origin: 'https://evil.test' }), env, ctx())).status
  ).toBe(403);
  const health = await (await worker.fetch(new Request('https://prime.test/'), env, ctx())).json();
  expect(health).toMatchObject({
    ok: true,
    service: 'metrale-prime',
    model: 'grok-4.7',
    effort: 'low',
    corpus: { public: 3, partner: 1, commit: 'abc123def' },
    budget_usd: 5,
  });
});

test('an answer streams its phases, its tool, its sources, its cost and its timings, and is recorded', async () => {
  const env = baseEnv();
  const log = [];
  globalThis.fetch = fakeXai(log);
  const c = ctx();
  const res = await worker.fetch(
    post({ messages: [{ role: 'user', content: 'How does the payback model work?' }], audience: 'infra', page: '/pricing' }),
    env,
    c
  );
  expect(res.status).toBe(200);
  const evs = await events(res);
  await Promise.all(c.waits);
  const names = evs.map((e) => e.event);
  expect(names[0]).toBe('meta');
  expect(evs[0].data).toMatchObject({ model: 'grok-4.7', effort: 'low', partner: false, corpus: { public: 3, partner: 0 } });
  expect(names).toContain('reasoning');
  const phases = evs.filter((e) => e.event === 'phase').map((e) => e.data.phase);
  expect(phases).toEqual(['reading', 'reasoning', 'searching', 'writing']);
  expect(evs.find((e) => e.event === 'phase' && e.data.phase === 'searching').data.detail).toBe('pricing payback');
  const tools = evs.filter((e) => e.event === 'tool').map((e) => e.data);
  expect(tools[0]).toMatchObject({ name: 'read_site', args: { query: 'How does the payback model work?' } });
  expect(tools[0].summary).toMatch(/passages read before answering/);
  const tool = tools[1];
  expect(tool).toMatchObject({ name: 'search_site', args: { query: 'pricing payback' } });
  expect(tool.summary).toMatch(/passages for "pricing payback"/);
  expect(
    evs
      .filter((e) => e.event === 'delta')
      .map((e) => e.data.text)
      .join('')
  ).toBe('The payback model has three scenarios [1].');
  const sources = evs.find((e) => e.event === 'sources').data;
  expect(sources[0]).toMatchObject({ n: 1, url: `${ORIGIN}/pricing#payback`, cited: true });
  const usage = evs.find((e) => e.event === 'usage').data;
  expect(usage).toMatchObject({
    rounds: 2,
    tools: ['read_site', 'search_site'],
    prompt_tokens: 3000,
    cached_tokens: 800,
    completion_tokens: 70,
    reasoning_tokens: 30,
  });
  expect(usage.cost_usd).toBeCloseTo(0.00118 + 0.002, 6);
  expect(usage.ttft_ms).toBeGreaterThanOrEqual(0);
  expect(usage.total_ms).toBeGreaterThanOrEqual(usage.ttft_ms);
  expect(names.at(-1)).toBe('done');
  // The second call carried the tool result back to the model, and no text of the conversation was recorded.
  expect(log[1].messages.find((m) => m.role === 'tool').content).toContain('pricing#payback');
  expect(log[1].messages.find((m) => m.role === 'assistant' && m.tool_calls).tool_calls[0].function.name).toBe('search_site');
  const record = [...env.PRIME.store.entries()].find(([k]) => k.startsWith('log:'));
  expect(record).toBeDefined();
  const r = JSON.parse(record[1]);
  expect(r).toMatchObject({
    ok: true,
    model: 'grok-4.7',
    audience: 'infra',
    page: '/pricing',
    rounds: 2,
    tools: ['read_site', 'search_site'],
    question_chars: 32,
  });
  // The passages read first were in the very first request to the model, numbered.
  expect(log[0].messages[0].content).toMatch(/Passages already retrieved[\s\S]*\[1\] Pricing · Metrale/);
  expect(JSON.stringify(r)).not.toContain('payback model work');
  expect(Number(env.PRIME.store.get(`spend:${new Date().toISOString().slice(0, 10)}`))).toBe(11800000 + 20000000);
});

test('the partner code unlocks the partner tier, and nothing else does', async () => {
  const env = baseEnv();
  let seenTiers = null;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    if (body.messages.some((m) => m.role === 'tool')) {
      seenTiers = body.messages.find((m) => m.role === 'tool').content;
      return sse([chunk({ content: 'Answer [1].' }, 'stop'), usageChunk(1000), '[DONE]']);
    }
    return sse([
      chunk({ tool_calls: [{ index: 0, id: 'c', function: { name: 'search_site', arguments: '{"query":"seed round"}' } }] }, 'tool_calls'),
      usageChunk(1000),
      '[DONE]',
    ]);
  };
  const c1 = ctx();
  const a = await events(await worker.fetch(post({ messages: [{ role: 'user', content: 'the seed round?' }], access: 'wrong' }), env, c1));
  await Promise.all(c1.waits);
  expect(a[0].data.partner).toBe(false);
  expect(seenTiers).not.toContain('seed round to scale');
  const c2 = ctx();
  const b = await events(
    await worker.fetch(post({ messages: [{ role: 'user', content: 'the seed round?' }], access: 'open-sesame' }), env, c2)
  );
  await Promise.all(c2.waits);
  expect(b[0].data.partner).toBe(true);
  expect(seenTiers).toContain('seed round to scale');
  expect(b.find((e) => e.event === 'sources').data[0].tier).toBe('partner');
});

test('the rate limit and the daily budget answer before the model is called', async () => {
  const env = baseEnv();
  let called = 0;
  globalThis.fetch = async () => {
    called++;
    return sse([chunk({ content: 'ok' }, 'stop'), usageChunk(1000), '[DONE]']);
  };
  const codes = [];
  for (let i = 0; i < 5; i++) {
    const c = ctx();
    codes.push((await worker.fetch(post({ messages: [{ role: 'user', content: `q${i}` }] }), env, c)).status);
    await Promise.all(c.waits);
  }
  expect(codes).toEqual([200, 200, 200, 429, 429]);
  expect(called).toBe(3);
  const spent = baseEnv();
  spent.PRIME.store.set(`spend:${new Date().toISOString().slice(0, 10)}`, String(6 * 1e10));
  const res = await worker.fetch(post({ messages: [{ role: 'user', content: 'q' }] }), spent, ctx());
  expect(res.status).toBe(503);
  expect((await res.json()).error).toMatch(/budget/);
});

test('an upstream failure is told to the page as an event, and recorded as a failure', async () => {
  const env = baseEnv();
  globalThis.fetch = async () => new Response('nope', { status: 500 });
  const c = ctx();
  const evs = await events(await worker.fetch(post({ messages: [{ role: 'user', content: 'q' }] }), env, c));
  await Promise.all(c.waits);
  expect(evs.at(-1).event).toBe('error');
  expect(evs.at(-1).data.kind).toBe('busy');
  const r = JSON.parse([...env.PRIME.store.entries()].find(([k]) => k.startsWith('log:'))[1]);
  expect(r.ok).toBe(false);
  expect(r.error).toMatch(/upstream 500/);
});

test('the stats endpoint needs the admin code and aggregates the records', async () => {
  const env = baseEnv();
  globalThis.fetch = fakeXai([]);
  const c = ctx();
  await (
    await worker.fetch(post({ messages: [{ role: 'user', content: 'What is the payback model?' }], audience: 'curious' }), env, c)
  ).text();
  await Promise.all(c.waits);
  expect((await worker.fetch(new Request('https://prime.test/stats?code=wrong'), env, ctx())).status).toBe(403);
  const s = await (await worker.fetch(new Request('https://prime.test/stats?code=admin&days=1'), env, ctx())).json();
  expect(s.answers).toBe(1);
  expect(s.days[0]).toMatchObject({ answers: 1, ok: 1, errors: 0, audiences: { curious: 1 } });
  expect(s.by_model['grok-4.7/low'].answers).toBe(1);
  expect(s.tools).toEqual({ read_site: 1, search_site: 1 });
  expect(s.spent_today_usd).toBeCloseTo(0.0032, 4); // rounded to four places for the page
});

test('no secret is written in wrangler.toml, and the example vars file names every secret', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const dir = join(import.meta.dir, '..', '..', 'deploy', 'cloudflare', 'prime-worker');
  const toml = readFileSync(join(dir, 'wrangler.toml'), 'utf8');
  expect(toml).not.toMatch(/^\s*(XAI_API_KEY|PRIME_PARTNER_CODE|PRIME_ADMIN_CODE)\s*=/m);
  expect(toml).not.toMatch(/xai-[A-Za-z0-9]{20,}/);
  const example = readFileSync(join(dir, '.dev.vars.example'), 'utf8');
  for (const name of ['XAI_API_KEY', 'PRIME_PARTNER_CODE', 'PRIME_ADMIN_CODE']) expect(example).toContain(`${name}=`);
  expect(example).not.toMatch(/xai-[A-Za-z0-9]{20,}/);
  const ignore = readFileSync(join(dir, '.gitignore'), 'utf8');
  expect(ignore).toContain('.dev.vars');
  expect(ignore).toContain('corpus/');
});
