// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// metrale-prime — the Worker behind Metrale Prime, the site's chatbot.
// -----------------------------------------------------------------------------
// The site is static files, so the model, the key and the knowledge base live
// here. A page posts a conversation to /chat and reads back a stream of named
// events (sse.js) while this Worker runs the answer: it builds the prompt
// (prompt.js), streams the model (xai.js), runs the tools the model asks for
// (tools.js) against the knowledge base (corpus.js), and keeps a record of
// what the answer cost and how long it took (telemetry.js).
//
// Three limits stand in front of the model: only the site's own origins may
// call, an address gets a few turns a minute, and a day has a budget in
// dollars. The key is a Worker secret and never reaches a page.
//
//   GET  /              health: model, effort, knowledge base, today's spend
//   POST /chat          the conversation, answered as a stream
//   GET  /stats?code=   the telemetry, for whoever holds PRIME_ADMIN_CODE
//
// README.md beside this file has the setup. The logic is exercised by
// site/src/lib/prime-worker.test.js.
// =============================================================================

import { loadIndex } from './corpus.js';
import { streamChat, costUsd, usageSummary, addUsage, XaiError } from './xai.js';
import { eventStream } from './sse.js';
import { TOOLS, runTool } from './tools.js';
import { systemPrompt, AUDIENCES } from './prompt.js';
import { record, overBudget, tooMany, stats, spentToday } from './telemetry.js';

const MAX_BODY = 48 * 1024;
const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 6000;
const MAX_HISTORY_CHARS = 24000;

const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

/** The CORS headers for this caller, or null when the caller is not one of ours. */
export function corsFor(origin, env) {
  if (!origin) return null;
  const exact = String(env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const suffixes = String(env.ALLOWED_ORIGIN_SUFFIXES ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  let host = '';
  try {
    const u = new URL(origin);
    if (u.protocol !== 'https:' && !/^(localhost|127\.0\.0\.1)$/.test(u.hostname)) return null;
    host = u.hostname;
  } catch {
    return null;
  }
  if (!exact.includes(origin) && !suffixes.some((s) => host.endsWith(s))) return null;
  return { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, GET, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400', vary: 'Origin' };
}

/** The conversation as the model will see it, or an error. */
export function cleanConversation(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'The request must be a JSON object.' };
  if (!Array.isArray(input.messages) || input.messages.length === 0) return { error: 'messages is needed.' };
  if (input.messages.length > MAX_MESSAGES) return { error: 'That conversation is too long. Start a new one.' };
  const messages = [];
  for (const m of input.messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return { error: 'Each message needs a role of user or assistant and text content.' };
    const content = m.content.trim();
    if (!content) continue;
    if (content.length > MAX_MESSAGE_CHARS) return { error: 'A message is too long.' };
    messages.push({ role: m.role, content });
  }
  if (messages.length === 0 || messages.at(-1).role !== 'user') return { error: 'The last message must be from the visitor.' };
  // Keep the newest turns inside the history budget. The first user turn is
  // kept too, since it usually says who the visitor is and what they want.
  let chars = 0;
  const kept = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    chars += messages[i].content.length;
    if (chars > MAX_HISTORY_CHARS && kept.length >= 2) break;
    kept.unshift(messages[i]);
  }
  if (kept[0] !== messages[0] && messages[0].role === 'user') kept.unshift(messages[0]);
  const audience = Object.hasOwn(AUDIENCES, input.audience) ? input.audience : '';
  const page = typeof input.page === 'string' ? input.page.slice(0, 200) : '';
  const access = typeof input.access === 'string' ? input.access.slice(0, 200) : '';
  return { messages: kept, audience, page, access };
}

/** One short line about a tool result, for the page's activity strip. */
function summarize(name, args, result) {
  if (result?.error) return result.error;
  switch (name) {
    case 'search_site':
      return `${result.results?.length ?? 0} passages for "${String(args.query ?? '').slice(0, 60)}"`;
    case 'get_benchmark':
      return `the ladder, ${result.rows?.length ?? 0} rungs`;
    case 'estimate_economics':
      return `the ${args.scenario} scenario, modeled`;
    case 'list_pages':
      return `${result.pages?.length ?? 0} pages`;
    case 'next_steps':
      return `${result.steps?.length ?? 0} steps for ${result.audience}`;
    case 'repo_activity':
      return `repository ${args.kind}`;
    case 'capture_lead':
      return result.ok ? 'details sent to the team' : 'could not send';
    default:
      return 'done';
  }
}

const PHASES = { search_site: 'searching', get_benchmark: 'tool', estimate_economics: 'tool', list_pages: 'tool', next_steps: 'tool', repo_activity: 'tool', capture_lead: 'tool' };
const TOOL_LABELS = { search_site: 'reading the site', get_benchmark: 'opening the ladder', estimate_economics: 'running the payback model', list_pages: 'reading the site map', next_steps: 'laying out next steps', repo_activity: 'reading the repository', capture_lead: 'sending your details' };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    const cors = corsFor(origin, env) ?? {};

    if (request.method === 'GET' && url.pathname === '/') {
      const { manifest } = await loadIndex(env);
      return json(200, { ok: true, service: 'metrale-prime', model: env.PRIME_MODEL ?? 'grok-4.7', effort: env.PRIME_EFFORT ?? 'low', corpus: manifest, budget_usd: Number(env.PRIME_DAILY_BUDGET_USD ?? 0), spent_today_usd: Math.round((await spentToday(env)) * 10000) / 10000 }, cors);
    }
    if (request.method === 'GET' && url.pathname === '/stats') {
      const code = url.searchParams.get('code') ?? '';
      if (!env.PRIME_ADMIN_CODE || code !== env.PRIME_ADMIN_CODE) return json(403, { ok: false, error: 'A code is needed.' });
      const days = Math.max(1, Math.min(30, Number(url.searchParams.get('days') ?? 7)));
      return json(200, await stats(env, { days }));
    }
    if (url.pathname !== '/chat') return json(404, { ok: false, error: 'Not found.' });
    if (!corsFor(origin, env)) return json(403, { ok: false, error: 'This origin may not call here.' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json(405, { ok: false, error: 'POST only.' }, { ...cors, allow: 'POST, OPTIONS' });
    if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return json(415, { ok: false, error: 'Send JSON.' }, cors);
    if (!env.XAI_API_KEY) return json(503, { ok: false, error: 'The assistant is not configured.' }, cors);

    const raw = await request.text();
    if (raw.length > MAX_BODY) return json(413, { ok: false, error: 'That is too much text.' }, cors);
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      return json(400, { ok: false, error: 'That is not JSON.' }, cors);
    }
    const { messages, audience, page, access, error } = cleanConversation(input);
    if (error) return json(400, { ok: false, error }, cors);

    const ip = request.headers.get('cf-connecting-ip') ?? '';
    if (await tooMany(env, ip, { perMinute: Number(env.PRIME_RATE_PER_MINUTE ?? 8), perDay: Number(env.PRIME_RATE_PER_DAY ?? 120) })) return json(429, { ok: false, error: 'Too many questions in a row. Give it a minute.' }, cors);
    if (await overBudget(env)) return json(503, { ok: false, error: 'The assistant has reached its budget for today. The site still answers every question by page, and the contact page reaches a person.' }, cors);

    const { index, manifest } = await loadIndex(env);
    const data = index.docs.length ? await env.PRIME.get('corpus:data', 'json').catch(() => null) : null;
    const partner = Boolean(env.PRIME_PARTNER_CODE && access && access === env.PRIME_PARTNER_CODE);
    const tiers = partner ? ['public', 'partner'] : ['public'];
    const site = env.SITE ?? 'https://atlascybernetics.ai';
    const model = env.PRIME_MODEL ?? 'grok-4.7';
    const effort = env.PRIME_EFFORT ?? 'low';
    const maxRounds = Math.max(1, Math.min(6, Number(env.PRIME_MAX_ROUNDS ?? 4)));
    const pages = data?.pages ?? [];
    const here = pages.find((p) => p.path === page) ?? null;

    const id = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
    const t0 = Date.now();
    const system = systemPrompt({ site, audience, page: here, pages, partner, manifest, today: new Date().toISOString().slice(0, 10) });
    const convo = [{ role: 'system', content: system }, ...messages];
    const sources = [];
    const toolCtx = { index, tiers, data: data ?? {}, env, site, sources, page, leadCaptured: false, fetchImpl: fetch, turns: messages.filter((m) => m.role === 'user').length, maxSearches: 4 };
    const entry = { id, at: new Date(t0).toISOString(), model, effort, audience, page, partner, rounds: 0, tools: [], prompt_tokens: 0, cached_tokens: 0, completion_tokens: 0, reasoning_tokens: 0, cost_usd: 0, ttft_ms: null, first_answer_ms: null, total_ms: null, ok: false, error: '', country: request.cf?.country ?? '', question_chars: messages.at(-1).content.length, answer_chars: 0 };

    const { response, send, close } = eventStream(cors);
    const run = async () => {
      let usage = { prompt_tokens: 0, cached_tokens: 0, completion_tokens: 0, reasoning_tokens: 0 };
      let answer = '';
      let phase = 'reading';
      send('meta', { id, model, effort, partner, corpus: { built: manifest.built, commit: manifest.commit, public: manifest.public, partner: partner ? manifest.partner : 0 } });
      send('phase', { phase });
      // Read first, then think. The visitor's message is searched before the
      // model is called, and what it finds goes into the prompt with its
      // numbers, so a plain question is answered in one round, not two: one
      // model round trip is most of an answer's time.
      const question = messages.at(-1).content;
      if (question.split(/\s+/).length >= 3) {
        const started = Date.now();
        const read = await runTool('search_site', JSON.stringify({ query: question.slice(0, 300) }), toolCtx);
        if (read.results?.length) {
          entry.tools.push('read_site');
          send('tool', { name: 'read_site', args: { query: question.slice(0, 120) }, summary: `${read.results.length} passages read before answering`, ms: Date.now() - started });
          convo[0].content += `\n\nPassages already retrieved for the visitor's last message, numbered for citation. Use them and cite their numbers. Call search_site only for what they do not cover.\n\n${read.results.map((r) => `[${r.n}] ${r.title}${r.section ? ` · ${r.section}` : ''}${r.url ? ` (${r.url})` : ''}\n${r.text}`).join('\n\n')}`;
        }
      }
      try {
        for (let round = 1; round <= maxRounds; round++) {
          entry.rounds = round;
          const last = round === maxRounds;
          let finish = null;
          let roundContent = '';
          for await (const ev of streamChat({ apiKey: env.XAI_API_KEY, model, effort, messages: convo, tools: last ? undefined : TOOLS, signal: request.signal, firstTokenTimeoutMs: Number(env.PRIME_FIRST_TOKEN_TIMEOUT_MS ?? 20000) })) {
            if (ev.type === 'reasoning') {
              if (entry.ttft_ms === null) entry.ttft_ms = Date.now() - t0;
              if (phase !== 'reasoning') send('phase', { phase: (phase = 'reasoning') });
              send('reasoning', { text: ev.text });
            } else if (ev.type === 'content') {
              if (entry.ttft_ms === null) entry.ttft_ms = Date.now() - t0;
              if (entry.first_answer_ms === null) entry.first_answer_ms = Date.now() - t0;
              if (phase !== 'writing') send('phase', { phase: (phase = 'writing') });
              roundContent += ev.text;
              answer += ev.text;
              send('delta', { text: ev.text });
            } else if (ev.type === 'usage') {
              const u = usageSummary(ev.usage);
              usage = addUsage(usage, u);
              entry.cost_usd += costUsd(ev.usage, model);
            } else if (ev.type === 'finish') {
              finish = ev;
            }
          }
          if (!finish || finish.reason !== 'tool_calls' || finish.toolCalls.length === 0) break;
          // The model asked for tools. Run them, tell the page, and go round again.
          const calls = finish.toolCalls.filter((c) => c.name);
          convo.push({ role: 'assistant', content: roundContent || null, tool_calls: calls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments || '{}' } })) });
          for (const c of calls) {
            let args = {};
            try {
              args = JSON.parse(c.arguments || '{}');
            } catch {
              args = {};
            }
            const kind = PHASES[c.name] ?? 'tool';
            send('phase', { phase: (phase = kind), detail: kind === 'searching' ? String(args.query ?? '').slice(0, 120) : (TOOL_LABELS[c.name] ?? c.name) });
            const started = Date.now();
            const result = await runTool(c.name, c.arguments || '{}', toolCtx);
            entry.tools.push(c.name);
            send('tool', { name: c.name, args: kind === 'searching' ? { query: args.query, kinds: args.kinds } : args, summary: summarize(c.name, args, result), ms: Date.now() - started });
            convo.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(result) });
          }
          if (answer && roundContent) {
            // Text before a tool call is rarely the answer. Keep it, separated.
            answer += '\n\n';
            send('delta', { text: '\n\n' });
          }
        }
        const cited = new Set([...answer.matchAll(/\[(\d{1,3})\]/g)].map((m) => Number(m[1])));
        send('sources', sources.map((s) => ({ n: s.n, title: s.title, section: s.section, url: s.url, kind: s.kind, tier: s.tier, cited: cited.has(s.n) })));
        entry.total_ms = Date.now() - t0;
        Object.assign(entry, usage);
        entry.answer_chars = answer.length;
        entry.ok = answer.length > 0;
        if (!entry.ok) {
          entry.error = 'empty';
          send('error', { kind: 'empty', message: 'The model produced no answer. Ask again, in other words.' });
        }
        send('usage', { model, effort, rounds: entry.rounds, tools: entry.tools, ...usage, cost_usd: Math.round(entry.cost_usd * 1e6) / 1e6, ttft_ms: entry.ttft_ms, first_answer_ms: entry.first_answer_ms, total_ms: entry.total_ms });
        send('done', {});
      } catch (err) {
        entry.total_ms = Date.now() - t0;
        entry.error = err instanceof XaiError ? `upstream ${err.status || 'network'}` : String(err?.message ?? err).slice(0, 120);
        const kind = request.signal?.aborted ? 'aborted' : err instanceof XaiError ? (err.transient ? 'busy' : 'upstream') : 'internal';
        if (kind !== 'aborted') send('error', { kind, message: kind === 'busy' ? 'The model is busy. Try again in a few seconds.' : 'Something went wrong on our side. Ask again, and if it repeats the contact page reaches a person.' });
      } finally {
        close();
        ctx?.waitUntil?.(record(env, entry));
      }
    };
    ctx?.waitUntil?.(run());
    if (!ctx?.waitUntil) run();
    return response;
  }
};
