// Where Metrale's public sources live, in one place, so a move is one edit.
// The site, the blog, the docs build and the generators all read from here.
// Nothing else may spell an engine repository address: ENGINE_SLUG is the one
// line to change when the engine repository's name changes.

/** The engine: code, benchmark records, the ladder, the book and the changelog. */
export const ENGINE_SLUG = 'Metrale/metrale-inference-alpha';
export const ENGINE_REPO = `https://github.com/${ENGINE_SLUG}`;

/** The recipe registry: every model the site lists has a recipe here. */
export const REGISTRY_SLUG = 'Metrale/metralectl';
export const REGISTRY_REPO = `https://github.com/${REGISTRY_SLUG}`;

/** The in-browser vector database the codebase chat loads, by release. */
export const LATTICE_RELEASES = 'https://github.com/Avarok-Cybersecurity/lattice-db/releases/download';

/** The command the install, run and agent instructions print: the registry's own. */
export const CLI = 'metralectl';
