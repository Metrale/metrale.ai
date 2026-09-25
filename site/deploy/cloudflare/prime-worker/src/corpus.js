// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// corpus.js — the knowledge base and how it is searched.
// -----------------------------------------------------------------------------
// The knowledge base is a list of short documents: a section of a page on the
// site, a section of a document in the repository, a blog post, a slice of
// the repository's history, or, in the partner tier, a slide of the deck.
// scripts/prime/corpus.mjs writes it; this file only reads it.
//
// Search is BM25 over words, in the Worker, with no service behind it. The
// base is a few hundred documents about one company, and the model asks for
// what it needs in its own words and asks again when the first answer is
// thin, so lexical search with a small stemmer and the brand's synonyms is
// enough. A vector index (Cloudflare Vectorize and a Workers AI embedder) is
// the upgrade if the base grows past a few thousand documents; the shape of
// `search()` is the only contract the rest of the Worker relies on.
// =============================================================================

const SYNONYMS = new Map([
  ['gpus', 'gpu'],
  ['tokens', 'token'],
  ['tok', 'token'],
  ['kernels', 'kernel'],
  ['benchmarks', 'benchmark'],
  ['recipes', 'recipe'],
  ['workloads', 'workload'],
  ['licence', 'license'],
  ['licences', 'license'],
  ['licenses', 'license'],
  ['ce', 'community'],
  ['oss', 'open'],
  ['vllm', 'vllm'],
  ['tps', 'throughput'],
  ['hyperscaler', 'hyperscale'],
  ['hyperscalers', 'hyperscale'],
  ['datacenters', 'datacenter'],
  ['datacentre', 'datacenter'],
  ['datacentres', 'datacenter'],
  ['founders', 'founder'],
  ['investors', 'investor'],
  ['prices', 'price'],
  ['pricing', 'price'],
  ['costs', 'cost'],
]);
const STOP = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'is',
  'are',
  'it',
  'its',
  'as',
  'at',
  'by',
  'be',
  'this',
  'that',
  'with',
  'from',
  'was',
  'were',
  'do',
  'does',
  'what',
  'how',
  'who',
  'which',
  'when',
  'where',
  'why',
  'you',
  'your',
  'we',
  'our',
  'i',
  'me',
  'my',
  'can',
  'will',
  'would',
  'about',
  'tell',
  'us',
  'they',
  'them',
  'their',
  'have',
  'has',
  'not',
  'if',
  'than',
  'then',
  'so',
  'into',
  'any',
  'all',
  'more',
  'most',
  'some',
  'there',
  'here',
  'also',
  'much',
  'many',
]);

/** A light stemmer: plurals and the two common verb endings. Enough for search, wrong for grammar. */
function stem(w) {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/** Words of a text, lowercased, stemmed, synonyms folded, stop words dropped. */
export function tokenize(text) {
  const out = [];
  for (const raw of String(text ?? '')
    .toLowerCase()
    .split(/[^a-z0-9+.]+/)) {
    const w = raw.replace(/^[.+]+|[.+]+$/g, '');
    if (w.length < 2 || STOP.has(w)) continue;
    out.push(SYNONYMS.get(w) ?? stem(w));
  }
  return out;
}

const K1 = 1.2;
const B = 0.75;

/** A BM25 index over documents `{ id, tier, kind, title, url, section, text }`. */
export class Index {
  constructor(docs) {
    this.docs = docs;
    this.df = new Map();
    this.tf = [];
    this.len = [];
    let total = 0;
    for (const d of docs) {
      // The title and the section heading count twice: a question that names a
      // page or a section should land on it ahead of a page that merely mentions
      // the word. The heading is the author's own statement of what the passage
      // is about ("What the name means"), and a short question about a topic
      // usually shares its words with the heading, not with the body.
      const tokens = [
        ...tokenize(d.title),
        ...tokenize(d.section ?? ''),
        ...tokenize(d.title),
        ...tokenize(d.section ?? ''),
        ...tokenize(d.text),
      ];
      const counts = new Map();
      for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
      for (const t of counts.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      this.tf.push(counts);
      this.len.push(tokens.length);
      total += tokens.length;
    }
    this.avg = docs.length ? total / docs.length : 1;
  }

  /**
   * The best `k` documents for a question. `tiers` is which tiers may answer
   * (a visitor without a partner code searches the public tier only), and
   * `kinds` narrows to page, doc, post, history or deck when the model asks.
   */
  search(query, { k = 6, tiers = ['public'], kinds = null } = {}) {
    const q = [...new Set(tokenize(query))];
    if (q.length === 0) return [];
    const N = this.docs.length;
    const scored = [];
    for (let i = 0; i < N; i++) {
      const d = this.docs[i];
      if (!tiers.includes(d.tier)) continue;
      if (kinds && !kinds.includes(d.kind)) continue;
      const tf = this.tf[i];
      let s = 0;
      for (const t of q) {
        const f = tf.get(t);
        if (!f) continue;
        const n = this.df.get(t) ?? 0;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        s += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * this.len[i]) / this.avg)));
      }
      if (s > 0) scored.push({ doc: d, score: s });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }
}

/**
 * The base, read from KV once per isolate. Two keys: `corpus:public` always,
 * `corpus:partner` when it exists. `env.PRIME` is the KV namespace; a missing
 * base is an empty index, and the answer says so rather than failing.
 */
// Re-read after this long, so a base uploaded after a copy change takes
// effect without a redeploy, and a long-lived isolate never serves last week's site.
const MAX_AGE_MS = 10 * 60 * 1000;
let cached = null;
let cachedAt = 0;
export async function loadIndex(env, { force = false } = {}) {
  if (cached && !force && Date.now() - cachedAt < MAX_AGE_MS) return cached;
  const docs = [];
  let manifest = { built: null, site: null, commit: null, public: 0, partner: 0 };
  if (env.PRIME) {
    for (const tier of ['public', 'partner']) {
      let raw;
      try {
        raw = await env.PRIME.get(`corpus:${tier}`, 'json');
      } catch {
        raw = null;
      }
      if (!raw?.docs) continue;
      for (const d of raw.docs) docs.push({ ...d, tier });
      manifest[tier] = raw.docs.length;
      if (tier === 'public') manifest = { ...manifest, built: raw.built ?? null, site: raw.site ?? null, commit: raw.commit ?? null };
    }
  }
  cached = { index: new Index(docs), manifest };
  cachedAt = Date.now();
  return cached;
}

/** For tests: forget the isolate's copy. */
export function resetIndex() {
  cached = null;
  cachedAt = 0;
}
