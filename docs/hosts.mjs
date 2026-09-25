// The hosts the engine's book names, and where they move when it is published
// from here.
//
// The engine team publishes the book at book.dev.metrale.ai. Published from
// this repository the book is docs.metrale.ai, so its canonical addresses and
// llms.txt name that host. blog.dev.metrale.ai and dev.metrale.ai are retired:
// they redirect to blog.metrale.ai and metrale.ai/engine, and a book at an
// older engine commit that still links them is moved here to the company's own.
// The API reference, docs.dev.metrale.ai, is published only there and keeps its
// address.
//
// Plain ESM with no imports, so the unit runner and the build script share it.

/** Whole origins, scheme included, so a shorter host never matches inside a longer one. */
export const HOSTS = [
  ['https://book.dev.metrale.ai', 'https://docs.metrale.ai'],
  ['https://blog.dev.metrale.ai', 'https://blog.metrale.ai'],
  ['https://dev.metrale.ai', 'https://metrale.ai'],
];

/** The text with every host in HOSTS moved. */
export const rehost = (text) => HOSTS.reduce((t, [from, to]) => t.replaceAll(from, to), text);

/** The hosts in HOSTS that a text still names, once each. */
export const unmoved = (text) => [...new Set(text.match(/https:\/\/(?:(?:book|blog)\.)?dev\.metrale\.ai/g) ?? [])];
