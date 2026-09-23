// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// sse.js — read the Worker's named events off a fetch response.
// -----------------------------------------------------------------------------
// The matching writer is deploy/cloudflare/prime-worker/src/sse.js. Frames are
// `event: name` and `data: json` lines ending in a blank line; a frame may
// arrive split across reads, so bytes are buffered until a blank line lands.
// =============================================================================

/**
 * Consume a streamed body, calling `onEvent(name, data)` per frame. Resolves
 * when the stream ends. A frame whose data is not JSON is dropped.
 */
export async function readEvents(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const dispatch = (frame) => {
    let name = 'message';
    const lines = [];
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) name = line.slice(6).trim();
      else if (line.startsWith('data:')) lines.push(line.slice(5).replace(/^ /, ''));
    }
    if (lines.length === 0) return;
    try {
      onEvent(name, JSON.parse(lines.join('\n')));
    } catch {
      /* not JSON */
    }
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let at;
      while ((at = buffer.indexOf('\n\n')) !== -1) {
        dispatch(buffer.slice(0, at));
        buffer = buffer.slice(at + 2);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) dispatch(buffer);
  } finally {
    reader.releaseLock?.();
  }
}
