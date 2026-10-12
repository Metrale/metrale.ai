// SPDX-License-Identifier: AGPL-3.0-only
import { gateFamilies, loadRecords } from '$lib/gates.js';

// The page opens on the first gate family, so only that family's records are
// loaded before it starts; the others load when their tab is reached for
// (+page.svelte). On the server every record is already in memory.
export async function load() {
  if (gateFamilies.length > 0) await loadRecords(gateFamilies[0].benches);
}
