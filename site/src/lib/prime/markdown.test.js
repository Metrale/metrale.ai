// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from 'bun:test';
import { renderMarkdown } from './markdown.js';

test('text is escaped before any markup is made', () => {
  expect(renderMarkdown('<script>alert(1)</script> & "quotes"')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot;</p>');
  expect(renderMarkdown('[x](javascript:alert(1))')).toBe('<p>[x](javascript:alert(1))</p>');
  expect(renderMarkdown('[x](https://e.com/a"onclick="y)')).toBe('<p>[x](https://e.com/a&quot;onclick=&quot;y)</p>');
});

test('links: external ones open in a new tab, site paths and anchors stay in the page', () => {
  expect(renderMarkdown('See [pricing](/pricing#payback) and [the repo](https://github.com/x/y) and [up](#top).')).toBe('<p>See <a href="/pricing#payback">pricing</a> and <a href="https://github.com/x/y" rel="noopener nofollow" target="_blank">the repo</a> and <a href="#top">up</a>.</p>');
  expect(renderMarkdown('[mail](mailto:eric@example.test)')).toBe('<p><a href="mailto:eric@example.test">mail</a></p>');
});

test('citations become marked superscripts and never eat a link', () => {
  expect(renderMarkdown('Eight wins [1]. Two sources [2, 3] and [4][5].')).toBe('<p>Eight wins <sup class="pr-cite" data-n="1">[1]</sup>. Two sources <sup class="pr-cite" data-n="2">[2]</sup><sup class="pr-cite" data-n="3">[3]</sup> and <sup class="pr-cite" data-n="4">[4]</sup><sup class="pr-cite" data-n="5">[5]</sup>.</p>');
  expect(renderMarkdown('[1](/pricing)')).toBe('<p><a href="/pricing">1</a></p>');
});

test('inline: code, bold, italic', () => {
  expect(renderMarkdown('Run `avarokctl up` with **care** and *speed*, _quietly_.')).toBe('<p>Run <code>avarokctl up</code> with <strong>care</strong> and <em>speed</em>, <em>quietly</em>.</p>');
  expect(renderMarkdown('snake_case_name stays')).toBe('<p>snake_case_name stays</p>');
  expect(renderMarkdown('`**not bold**`')).toBe('<p><code>**not bold**</code></p>');
});

test('blocks: headings step down a rank, lists nest once, quotes, rules, fences', () => {
  const md = ['# Top', '## Second', 'Para', '', '- one', '- two', '  - two b', '', '1. first', '2. second', '', '> quoted', '', '---', '', '```js', 'const x = "<b>";', '```'].join('\n');
  expect(renderMarkdown(md)).toBe('<h2>Top</h2><h3>Second</h3><p>Para</p><ul><li>one</li><li>two<ul><li>two b</li></ul></li></ul><ol><li>first</li><li>second</li></ol><blockquote>quoted</blockquote><hr><pre class="pr-fence"><code class="language-js">const x = &quot;&lt;b&gt;&quot;;</code></pre>');
});

test('a table renders with a header row, and a wrapped list item stays one item', () => {
  const md = ['| C | Metrale | vLLM |', '|---|---:|---:|', '| 1 | 23.6 | 19.7 |', '| 128 | 478.1 | 358.6 |'].join('\n');
  expect(renderMarkdown(md)).toBe('<div class="pr-table"><table><thead><tr><th>C</th><th>Metrale</th><th>vLLM</th></tr></thead><tbody><tr><td>1</td><td>23.6</td><td>19.7</td></tr><tr><td>128</td><td>478.1</td><td>358.6</td></tr></tbody></table></div>');
  expect(renderMarkdown('- a long item\n  that wraps\n- next')).toBe('<ul><li>a long item that wraps</li><li>next</li></ul>');
});

test('empty and partial input render safely, so streaming never throws', () => {
  expect(renderMarkdown('')).toBe('');
  expect(renderMarkdown(null)).toBe('');
  expect(renderMarkdown('```js\nunterminated')).toBe('<pre class="pr-fence"><code class="language-js">unterminated</code></pre>');
  expect(renderMarkdown('| half | row')).toBe('<p>| half | row</p>');
  expect(renderMarkdown('**unclosed')).toBe('<p>**unclosed</p>');
});
