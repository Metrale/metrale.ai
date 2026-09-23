// The words that change when the engine's book is published as Metrale's.
//
// The book is written and kept in the engine's repository, where the engine is
// still called Atlas. Published from here it reads as Metrale Engine, and this
// module is the whole of that translation: an ordered list of phrases, applied
// with the same word boundary the site's rename uses, so an identifier, a path,
// a crate name, a repository address or a command is never touched. Only the
// capitalised name changes; `atlas` in a command, `atlasctl`, `atlas-recipes`
// and `github.com/Avarok-Cybersecurity/atlas` stay exactly as they are, because
// they are real names of real things. When the engine's repository renames,
// every pair here stops matching and the pass becomes a no-op.
//
// Plain ESM with no imports, so the unit runner and the build script share it.

/** Longest phrases first, so "Atlas Inference Engine" is not half-replaced. */
export const RENAMES = [
  ['The Atlas Book', 'The Metrale Engine Book'],
  ['Atlas Contributors', 'Metrale Engine contributors'],
  ['Atlas Cybernetics Corp.', 'Metrale Corp.'],
  ['Atlas Cybernetics', 'Metrale'],
  ['Atlas Inference Engine', 'Metrale Engine'],
  ['Atlas Inference', 'Metrale Engine'],
  ['Atlas Docs', 'Metrale Engine docs'],
  ['Atlas', 'Metrale Engine'],
];

/** Hosts move as hosts, inside addresses, without a word boundary. */
export const HOSTS = [
  ['docs.atlascybernetics.ai', 'docs.metrale.ai'],
  ['blog.atlascybernetics.ai', 'blog.metrale.ai'],
  ['www.atlascybernetics.ai', 'www.metrale.ai'],
  ['atlascybernetics.ai', 'metrale.ai'],
];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The boundary from site/scripts/brand/rename.mjs: not inside a word, not
 *  joined by a hyphen, not a path segment, not a file extension. */
export const word = (w) => new RegExp(`(?<![\\w-])(?<![\\w.]/)(?<![\\w]\\.)${escape(w)}(?![\\w-])(?!\\.[\\w])(?!/[\\w.])`, 'g');

/** Rename the words a reader sees. Case-sensitive on purpose. */
export function rebrand(text) {
  let out = text;
  for (const [from, to] of RENAMES) out = out.replace(word(from), to);
  for (const [from, to] of HOSTS) out = out.split(from).join(to);
  return out;
}

/** What is left after the pass: every capitalised "Atlas" a reader could still
 *  see, with a little context, for the post-build check. */
export function leftovers(text) {
  const re = word('Atlas');
  const found = [];
  let m;
  while ((m = re.exec(text))) found.push(text.slice(Math.max(0, m.index - 30), m.index + 35).replace(/\s+/g, ' '));
  return found;
}
