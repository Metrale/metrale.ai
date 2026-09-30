// SPDX-License-Identifier: AGPL-3.0-only

// The MoE vLLM manifest built on its own, with its throughput leg only: a
// baseline-only ladder, C=1..16 measured and C=32/64/128 declared unmeasured.
//
// Until 2026-09-29 this was the MoE subject's whole ladder, and the tab state
// it drives ('baseline', ConcurrencyBaseline) still ships for any subject whose
// manifest holds vLLM alone. The subject now pairs a Metrale Engine leg by
// reference, so the tests render that state on this fixture: the real engine
// manifest and raw files, built by the real generator, with the energy leg left
// out (it would fill C=32..128 and leave nothing unmeasured to render) and its
// harness revision with it.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import subjects from '../src/lib/concurrency-subjects.json';
import { buildLadder } from '../scripts/lib/ladder-build.mjs';
import { engineRoot } from '../scripts/lib/engine-root.mjs';

const MOE = subjects.find((s) => s.id === 'qwen36-35b-a3b');
export const MOE_VLLM = { ...MOE, published_manifest: 'bench/baselines/qwen36-35b-a3b/published.json' };

const path = resolve(engineRoot(), MOE_VLLM.published_manifest);
const manifest = JSON.parse(readFileSync(path, 'utf8'));
manifest.series = manifest.series.filter((s) => s.id === 'vllm-mtp');
delete manifest.harness_shas['55a5963e4b'];

export const vllmOnlyLadder = buildLadder(manifest, {
  subject: MOE_VLLM,
  rawOf: (f) => JSON.parse(readFileSync(join(dirname(path), f), 'utf8')),
  harnessRepoSha256: createHash('sha256')
    .update(readFileSync(resolve(engineRoot(), manifest.workload.harness)))
    .digest('hex'),
});
