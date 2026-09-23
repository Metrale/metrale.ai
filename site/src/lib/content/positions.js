// The positions: one JSON Lines file, `positions.jsonl` beside this file, is
// the single source of truth for every role the careers page shows. One line
// is one role. The build turns the file into `src/lib/positions.generated.json`
// through `scripts/gen-positions.mjs`, which calls `parsePositions` below and
// stops the build on the first bad line, so a typo in the file cannot ship as
// an empty page.
//
// Plain `.js` with no imports, for the house reason: the generator runs under
// node before Vite is up, and the unit runner imports this file directly to
// check the real file. The page reads the generated JSON, never the JSONL.
//
// A line carries:
//   id            stable slug, unique; the anchor on the page and the form's value
//   title         the role, as it would be written on an offer
//   team          which part of the company: Engine, Control, Customers, Go to market
//   location      where, or "Location by agreement"
//   status        planned | open | filled. The page says "planned" plainly, because
//                 nothing on it may claim a search is open when none is
//   summary       one paragraph
//   does          what the person will do, a few lines
//   requirements  what the company looks for, a few lines

export const STATUSES = ['planned', 'open', 'filled'];

const REQUIRED = ['id', 'title', 'team', 'location', 'status', 'summary', 'does', 'requirements'];

const text = (v) => typeof v === 'string' && v.trim().length > 0;
const lines = (v) => Array.isArray(v) && v.length > 0 && v.every(text);

/** Parse the JSONL text. Throws with the line number on the first bad line. */
export function parsePositions(source) {
  const out = [];
  const ids = new Set();
  source.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const n = i + 1;
    let p;
    try {
      p = JSON.parse(line);
    } catch (e) {
      throw new Error(`positions.jsonl line ${n}: not JSON (${e.message})`, { cause: e });
    }
    for (const k of REQUIRED) if (!(k in p)) throw new Error(`positions.jsonl line ${n}: missing "${k}"`);
    for (const k of Object.keys(p)) if (!REQUIRED.includes(k)) throw new Error(`positions.jsonl line ${n}: unknown field "${k}"`);
    for (const k of ['id', 'title', 'team', 'location', 'summary']) {
      if (!text(p[k])) throw new Error(`positions.jsonl line ${n}: "${k}" must be text`);
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id)) throw new Error(`positions.jsonl line ${n}: id "${p.id}" is not a slug`);
    if (ids.has(p.id)) throw new Error(`positions.jsonl line ${n}: id "${p.id}" appears twice`);
    ids.add(p.id);
    if (!STATUSES.includes(p.status))
      throw new Error(`positions.jsonl line ${n}: status "${p.status}" is not one of ${STATUSES.join(', ')}`);
    if (!lines(p.does)) throw new Error(`positions.jsonl line ${n}: "does" must be a list of lines`);
    if (!lines(p.requirements)) throw new Error(`positions.jsonl line ${n}: "requirements" must be a list of lines`);
    out.push({ ...p });
  });
  return out;
}

/** The teams, in the order they first appear. */
export const teamsOf = (positions) => [...new Set(positions.map((p) => p.team))];

/** The roles that match a search and a team. An empty query matches every role;
 *  the team "All" matches every team. The search is case-insensitive and looks
 *  at every field a reader can see. */
export function filterPositions(positions, { q = '', team = 'All' } = {}) {
  const needle = q.trim().toLowerCase();
  return positions.filter((p) => {
    if (team !== 'All' && p.team !== team) return false;
    if (!needle) return true;
    const hay = [p.title, p.team, p.location, p.status, p.summary, ...p.does, ...p.requirements].join(' ').toLowerCase();
    return needle.split(/\s+/).every((w) => hay.includes(w));
  });
}

/** The word the page uses for a status. */
export const statusLabel = (s) => ({ planned: 'Planned', open: 'Open', filled: 'Filled' })[s] ?? s;
