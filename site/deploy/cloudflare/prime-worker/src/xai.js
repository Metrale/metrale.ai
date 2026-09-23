// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// xai.js — the one place that talks to xAI.
// -----------------------------------------------------------------------------
// Chat completions, streamed. The stream is turned into plain events the rest
// of the Worker consumes: reasoning text, answer text, a finished set of tool
// calls, the usage block, and the finish reason. Nothing about prompts or
// tools lives here.
//
// What the wire looks like (checked against grok-4.7 on 2026-09-21): a delta
// carries `reasoning_content` while the model thinks, then `content` while it
// writes; a tool call arrives on `delta.tool_calls[]` with an `index`, and its
// `arguments` may come in pieces; the last chunk before `[DONE]` carries
// `usage`, with `cost_in_usd_ticks` (one tick is 1e-10 USD), so the price of
// an answer is xAI's own figure and the table below is only the fallback.
// =============================================================================

export const XAI_URL = 'https://api.x.ai/v1/chat/completions';

// USD per million tokens, read from GET /v1/language-models on 2026-09-21.
// Used only when a response carries no `cost_in_usd_ticks`.
export const PRICES = {
  'grok-4.7': { in: 2.0, cached: 0.5, out: 6.0 },
  'grok-4.6': { in: 2.0, cached: 0.5, out: 6.0 },
  'grok-4.5': { in: 2.0, cached: 0.3, out: 6.0 },
  'grok-4.3': { in: 1.25, cached: 0.2, out: 2.5 },
  'grok-4.20': { in: 1.25, cached: 0.2, out: 2.5 },
  'grok-build-0.1': { in: 1.0, cached: 0.2, out: 2.0 },
};

export class XaiError extends Error {
  constructor(message, { status = 0, transient = false, body = '' } = {}) {
    super(message);
    this.name = 'XaiError';
    this.status = status;
    this.transient = transient;
    this.body = body;
  }
}

/** The dollars an answer cost. xAI's figure when present, the price table otherwise. */
export function costUsd(usage, model) {
  if (!usage) return 0;
  if (Number.isFinite(usage.cost_in_usd_ticks) && usage.cost_in_usd_ticks > 0) return usage.cost_in_usd_ticks / 1e10;
  const key = Object.keys(PRICES).find((k) => String(model ?? '').startsWith(k));
  const p = PRICES[key] ?? PRICES['grok-4.7'];
  const cached = usage.prompt_tokens_details?.cached_tokens ?? 0;
  const prompt = Math.max(0, (usage.prompt_tokens ?? 0) - cached);
  const out = (usage.completion_tokens ?? 0) + (usage.completion_tokens_details?.reasoning_tokens ?? 0);
  return (prompt * p.in + cached * p.cached + out * p.out) / 1e6;
}

/** The parts of a usage block the telemetry keeps, flattened. */
export function usageSummary(usage) {
  return {
    prompt_tokens: usage?.prompt_tokens ?? 0,
    cached_tokens: usage?.prompt_tokens_details?.cached_tokens ?? 0,
    completion_tokens: usage?.completion_tokens ?? 0,
    reasoning_tokens: usage?.completion_tokens_details?.reasoning_tokens ?? 0,
  };
}

/** Add one usage block to another, field by field. */
export function addUsage(a, b) {
  const out = { ...a };
  for (const k of ['prompt_tokens', 'cached_tokens', 'completion_tokens', 'reasoning_tokens']) out[k] = (a?.[k] ?? 0) + (b?.[k] ?? 0);
  return out;
}

/**
 * One streamed completion. Yields, in order:
 *   { type: 'reasoning', text }     a piece of the model's thinking
 *   { type: 'content', text }       a piece of the answer
 *   { type: 'usage', usage }        the usage block, once, near the end
 *   { type: 'finish', reason, toolCalls, content, reasoning }
 * A response that is not a stream (an error envelope, a plain completion) is
 * handled before the first yield, so a retry there never duplicates output.
 */
export async function* streamChat({
  apiKey,
  model,
  effort,
  messages,
  tools,
  signal,
  fetchImpl = fetch,
  url = XAI_URL,
  maxAttempts = 2,
  firstTokenTimeoutMs = 0,
}) {
  const body = {
    model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
  };
  if (effort) body.reasoning_effort = effort;
  if (tools?.length) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }
  let response;
  let reader = null;
  let first = null; // the first read, already awaited under the timeout
  for (let attempt = 1; ; attempt++) {
    // The request's own controller, so a stalled attempt can be dropped while
    // the visitor's request stays alive for the retry.
    const own = new AbortController();
    const onAbort = () => own.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const retry = async (why, ms) => {
      signal?.removeEventListener('abort', onAbort);
      own.abort();
      if (attempt >= maxAttempts) throw new XaiError(why, { transient: true });
      await new Promise((r) => setTimeout(r, ms));
    };
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: own.signal,
      });
    } catch (err) {
      if (signal?.aborted) throw err;
      await retry(`xAI could not be reached: ${err?.message ?? err}`, 400 * attempt);
      continue;
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const transient = response.status === 429 || response.status >= 500;
      if (transient && attempt < maxAttempts) {
        await retry(`xAI answered ${response.status}`, 600 * attempt);
        continue;
      }
      signal?.removeEventListener('abort', onAbort);
      throw new XaiError(`xAI answered ${response.status}`, { status: response.status, transient, body: text.slice(0, 400) });
    }
    if (!(response.headers.get('content-type') ?? '').includes('text/event-stream') || !response.body) break;
    // A stream that sends nothing for this long is a stalled request on the
    // other side (the trial saw one take a minute to its first token). Nothing
    // has been emitted yet, so it is dropped and asked again.
    reader = response.body.getReader();
    if (firstTokenTimeoutMs > 0) {
      let timer;
      const timeout = new Promise((resolve) => (timer = setTimeout(() => resolve('timeout'), firstTokenTimeoutMs)));
      const result = await Promise.race([reader.read(), timeout]);
      clearTimeout(timer);
      if (result === 'timeout') {
        try {
          reader.releaseLock?.();
        } catch {
          /* already released */
        }
        if (signal?.aborted) throw new XaiError('aborted', { transient: false });
        await retry(`xAI sent nothing for ${firstTokenTimeoutMs} ms`, 300);
        continue;
      }
      first = result;
    }
    break;
  }
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('text/event-stream')) {
    // A plain completion: treat it as one content piece.
    const data = await response.json().catch(() => null);
    const msg = data?.choices?.[0]?.message;
    if (!msg) throw new XaiError('xAI returned no message', { body: JSON.stringify(data ?? '').slice(0, 400) });
    const content = msg.content ?? '';
    if (content) yield { type: 'content', text: content };
    if (data.usage) yield { type: 'usage', usage: data.usage };
    yield {
      type: 'finish',
      reason: data.choices[0].finish_reason ?? 'stop',
      toolCalls: normalizeToolCalls(msg.tool_calls ?? []),
      content,
      reasoning: msg.reasoning_content ?? '',
    };
    return;
  }
  if (!response.body) throw new XaiError('xAI returned no stream', { transient: true });

  reader = reader ?? response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let reasoning = '';
  let usage = null;
  let reason = null;
  const calls = new Map(); // index -> { id, name, arguments }

  const handle = function* (payload) {
    let chunk;
    try {
      chunk = JSON.parse(payload);
    } catch {
      return;
    }
    if (chunk.error)
      throw new XaiError(`xAI stream error: ${chunk.error.message ?? 'unknown'}`, {
        transient: /rate|overload|capacity/i.test(String(chunk.error.message)),
      });
    if (chunk.usage) usage = chunk.usage;
    const choice = chunk.choices?.[0];
    if (!choice) return;
    const delta = choice.delta ?? {};
    if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
      reasoning += delta.reasoning_content;
      yield { type: 'reasoning', text: delta.reasoning_content };
    }
    if (typeof delta.content === 'string' && delta.content) {
      content += delta.content;
      yield { type: 'content', text: delta.content };
    }
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const i = tc.index ?? 0;
        const cur = calls.get(i) ?? { id: '', name: '', arguments: '' };
        if (tc.id) cur.id = tc.id;
        if (tc.function?.name) cur.name = tc.function.name;
        if (typeof tc.function?.arguments === 'string') cur.arguments += tc.function.arguments;
        calls.set(i, cur);
      }
    }
    if (choice.finish_reason) reason = choice.finish_reason;
  };

  try {
    for (;;) {
      const { done, value } = first ?? (await reader.read());
      first = null;
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line || line.startsWith(':') || !line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          buffer = '';
          break;
        }
        yield* handle(payload);
      }
    }
    if (buffer.trim().startsWith('data:')) {
      const payload = buffer.trim().slice(5).trim();
      if (payload && payload !== '[DONE]') yield* handle(payload);
    }
  } finally {
    reader.releaseLock?.();
  }
  if (usage) yield { type: 'usage', usage };
  const toolCalls = [...calls.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c);
  yield { type: 'finish', reason: reason ?? (toolCalls.length ? 'tool_calls' : 'stop'), toolCalls, content, reasoning };
}

function normalizeToolCalls(list) {
  return list.map((tc) => ({ id: tc.id ?? '', name: tc.function?.name ?? '', arguments: tc.function?.arguments ?? '' }));
}
