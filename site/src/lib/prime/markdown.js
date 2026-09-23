// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// markdown.js — the answer, rendered. Escape first, then build every tag by
// hand, so the output is safe for {@html} by construction: no raw HTML from
// the model ever reaches the page, and the only attributes emitted are a fixed
// rel and target on external links, an http(s) or site-relative href, and the
// number on a citation.
//
// Supported: paragraphs, headings (## and ### become h3 and h4, so the panel's
// own heading keeps rank), fenced code, inline code, bold, italic, links,
// unordered and ordered lists with one level of nesting, blockquotes, tables,
// horizontal rules, and [n] citations, which become <sup class="pr-cite">
// with a data-n attribute the message card wires to its sources.
// =============================================================================

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// An href that is safe to emit: absolute http(s), or a path on this site. The
// text is already escaped, so the attribute cannot break out.
const SAFE_HREF = /^(https?:\/\/[^\s"'<>]+|\/[^\s"'<>]*|#[\w-]+|mailto:[^\s"'<>]+)$/;

function renderSegment(escaped) {
  let out = escaped;
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, href) => {
    // An address carrying a quote or an angle bracket (escaped by now, so it
    // cannot break the attribute) is not an address anyone meant: leave it as text.
    if (!SAFE_HREF.test(href) || /&(quot|#39|lt|gt);/.test(href)) return m;
    const external = /^https?:\/\//.test(href);
    return `<a href="${href}"${external ? ' rel="noopener nofollow" target="_blank"' : ''}>${text}</a>`;
  });
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  out = out.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  // [n] citations, after links so a link opener is never eaten. [1][2] and [1, 2] both work.
  out = out.replace(/\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\](?!\()/g, (m, list) =>
    list
      .split(/\s*,\s*/)
      .map((n) => `<sup class="pr-cite" data-n="${n}">[${n}]</sup>`)
      .join('')
  );
  return out;
}

function renderInline(text) {
  return escapeHtml(text)
    .split(/(`[^`\n]+`)/)
    .map((part) =>
      part.length > 2 && part.startsWith('`') && part.endsWith('`') ? `<code>${part.slice(1, -1)}</code>` : renderSegment(part)
    )
    .join('');
}

const UL = /^(\s*)[-*+]\s+(.*)$/;
const OL = /^(\s*)\d+[.)]\s+(.*)$/;

function renderList(lines) {
  // Two levels: a line indented by two or more spaces nests under the item above.
  const items = [];
  for (const line of lines) {
    const m = line.match(UL) ?? line.match(OL);
    const ordered = OL.test(line);
    const depth = m[1].length >= 2 ? 1 : 0;
    const text = m[2];
    if (depth === 1 && items.length) items[items.length - 1].children.push({ text, ordered });
    else items.push({ text, ordered, children: [] });
  }
  const tag = items[0]?.ordered ? 'ol' : 'ul';
  const inner = items
    .map((it) => {
      let li = `<li>${renderInline(it.text)}`;
      if (it.children.length) {
        const t = it.children[0].ordered ? 'ol' : 'ul';
        li += `<${t}>${it.children.map((c) => `<li>${renderInline(c.text)}</li>`).join('')}</${t}>`;
      }
      return `${li}</li>`;
    })
    .join('');
  return `<${tag}>${inner}</${tag}>`;
}

const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
const isTableRule = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);

function renderTable(lines) {
  const cells = (l) =>
    l
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim());
  const [head, ...rest] = lines;
  const body = rest.filter((l) => !isTableRule(l));
  const thead = `<thead><tr>${cells(head)
    .map((c) => `<th>${renderInline(c)}</th>`)
    .join('')}</tr></thead>`;
  const tbody = body.length
    ? `<tbody>${body
        .map(
          (r) =>
            `<tr>${cells(r)
              .map((c) => `<td>${renderInline(c)}</td>`)
              .join('')}</tr>`
        )
        .join('')}</tbody>`
    : '';
  return `<div class="pr-table"><table>${thead}${tbody}</table></div>`;
}

/**
 * Render markdown `src` to an HTML string.
 * @param {string} src
 * @returns {string}
 */
export function renderMarkdown(src) {
  if (typeof src !== 'string' || src.length === 0) return '';
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let block = [];
  let kind = '';

  const flush = () => {
    if (block.length === 0) return;
    if (kind === 'list') html.push(renderList(block));
    else if (kind === 'table') html.push(renderTable(block));
    else if (kind === 'quote')
      html.push(`<blockquote>${block.map((l) => renderInline(l.replace(/^\s*>\s?/, ''))).join('<br>')}</blockquote>`);
    else html.push(`<p>${block.map(renderInline).join('<br>')}</p>`);
    block = [];
    kind = '';
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*```([\w+-]*)\s*$/);
    if (fence) {
      flush();
      const lang = fence[1];
      const code = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++]);
      html.push(`<pre class="pr-fence"><code${lang ? ` class="language-${lang}"` : ''}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    if (line.trim() === '') {
      flush();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flush();
      const level = Math.min(4, heading[1].length + 1);
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }
    if (/^\s*([-*_])\s*\1\s*\1[\s\1]*$/.test(line)) {
      flush();
      html.push('<hr>');
      continue;
    }
    const next = UL.test(line) || OL.test(line) ? 'list' : isTableRow(line) ? 'table' : /^\s*>/.test(line) ? 'quote' : 'para';
    if (kind && next !== kind && !(kind === 'list' && next === 'para' && /^\s{2,}\S/.test(line))) flush();
    if (kind === 'list' && next === 'para') {
      // A wrapped continuation of the last item.
      block[block.length - 1] += ` ${line.trim()}`;
      continue;
    }
    kind = next;
    block.push(line);
  }
  flush();
  return html.join('');
}
