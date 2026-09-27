// Where Metrale's public sources live, in one place, so a move is one edit.
// The site, the blog, the docs build and the generators all read from here.
// Nothing else may spell an engine repository address: ENGINE_SLUG is the one
// line to change when the engine repository's name changes.

/** The engine: code, benchmark records, the ladder, the book and the changelog. */
export const ENGINE_SLUG = 'Metrale/metrale-inference';
export const ENGINE_REPO = `https://github.com/${ENGINE_SLUG}`;

/**
 * The recipes: every model the site lists has one, in the engine's recipes/.
 * The build reads them from the engine checkout at site/engine.ref.
 */
export const RECIPES_DIR = 'recipes';
export const RECIPES_URL = `${ENGINE_REPO}/tree/main/${RECIPES_DIR}`;

/** The launcher: the CLI's README and the installers the site serves. */
export const LAUNCHER_SLUG = 'Metrale/metralectl';
export const LAUNCHER_REPO = `https://github.com/${LAUNCHER_SLUG}`;

/** The in-browser vector database the codebase chat loads, by release. */
export const LATTICE_RELEASES = 'https://github.com/Avarok-Cybersecurity/lattice-db/releases/download';

/** The command the install, run and agent instructions print: the launcher's own. */
export const CLI = 'metralectl';
