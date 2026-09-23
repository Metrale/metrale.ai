// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// sse.js — the stream the page reads.
// -----------------------------------------------------------------------------
// The Worker does not forward xAI's stream. It runs the whole answer, tools
// included, and tells the page what is happening in its own events, each a
// named server-sent event with a JSON body:
//
//   meta       { id, model, effort, corpus }        once, first
//   phase      { phase, detail? }                   reading | searching | tool | reasoning | writing
//   reasoning  { text }                             a piece of the model's thinking
//   tool       { name, args, summary, ms }          a tool that ran, after it ran
//   delta      { text }                             a piece of the answer
//   sources    [ { n, title, url, kind, tier } ]    what the answer may cite, once
//   usage      { ...tokens, cost_usd, ttft_ms, first_answer_ms, total_ms, rounds, tools }
//   done       {}
//   error      { kind, message }                    the one event that may come alone
//
// src/lib/prime/sse.js in the site is the matching reader.
// =============================================================================

const encoder = new TextEncoder();

/** One frame. */
export function frame(event, data) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`);
}

/**
 * A response body that `send(event, data)` writes to and `close()` ends. The
 * headers keep proxies from buffering: an answer that arrives all at once is a
 * chatbot that looks broken.
 */
export function eventStream(headers = {}) {
  let controller;
  const stream = new ReadableStream({
    start(c) {
      controller = c;
    },
    cancel() {
      controller = null;
    }
  });
  const send = (event, data) => {
    try {
      controller?.enqueue(frame(event, data));
    } catch {
      /* the reader went away */
    }
  };
  const close = () => {
    try {
      controller?.close();
    } catch {
      /* already closed */
    }
    controller = null;
  };
  const response = new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      'x-accel-buffering': 'no',
      ...headers
    }
  });
  return { response, send, close, get open() { return controller !== null; } };
}
