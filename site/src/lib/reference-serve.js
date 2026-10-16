// SPDX-License-Identifier: AGPL-3.0-only

// reference-serve.js: the context of the vLLM serve behind a model's targets
// (`target_max_model_len`, gen-gates.mjs#gate_context `target_context`). A
// target is one serve's figure; a row served at another context compares
// against that same figure, so the page says so instead of letting identical
// bars on every row read as like-for-like:
//   - every vLLM line names its serve: "vLLM (256k serve)";
//   - a row below that context: "vLLM not run at 64k; bar is its 256k serve";
//   - a row above it: "vLLM not run at 512k (its serve max is 256k)";
//   - the row at that context, or with either context unknown, gets nothing.
// The qualifier sits beside the verdict and never replaces or moves it.
//
// Pure: the grids call it with what gen-gates.mjs declares.

/** "64k" for 65536: the context as people say it. */
export const contextLabel = (tokens) => (tokens % 1024 === 0 ? `${tokens / 1024}k` : String(tokens));

/** How a vLLM line is introduced: with its serve's context when that is declared. */
export const vllmLabel = (refContext) => (refContext ? `vLLM (${contextLabel(refContext)} serve)` : 'vLLM');

/** What a row served at `context` must say about a bar from a serve at `refContext`, or null. */
export function rowQualifier(context, refContext) {
  if (!context || !refContext || context === refContext) return null;
  const at = contextLabel(context);
  const serve = contextLabel(refContext);
  return context < refContext ? `vLLM not run at ${at}; bar is its ${serve} serve` : `vLLM not run at ${at} (its serve max is ${serve})`;
}

/** The distinct qualifiers of a row whose cells may name their own serves, in first-seen order. */
export const rowQualifiers = (context, refContexts) => [...new Set(refContexts.map((ref) => rowQualifier(context, ref)).filter(Boolean))];
