// Where Metrale's public sources live, in one place, so a move is one edit.
// The site, the blog, the docs build and the generators all read from here.

/** The engine: code, benchmark records, the ladder, the book and the changelog. */
export const ENGINE_SLUG = 'Metrale/metrale-inference-alpha';
export const ENGINE_REPO = `https://github.com/${ENGINE_SLUG}`;

/** The recipe registry: every model the site lists has a recipe here. */
export const REGISTRY_SLUG = 'Metrale/metralectl';
export const REGISTRY_REPO = `https://github.com/${REGISTRY_SLUG}`;

/**
 * The history of the open source code Metrale Engine builds on: the commits the
 * published records name and the pull requests they cite. metrale.ai redirects
 * this path to wherever that history lives (site/static/_redirects), so no page
 * names another project's home, and a change of address is one line there.
 */
export const HISTORY = 'https://metrale.ai/src/history';
export const HISTORY_SLUG = 'Avarok-Cybersecurity/atlas';

/**
 * Names that belong to other projects, not to Metrale. Nothing a visitor reads
 * may carry them: site/src/lib/content/other-names.test.js reads the site, the
 * blog and the shared files with this, and docs/check.mjs reads the built book.
 * This file and the history redirects are the only places they are written down.
 */
export const OTHER_NAMES = /\b(?:atlas|avarok)\b/i;

/** The in-browser vector database the codebase chat loads, by release. */
export const LATTICE_RELEASES = 'https://github.com/Avarok-Cybersecurity/lattice-db/releases/download';

/**
 * The command people install today. The registry's own command replaces it
 * once it ships a downloadable release and the site's control plane speaks its
 * agent protocol; site/FACELIFT.md, "What still moves", has the checklist.
 */
export const CLI = 'atlasctl';
