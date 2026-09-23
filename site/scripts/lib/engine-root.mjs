// The engine repository (Avarok-Cybersecurity/atlas) holds what the site publishes
// about it: benchmark records, gate descriptors, the concurrency ladder and the
// changelog. This repository keeps no copy. A build points AVAROK_ENGINE_ROOT at a
// checkout of it; CI uses a sparse one (see .github/workflows/pr.yml).

import { resolve } from 'node:path';

export function engineRoot() {
  const root = process.env.AVAROK_ENGINE_ROOT;
  if (!root) {
    throw new Error(
      'AVAROK_ENGINE_ROOT is not set. Point it at a checkout of github.com/Avarok-Cybersecurity/atlas (site/README.md, "Run it").'
    );
  }
  return resolve(root);
}
