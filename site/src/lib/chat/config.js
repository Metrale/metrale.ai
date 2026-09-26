// =============================================================================
// config.js — every constant for the "Ask the codebase" feature (SSOT).
// No other chat module hardcodes a URL, model id, batch size, or storage key.
// =============================================================================

import { ENGINE_SLUG } from '../../../../web-shared/sources.mjs';

// --- corpus (published by the engine's coderag workflow to GitHub Pages) -----
// The addresses that workflow names. Nothing is served there until Pages is on
// in the engine's repository, which is why `codeChat.enabled` is false. The
// Pages host is the organisation's, and the path is the repository's name.
const [ENGINE_ORG, ENGINE_NAME] = ENGINE_SLUG.split('/');
const CORPUS_BASE = `https://${ENGINE_ORG.toLowerCase()}.github.io/${ENGINE_NAME}/coderag`;
export const CORPUS_GZ_URL = `${CORPUS_BASE}/metrale-coderag.jsonl.gz`;
export const CORPUS_META_URL = `${CORPUS_BASE}/metrale-coderag.jsonl.meta.json`;

// --- OpenRouter --------------------------------------------------------------
export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';
// Free-tier models (mirrors the LatticeDB rag-example) — zero cost to visitors.
export const EMBEDDING_MODEL = 'nvidia/llama-nemotron-embed-vl-1b-v2:free';
export const RERANK_MODEL = 'nvidia/llama-nemotron-rerank-vl-1b-v2:free';
export const CHAT_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';
// Attribution headers OpenRouter asks apps to send.
export const APP_TITLE = 'Metrale Ask the Codebase';
export const SITE_ORIGIN = 'https://metrale.ai';
// Retry policy for the shared free-tier capacity (ResourceExhausted bursts).
export const OR_MAX_ATTEMPTS = 3;
export const OR_RETRY_BASE_MS = 700;

// --- retrieval ---------------------------------------------------------------
export const TOP_K = 3;
// Vector-search candidates fetched per requested result; the cross-encoder
// reranker then picks the final TOP_K out of TOP_K * RERANK_MULTIPLIER.
export const RERANK_MULTIPLIER = 4;

// --- indexing ----------------------------------------------------------------
// Points upserted into the wasm collection per batch, with an idle yield
// between batches so the main thread stays responsive while indexing.
export const UPSERT_BATCH = 256;
// Name of the (single) LatticeDB collection holding the corpus.
export const COLLECTION = 'metrale-code';

// --- vendored LatticeDB wasm (emitted by scripts/gen-lattice.mjs) ------------
export const WASM_JS_URL = '/lattice/lattice_server.js';
export const WASM_BIN_URL = '/lattice/lattice_server_bg.wasm';
// Cache API bucket used only for the optional idle wasm prefetch.
export const WASM_PREFETCH_CACHE = 'metrale-lattice-wasm';

// --- storage -----------------------------------------------------------------
// localStorage key holding the visitor's OpenRouter API key.
export const LS_OPENROUTER_KEY = 'metrale-openrouter-key';
// The visitor may point the answer model somewhere else, e.g. at the paid twin
// of the default when their free daily allowance is spent. Retrieval models are
// deliberately NOT overridable: the embedder has no paid endpoint at all, and a
// different embedder would not match the vectors the corpus was built with.
export const LS_CHAT_MODEL = 'metrale-openrouter-chat-model';
// OPFS file name for the decompressed corpus, keyed by corpus commit SHA.
export const latticeFileName = (sha) => 'lattice-db-' + sha + '.jsonl';
// Matches files produced by latticeFileName(); capture group 1 is the SHA.
export const LATTICE_FILE_RE = /^lattice-db-(.+)\.jsonl$/;
