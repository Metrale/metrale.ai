// SPDX-License-Identifier: AGPL-3.0-only

// target-notes.js: the account behind a flagged vLLM target. A BENCH.toml
// entry may flag one of its targets (`target_caveats`), for a reference figure
// that is not a clean bar, such as a single sample of a run that most likely
// stalled. Wherever the page prints that target, it prints the caveat beside it
// as a mark, and the mark links to the entry's note in an "About these targets"
// disclosure under the same table. A flagged target is never printed bare.
//
// Pure: the grids call it with what gen-gates.mjs#gate_context declares.

/** The notes the marks of these entries link to: one per gate that flags a target, in gate order. */
export function caveatNotes(entries) {
  const byGate = new Map();
  for (const e of entries) {
    if (e.note && Object.keys(e.caveats ?? {}).length > 0) byGate.set(e.gate, e.note);
  }
  return [...byGate].sort(([a], [b]) => a.localeCompare(b)).map(([gate, note]) => ({ gate, note }));
}

/** The element id of `gate`'s note inside the disclosure of table `scope`. */
export const noteId = (scope, gate) => `tn-${scope}-${gate}`.replace(/[^A-Za-z0-9_-]/g, '-');
