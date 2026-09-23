// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from 'bun:test';
import { readEvents } from './sse.js';
import { frame } from '../../../deploy/cloudflare/prime-worker/src/sse.js';

const stream = (chunks) =>
  new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(typeof ch === 'string' ? new TextEncoder().encode(ch) : ch);
      c.close();
    }
  });

test('the page reads what the Worker writes, frame by frame', async () => {
  const bytes = [frame('meta', { model: 'grok-4.7' }), frame('delta', { text: 'Hello' }), frame('done', {})];
  const seen = [];
  await readEvents(stream(bytes), (name, data) => seen.push([name, data]));
  expect(seen).toEqual([
    ['meta', { model: 'grok-4.7' }],
    ['delta', { text: 'Hello' }],
    ['done', {}]
  ]);
});

test('a frame split across reads, and a multibyte character split across reads, both arrive whole', async () => {
  const one = new TextDecoder().decode(frame('delta', { text: 'tokens per joule ′ ✓' }));
  const bytes = new TextEncoder().encode(one);
  const cut = bytes.indexOf(0xe2); // inside the prime mark's three bytes
  const parts = [bytes.slice(0, cut + 1), bytes.slice(cut + 1, cut + 2), bytes.slice(cut + 2)];
  const seen = [];
  await readEvents(stream(parts), (name, data) => seen.push([name, data]));
  expect(seen).toEqual([['delta', { text: 'tokens per joule ′ ✓' }]]);
});

test('a frame that is not JSON is dropped and the rest still arrives', async () => {
  const seen = [];
  await readEvents(stream(['event: delta\ndata: {not json\n\n', 'event: done\ndata: {}\n\n']), (name) => seen.push(name));
  expect(seen).toEqual(['done']);
});
