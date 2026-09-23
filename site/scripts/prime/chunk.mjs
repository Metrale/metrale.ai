// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// chunk.mjs — how a page or a document becomes passages the chatbot can cite.
// -----------------------------------------------------------------------------
// Pure functions, no I/O, tested by src/lib/prime-corpus.test.js. corpus.mjs
// is the script that reads the files and calls these.
// =============================================================================

// The visible words of a fragment of our own built HTML. Entities are decoded in
// one pass from a table, the way gen-site-guide.mjs does it.
const ENTITY = { amp: '&', quot: '"', apos: "'", '#39': "'", nbsp: ' ', lt: '<', gt: '>', '#x27': "'", '#8217': '’', '#8220': '“', '#8221': '”' };
export function htmlToText(html) {
  return String(html ?? '')
    .replace(/<(script|style|svg|video|noscript)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h[1-6]|tr|div|section|article|blockquote|dd|dt|figcaption)>/gi, '\n')
    // An inline tag is not a word break: "<b>stronger</b>." reads "stronger."
    .replace(/<\/?(a|b|strong|i|em|span|code|sup|sub|small|abbr|time|mark|u|s)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(amp|quot|apos|#39|nbsp|lt|gt|#x27|#8217|#8220|#8221);/g, (_, name) => ENTITY[name])
    .replace(/[→↗↓↑✓✕]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/**
 * The sections of a page: what stands under each heading, with the nearest id
 * for an anchor. Text before the first heading is the page's opening.
 * @returns {Array<{ heading: string, level: number, id: string, html: string }>}
 */
export function sectionsFromHtml(html) {
  const src = String(html ?? '');
  // Sections and articles open and close; headings cut. A heading's anchor is
  // its own id, else the id of the innermost open section, else the id of the
  // nearest heading above it in the outline.
  const re = /<(section|article)\b([^>]*)>|<\/(section|article)\s*>|<h([1-3])\b([^>]*)>([\s\S]*?)<\/h\4\s*>/gi;
  const open = [];
  const above = [];
  const names = []; // the heading text at each level, so a sub heading carries its parent: "Team › Peter Drybrough"
  const out = [];
  let cur = { heading: '', level: 0, id: '', trail: [], start: 0 };
  const cut = (end) => out.push({ heading: cur.heading, level: cur.level, id: cur.id, trail: cur.trail, html: src.slice(cur.start, end) });
  let m;
  while ((m = re.exec(src))) {
    if (m[1]) {
      open.push(m[2].match(/\sid="([^"]+)"/)?.[1] ?? '');
      continue;
    }
    if (m[3]) {
      open.pop();
      continue;
    }
    cut(m.index);
    const level = Number(m[4]);
    const own = m[5].match(/\sid="([^"]+)"/)?.[1];
    const section = [...open].reverse().find(Boolean) ?? '';
    const inherited = above.slice(0, level - 1).reverse().find(Boolean) ?? '';
    const id = own ?? (section || inherited);
    above.length = level;
    above[level - 1] = id;
    const heading = htmlToText(m[6]);
    names.length = level;
    names[level - 1] = heading;
    // Level 1 is the page's own title, which the passage already carries.
    const trail = names.slice(1, level).filter(Boolean);
    cur = { heading, level, id, trail, start: m.index + m[0].length };
  }
  cut(src.length);
  return out.filter((s) => s.heading || htmlToText(s.html).trim());
}

/**
 * A run of small sub sections under one parent (five team cards, four FAQ
 * answers) reads as one passage, not five: a question about "the team" should
 * land on the whole team. Level 3 sections that follow a level 2 section are
 * merged into it while the result stays under `max` characters of text; each
 * keeps its heading as a lead-in.
 */
export function mergeSmallSiblings(sections, { max = 1600 } = {}) {
  const out = [];
  for (const s of sections) {
    const last = out[out.length - 1];
    const parentText = last ? htmlToText(last.html) : '';
    const childText = htmlToText(s.html);
    const fits = last && s.level === 3 && (last.level === 2 || last.merged) && last.trail?.[0] === s.trail?.[0] && parentText.length + childText.length + s.heading.length < max;
    if (fits) {
      last.html += `\n<p><b>${s.heading}.</b> ${s.html}</p>`;
      last.merged = true;
      continue;
    }
    out.push({ ...s });
  }
  return out.map(({ merged, ...s }) => s);
}

/**
 * Cut a text into passages of at most `max` characters at sentence ends, and
 * fold passages shorter than `min` into their neighbour.
 */
export function chunkText(text, { max = 1400, min = 80 } = {}) {
  const clean = String(text ?? '').replace(/\s+\n/g, '\n').trim();
  if (!clean) return [];
  if (clean.length <= max) return clean.length >= min ? [clean] : [clean];
  const sentences = clean.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])|\n+/).filter(Boolean);
  const out = [];
  let cur = '';
  for (const s of sentences) {
    if (s.length > max) {
      if (cur) out.push(cur.trim());
      cur = '';
      for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max).trim());
      continue;
    }
    if ((cur + ' ' + s).trim().length > max) {
      out.push(cur.trim());
      cur = s;
    } else {
      cur = cur ? `${cur} ${s}` : s;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  // Fold the small ones.
  const folded = [];
  for (const c of out) {
    if (folded.length && (c.length < min || folded[folded.length - 1].length < min) && folded[folded.length - 1].length + c.length + 1 <= max) folded[folded.length - 1] += ` ${c}`;
    else folded.push(c);
  }
  return folded;
}

/** A URL fragment for a heading, the way GitHub makes them. */
export function slug(heading) {
  return String(heading ?? '')
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * The sections of a markdown document: heading, level, and the text beneath
 * it as plain prose. Code fences are kept but trimmed to a few lines, images
 * are dropped, links keep their text and their address.
 */
export function markdownSections(md, { fenceLines = 12 } = {}) {
  const lines = String(md ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let cur = { heading: '', level: 0, lines: [] };
  let inFence = false;
  let fenceKept = 0;
  for (const raw of lines) {
    if (/^\s*```/.test(raw)) {
      inFence = !inFence;
      fenceKept = 0;
      cur.lines.push(inFence ? '' : '');
      continue;
    }
    if (inFence) {
      if (fenceKept < fenceLines) cur.lines.push(raw);
      fenceKept++;
      continue;
    }
    const h = raw.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/);
    if (h) {
      out.push(cur);
      cur = { heading: h[2].replace(/[`*_]/g, '').trim(), level: h[1].length, lines: [] };
      continue;
    }
    cur.lines.push(raw);
  }
  out.push(cur);
  return out
    .map((s) => ({
      heading: s.heading,
      level: s.level,
      text: s.lines
        .join('\n')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => (/^https?:/.test(u) ? `${t} (${u})` : t))
        .replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/gm, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    }))
    .filter((s) => s.text || s.heading);
}

/** The front matter of a blog post, and the body after it. */
export function frontMatter(md) {
  const m = String(md ?? '').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: String(md ?? '') };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
  }
  return { meta, body: m[2] };
}
