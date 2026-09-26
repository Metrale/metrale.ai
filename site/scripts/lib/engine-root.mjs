// The engine repository (ENGINE_SLUG in web-shared/sources.mjs) holds what the site publishes
// about it: benchmark records, gate descriptors, the concurrency ladder and the
// changelog. This repository keeps no copy. A build points METRALE_ENGINE_ROOT at a
// checkout of it; CI uses a sparse one (see .github/workflows/pr.yml).

import { resolve } from 'node:path';
import { ENGINE_REPO } from '../../../web-shared/sources.mjs';

export function engineRoot() {
  const root = process.env.METRALE_ENGINE_ROOT;
  if (!root) {
    throw new Error(`METRALE_ENGINE_ROOT is not set. Point it at a checkout of ${ENGINE_REPO} (site/README.md, "Run it").`);
  }
  return resolve(root);
}
