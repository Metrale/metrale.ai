// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// state.svelte.js — one conversation with Metrale Prime, as Svelte 5 runes.
// -----------------------------------------------------------------------------
// The one surface the components import. It holds the transcript, who the
// visitor said they are, the answer in flight with its phase, its thinking and
// its tool activity, and the telemetry of every answer this session. It talks
// to the Worker through fetch and reads the stream with sse.js. Nothing here
// touches the DOM beyond sessionStorage and requestAnimationFrame.
// =============================================================================

import { browser } from '$app/environment';
import { CHAT_URL, SESSION_KEY, MAX_TURNS } from './config.js';
import { readEvents } from './sse.js';

export const prime = $state({
  audience: '', // '' | 'infra' | 'investor' | 'contributor' | 'curious'
  access: '', // the partner code the visitor typed, sent with every request
  partner: false, // the Worker confirmed the code on the last answer
  messages: [], // { id, role: 'user'|'assistant', text, reasoning?, tools?, sources?, usage?, thinkMs?, error? }
  turn: null, // the answer in flight, see ask()
  telemetry: [], // one entry per finished answer: { ttft_ms, total_ms, cost_usd, tokens, model, effort, at }
  model: '', // reported by the Worker on the first answer
  effort: '',
  corpus: null, // { built, commit, public, partner }
  error: null, // { kind, message } for the last failed answer
});

let seq = 0;
const nextId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

// --- the session, kept for the tab's life -----------------------------------------

function save() {
  if (!browser) return;
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        audience: prime.audience,
        access: prime.access,
        messages: prime.messages,
        telemetry: prime.telemetry,
        model: prime.model,
        effort: prime.effort,
      })
    );
  } catch {
    /* private mode, quota */
  }
}

export function restore() {
  if (!browser) return;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (Array.isArray(s.messages)) prime.messages = s.messages.slice(-MAX_TURNS * 2);
    if (Array.isArray(s.telemetry)) prime.telemetry = s.telemetry;
    if (typeof s.audience === 'string') prime.audience = s.audience;
    if (typeof s.access === 'string') prime.access = s.access;
    if (typeof s.model === 'string') prime.model = s.model;
    if (typeof s.effort === 'string') prime.effort = s.effort;
  } catch {
    /* a stale or foreign value */
  }
}

export function setAudience(id) {
  prime.audience = prime.audience === id ? '' : id;
  save();
}

export function setAccess(code) {
  prime.access = String(code ?? '').trim();
  if (!prime.access) prime.partner = false;
  save();
}

export function reset() {
  stop();
  prime.messages = [];
  prime.error = null;
  prime.partner = false;
  save();
}

// --- asking ---------------------------------------------------------------------------

let controller = null;

/** Abort the answer in flight, keeping what has arrived. */
export function stop() {
  controller?.abort();
  controller = null;
}

/**
 * The share of an answer's prompt that the model read from its cache, 0 to 1,
 * and the answer's streaming rate in tokens per second: the completion tokens
 * over the time between the first token and the end. Null when unknown.
 */
export function cachedShare(t) {
  const p = t?.prompt_tokens ?? 0;
  return p > 0 ? Math.min(1, (t.cached_tokens ?? 0) / p) : null;
}
export function tokensPerSecond(t) {
  const out = t?.completion_tokens ?? 0;
  const ms = (t?.total_ms ?? 0) - (t?.ttft_ms ?? 0);
  return out > 0 && ms > 0 ? out / (ms / 1000) : null;
}

/** The numbers the chart and the per answer line read. */
export function summarize(list) {
  const done = list.filter((t) => Number.isFinite(t.total_ms));
  const avg = (k) => (done.length ? Math.round(done.reduce((a, t) => a + (t[k] ?? 0), 0) / done.length) : 0);
  const sum = (k) => done.reduce((a, t) => a + (t[k] ?? 0), 0);
  const rated = done.filter((t) => tokensPerSecond(t) !== null);
  return {
    answers: done.length,
    avgTotal: avg('total_ms'),
    avgFirst: avg('ttft_ms'),
    lastTotal: done.at(-1)?.total_ms ?? 0,
    cost: sum('cost_usd'),
    tokens: sum('tokens'),
    prompt: sum('prompt_tokens'),
    cached: sum('cached_tokens'),
    reasoning: sum('reasoning_tokens'),
    completion: sum('completion_tokens'),
    // Session-wide cache share and the mean streaming rate over the answers
    // that streamed at all.
    cachedShare: sum('prompt_tokens') > 0 ? Math.min(1, sum('cached_tokens') / sum('prompt_tokens')) : null,
    rate: rated.length ? rated.reduce((a, t) => a + tokensPerSecond(t), 0) / rated.length : null,
  };
}

/**
 * Ask one question. Resolves when the answer has settled, whether it worked or
 * not; failures are recorded on the message and on prime.error, never thrown.
 * `page` is the path the visitor is on, so the Worker can prefer it.
 */
export async function ask(text, { page = '' } = {}) {
  const q = String(text ?? '').trim();
  if (!q || prime.turn || !CHAT_URL) return;
  prime.error = null;
  if (prime.messages.length >= MAX_TURNS * 2) prime.messages = prime.messages.slice(-(MAX_TURNS * 2 - 2));
  prime.messages.push({ id: nextId(), role: 'user', text: q });

  const id = nextId();
  const started = performance.now();
  prime.turn = {
    id,
    phase: 'reading',
    detail: '',
    reasoning: '',
    answer: '',
    tools: [],
    sources: [],
    usage: null,
    startedAt: started,
    firstAt: 0,
    answerAt: 0,
    model: '',
    partner: false,
  };
  save();

  // Tokens are batched to one state write per frame: a fast stream costs one
  // re-render per frame, not one per token.
  let pendingReasoning = '';
  let pendingAnswer = '';
  let raf = 0;
  const flush = () => {
    raf = 0;
    if (!prime.turn) return;
    if (pendingReasoning) {
      prime.turn.reasoning += pendingReasoning;
      pendingReasoning = '';
    }
    if (pendingAnswer) {
      prime.turn.answer += pendingAnswer;
      pendingAnswer = '';
    }
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(flush);
  };

  controller = new AbortController();
  const history = prime.messages.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.text }));
  let failure = null;
  try {
    const res = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: history, audience: prime.audience, page, access: prime.access || undefined }),
      signal: controller.signal,
    });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('text/event-stream')) {
      const body = await res.json().catch(() => ({}));
      failure = {
        kind:
          res.status === 429
            ? 'rate'
            : res.status === 503 && /budget/i.test(body.error ?? '')
              ? 'budget'
              : res.status >= 500
                ? 'upstream'
                : 'internal',
        message: body.error ?? '',
      };
    } else {
      await readEvents(res.body, (name, data) => {
        const t = prime.turn;
        if (!t) return;
        switch (name) {
          case 'meta':
            t.model = data.model ?? '';
            t.partner = Boolean(data.partner);
            prime.model = data.model ?? prime.model;
            prime.effort = data.effort ?? prime.effort;
            prime.corpus = data.corpus ?? prime.corpus;
            break;
          case 'phase':
            t.phase = data.phase ?? t.phase;
            t.detail = data.detail ?? '';
            break;
          case 'reasoning':
            if (!t.firstAt) t.firstAt = performance.now();
            pendingReasoning += data.text ?? '';
            schedule();
            break;
          case 'tool':
            t.tools.push({ name: data.name, summary: data.summary ?? '', ms: data.ms ?? 0, args: data.args ?? {} });
            break;
          case 'delta':
            if (!t.firstAt) t.firstAt = performance.now();
            if (!t.answerAt) {
              t.answerAt = performance.now();
              t.phase = 'writing';
            }
            pendingAnswer += data.text ?? '';
            schedule();
            break;
          case 'sources':
            t.sources = Array.isArray(data) ? data : [];
            break;
          case 'usage':
            t.usage = data;
            break;
          case 'error':
            failure = { kind: data.kind ?? 'internal', message: data.message ?? '' };
            break;
          default:
            break;
        }
      });
    }
  } catch (err) {
    failure = controller?.signal.aborted ? { kind: 'aborted', message: '' } : { kind: 'network', message: String(err?.message ?? err) };
  } finally {
    if (raf) cancelAnimationFrame(raf);
    flush();
    controller = null;
  }

  const t = prime.turn;
  prime.turn = null;
  if (!t) return;
  const thinkMs = t.answerAt ? Math.round(t.answerAt - t.startedAt) : Math.round(performance.now() - t.startedAt);
  const usage = t.usage
    ? {
        ...t.usage,
        tokens: (t.usage.prompt_tokens ?? 0) + (t.usage.completion_tokens ?? 0) + (t.usage.reasoning_tokens ?? 0),
        at: new Date().toISOString(),
      }
    : null;
  if (usage) {
    prime.telemetry.push({
      ttft_ms: usage.ttft_ms,
      first_answer_ms: usage.first_answer_ms,
      total_ms: usage.total_ms,
      cost_usd: usage.cost_usd,
      tokens: usage.tokens,
      // The token accounting a token company shows its visitors: what came
      // from the prompt cache, what was spent thinking, and how fast the
      // answer streamed once it started.
      prompt_tokens: usage.prompt_tokens ?? 0,
      cached_tokens: usage.cached_tokens ?? 0,
      reasoning_tokens: usage.reasoning_tokens ?? 0,
      completion_tokens: usage.completion_tokens ?? 0,
      model: usage.model,
      effort: usage.effort,
      at: usage.at,
    });
    prime.telemetry = prime.telemetry.slice(-60);
  }
  prime.partner = t.partner;
  if (failure && failure.kind !== 'aborted' && !t.answer) {
    prime.error = failure;
    prime.messages.push({ id, role: 'assistant', text: '', error: failure, reasoning: t.reasoning, tools: t.tools, thinkMs });
  } else {
    prime.messages.push({
      id,
      role: 'assistant',
      text: t.answer,
      reasoning: t.reasoning,
      tools: t.tools,
      sources: t.sources,
      usage,
      thinkMs,
      partial: Boolean(failure),
    });
    if (failure && failure.kind !== 'aborted') prime.error = failure;
  }
  save();
}
