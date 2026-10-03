// SPDX-License-Identifier: AGPL-3.0-only

// record-landing.mjs — the commit on the dashboard's history that brought each
// committed gate record in.
//
// A record's `git_sha` is the commit its campaign measured: the head of a PR
// or a batch branch. Those land on the engine's main by SQUASH merge, so the
// measured commit is never an ancestor of main, and "is git_sha in the history
// the dashboard was generated from" answers no (or, when its branch is gone,
// "unknown") for every record. The question the page can answer for every
// committed record is a different one: which commit on that history added the
// record file. That commit carries the merge, its PR number and its date.
//
// Input: the output of
//   git log --format=@%H%x09%ct%x09%s --diff-filter=A --name-only HEAD -- .benchmarks
// (newest first). For each path the NEWEST add wins: it is the add that put
// the file now in the tree there (an older add was followed by a delete).
// Pure, so the parser is tested on text the call site produces.

const HEADER = /^@([0-9a-f]{40})\t(\d+)\t(.*)$/;
// A squash merge's subject ends with "(#NN)"; a merge commit's says "#NN from".
const PR = /\(#(\d+)\)\s*$|^Merge pull request #(\d+)\b/;

/**
 * @param {string} logText
 * @returns {Map<string, {sha: string, committed_at: number, pr: number|null}>}
 */
export function parseRecordLanding(logText) {
  const out = new Map();
  let cur = null;
  for (const line of String(logText).split('\n')) {
    const m = HEADER.exec(line);
    if (m) {
      const pr = PR.exec(m[3]);
      cur = { sha: m[1], committed_at: Number(m[2]), pr: pr ? Number(pr[1] ?? pr[2]) : null };
      continue;
    }
    const path = line.trim();
    if (cur && path.endsWith('.json') && !out.has(path)) out.set(path, cur);
  }
  return out;
}
