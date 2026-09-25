// SPDX-License-Identifier: AGPL-3.0-only
//
// How a page or a document becomes passages the chatbot can cite
// (scripts/prime/chunk.mjs). The builder itself reads the build, so it is not
// run here; the cutting is what can go quietly wrong.
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
