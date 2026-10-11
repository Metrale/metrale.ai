// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// config.js — the site's configuration of the codebase chat library (SSOT).
// -----------------------------------------------------------------------------
// The chat is AutoRepoRAG's website-chat library, vendored at the release in
// chat/pin.js into static/repo-chat/<version>/ by scripts/gen-repo-chat.mjs.
// Its one call takes a complete configuration with no defaults; this builds it.
// Pure: what only the page knows (the mount point, the library's own English
// copy, the two model ids from the build, the close callback) is passed in.
// Nothing else in the site names a corpus, the chat's storage prefix or the
// library's address.
// =============================================================================

import { ENGINE_SLUG } from '../../../../web-shared/sources.mjs';
import { SITE, company } from '../content/brand.js';
import { codeChat } from '../data.js';
import { REPO_CHAT_VERSION } from './pin.js';

// --- the corpora --------------------------------------------------------------
// Published by the engine's CodeRAG workflow to its GitHub Pages site, one
// lattice-jsonl file per corpus: <name>.jsonl.gz beside <name>.jsonl.meta.json.
// The Pages host is the organisation's and the path is the repository's name.
// Every corpus listed here must be live: the library refuses to open when one
// cannot be fetched, and all of them must share one embedding model and
// dimension (each meta.json names its own). `id` is what the chat prints for a
// corpus and keys its browser cache; never reuse one for different content.
// `name` is the published basename. This list is the only place a corpus is
// named: adding, removing or splitting one (the code index is to become
// metrale-code-crates and metrale-code-kernels) is an edit here alone.
const [ENGINE_ORG, ENGINE_NAME] = ENGINE_SLUG.split('/');
export const CORPUS_BASE = `https://${ENGINE_ORG.toLowerCase()}.github.io/${ENGINE_NAME}/coderag`;
export const CORPORA = Object.freeze([
  { id: 'code', name: 'metrale-coderag' },
  { id: 'docs', name: 'metrale-docs' },
  { id: 'rust-book', name: 'books-rust' },
]);

/** A corpus as the library takes it. */
export const corpusUrls = ({ id, name }) => ({
  id,
  gzUrl: `${CORPUS_BASE}/${name}.jsonl.gz`,
  metaUrl: `${CORPUS_BASE}/${name}.jsonl.meta.json`,
});

// --- the library, served from this origin ---------------------------------------
export const REPO_CHAT_BASE = `/repo-chat/${REPO_CHAT_VERSION}/`;
export const REPO_CHAT_MODULE_URL = `${REPO_CHAT_BASE}repo-chat.js`;
export const WASM_BIN_URL = `${REPO_CHAT_BASE}lattice_server_bg.wasm`;

// --- OpenRouter -----------------------------------------------------------------
export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';

// --- browser storage --------------------------------------------------------------
// The library names its localStorage keys `<prefix>openrouter-key` and
// `<prefix>openrouter-chat-model`. These are the names the site's own chat used,
// so a visitor's saved key and answer model carry over.
export const STORAGE_KEY_PREFIX = 'metrale-';

// The site's design tokens, by the library's theme keys. Live var() references,
// so the chat follows the light and dark switch while it is open.
export const THEME = Object.freeze({
  bg: 'var(--bg)',
  bg2: 'var(--bg2)',
  card: 'var(--card)',
  border: 'var(--border)',
  borderStrong: 'var(--border-strong)',
  text: 'var(--t1)',
  text2: 'var(--t2)',
  text3: 'var(--t3)',
  accent: 'var(--accent)',
  accentSoft: 'var(--accent-soft)',
  onAccent: 'var(--on-accent)',
  green: 'var(--green)',
  amber: 'var(--amber)',
  fontMono: 'var(--font-mono)',
  fontSans: 'var(--font-sans)',
  shadowLg: 'var(--shadow-lg)',
});

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** `base` with `overrides` laid over it, object by object; a string or a list is replaced whole. */
export function mergeCopy(base, overrides) {
  const out = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    out[key] = isPlainObject(value) && isPlainObject(base[key]) ? mergeCopy(base[key], value) : value;
  }
  return out;
}

/**
 * The configuration `openRepoChat` and `warmRepoChat` take.
 * @param {{ mount: Element, copyEn: object, models: { chatModel: string, rerankModel: string }, onClose: () => void }} page
 */
export function repoChatConfig({ mount, copyEn, models, onClose }) {
  return {
    mount,
    assets: { cssHref: `${REPO_CHAT_BASE}repo-chat.css` },
    wasm: { jsUrl: `${REPO_CHAT_BASE}lattice_server.js`, binUrl: WASM_BIN_URL },
    corpora: CORPORA.map(corpusUrls),
    provider: {
      apiUrl: OPENROUTER_API_URL,
      rerankModel: models.rerankModel,
      chatModel: models.chatModel,
      appTitle: `${company.engine}: Ask the Codebase`,
      referer: SITE,
      // The free models share capacity and answer bursts with ResourceExhausted.
      maxAttempts: 3,
      retryBaseMs: 700,
    },
    // Three sources per answer, chosen by the reranker from twelve candidates;
    // 256 points indexed between yields keeps the page responsive while loading.
    retrieval: { topK: 3, rerankMultiplier: 4, upsertBatch: 256 },
    storage: { keyPrefix: STORAGE_KEY_PREFIX },
    copy: mergeCopy(copyEn, codeChat.copy),
    // The engine's name in the system prompt. No watermark behind the log.
    brand: { productName: company.engine, motifSvg: null },
    theme: { ...THEME },
    onClose,
  };
}
