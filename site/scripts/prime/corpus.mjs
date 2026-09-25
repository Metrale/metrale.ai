#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// corpus.mjs — build the knowledge base Metrale Prime answers from.
// -----------------------------------------------------------------------------
// It reads what the company has published, cuts it into passages the model
// can cite, and writes three files to deploy/cloudflare/prime-worker/corpus/:
//
//   public.json    every passage a visitor may see, with the site commit
//   partner.json   passages from documents outside the repository (the deck,
//                  the plan), for a visitor who holds the partner code
//   data.json      the structured half: the page map, the routes and links, the
//                  ladder, and the repository's history
//
// The sources, in order:
//   the built pages in build/ (so the base says what the site says, word for
//   word, and follows a copy change on the next build), static/llms.txt, the
//   engine's documents in the repository, the blog, and a snapshot of the
//   repository's history from the GitHub API (cached in scripts/.cache/).
//   With --private <dir>, every .txt and .md file in that directory becomes the
//   partner tier. That directory is never inside this repository.
//
//   node scripts/prime/corpus.mjs                         after a build
//   node scripts/prime/corpus.mjs --private ~/metrale-private
//   node scripts/prime/corpus.mjs --upload                into the local KV, for wrangler dev
//   node scripts/prime/corpus.mjs --upload --remote       into the deployed Worker's KV
//   --gh refreshes the history snapshot, --no-gh skips it.
// =============================================================================

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  htmlToText,
  sectionsFromHtml,
  mergeSmallSiblings,
  chunkText,
  slug,
  markdownSections,
  frontMatter,
  withdraw,
  isWithdrawn,
} from './chunk.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SITE_DIR = resolve(here, '..', '..');
const REPO = resolve(SITE_DIR, '..');
const BUILD = join(SITE_DIR, 'build');
const WORKER = join(SITE_DIR, 'deploy', 'cloudflare', 'prime-worker');
const CACHE = join(SITE_DIR, 'scripts', '.cache');
const REPO_SLUG = 'Avarok-Cybersecurity/atlas';
const BLOB = `https://github.com/${REPO_SLUG}/blob/main/`;

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : (args[i + 1] ?? '');
};
const OUT = opt('out') ? resolve(opt('out')) : join(WORKER, 'corpus');
const PRIVATE = opt('private') ? resolve(opt('private')) : null;
const UPLOAD = args.includes('--upload');
const REMOTE = args.includes('--remote');
const GH = args.includes('--gh') ? 'refresh' : args.includes('--no-gh') ? 'skip' : 'cached';

const load = (p) => import(pathToFileURL(resolve(SITE_DIR, p)).href);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const id = (...parts) => createHash('sha1').update(parts.join('\u0000')).digest('hex').slice(0, 12);
const die = (m) => {
  console.error(`corpus: ${m}`);
  process.exit(1);
};

if (!existsSync(BUILD)) die('build/ is missing. Run `bun x --bun vite build` first: the base is cut from the built pages.');

const { pages, SITE, company, routes, links } = await load('src/lib/content/index.js');
const { contacts } = await load('src/lib/content/brand.js');
const ladder = readJson(join(SITE_DIR, 'src', 'lib', 'ladder.generated.json'));

const docs = [];
const add = (doc) => {
  const text = withdraw(String(doc.text ?? ''));
  if (text.length < 40) return;
  docs.push({
    id: `${doc.kind}:${id(doc.url ?? doc.title, doc.section ?? '', text.slice(0, 200))}`,
    kind: doc.kind,
    title: doc.title,
    section: doc.section ?? '',
    url: doc.url ?? '',
    text,
  });
};

// ---- 1. the pages ----------------------------------------------------------------

const DEVELOPER = [
  { path: '/engine', title: `${company.engine}, the open source engine` },
  { path: '/control', title: `${company.control}, live` },
  { path: '/diligence', title: 'Verification walkthrough' },
];
const pageList = [...pages.filter((p) => !p.noindex && p.sitemap !== false), ...DEVELOPER];
let pageCount = 0;
for (const p of pageList) {
  const file = p.path === '/' ? join(BUILD, 'index.html') : join(BUILD, `${p.path.slice(1)}.html`);
  const alt = join(BUILD, p.path.slice(1), 'index.html');
  const path = existsSync(file) ? file : existsSync(alt) ? alt : null;
  if (!path) {
    console.warn(`corpus: no built page for ${p.path}`);
    continue;
  }
  const html = readFileSync(path, 'utf8');
  const title = p.title ?? htmlToText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? p.path);
  let main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  // A section's name on this site is its eyebrow ("Team", "The console"), a
  // paragraph above the heading, not the heading. Fold it into the heading so
  // the passage carries the word a visitor would search for.
  main = main.replace(
    /<p class="av-eyebrow[^"]*"[^>]*>([\s\S]*?)<\/p>\s*<h([1-3])\b([^>]*)>/gi,
    (m, eyebrow, level, attrs) => `<h${level}${attrs}>${htmlToText(eyebrow)}: `
  );
  const url = `${SITE}${p.path === '/' ? '' : p.path}`;
  if (p.description) add({ kind: 'page', title, section: 'What the page is', url, text: `${title}. ${p.description}` });
  for (const s of mergeSmallSiblings(sectionsFromHtml(main))) {
    const text = htmlToText(s.html);
    for (const chunk of chunkText(text))
      add({
        kind: 'page',
        title,
        section: (s.trail?.length ? s.trail : [s.heading]).filter(Boolean).join(' › '),
        url: s.id ? `${url}#${s.id}` : url,
        text: chunk,
      });
  }
  pageCount++;
}
const llms = join(SITE_DIR, 'static', 'llms.txt');
if (existsSync(llms))
  for (const s of markdownSections(readFileSync(llms, 'utf8')))
    for (const chunk of chunkText(s.text))
      add({ kind: 'page', title: 'llms.txt, the short version of the site', section: s.heading, url: `${SITE}/llms.txt`, text: chunk });

// ---- 2. the repository's documents -----------------------------------------------

const REPO_DOCS = [
  ['README.md', 'Repository README', 60000],
  ['QUICKSTART.md', 'Quickstart', 40000],
  ['CONTRIBUTING.md', 'Contributing guide', 40000],
  ['SECURITY.md', 'Security policy', 20000],
  ['CHANGELOG.md', 'Changelog', 14000],
  ['CITATIONS.md', 'Citations and attributions', 20000],
  ['docs/ARCHITECTURE.md', 'Architecture', 40000],
  ['docs/HARDWARE.md', 'Hardware', 40000],
  ['docs/DEPLOYMENT.md', 'Deployment', 40000],
  ['docs/GB10_DEPLOYMENT_GUIDE.md', 'GB10 deployment guide', 40000],
  ['docs/ROBUSTNESS.md', 'Robustness', 30000],
  ['bench/ladder38/RESULTS.md', 'Concurrency ladder results log', 30000],
  // Not site/FACELIFT.md: it is about how the site was made, for whoever works
  // on it next, and names people and decisions that are not for visitors. In
  // the trial the model read it and went looking for a person it named.
];
let docCount = 0;
for (const [file, title, cap] of REPO_DOCS) {
  const path = join(REPO, file);
  if (!existsSync(path)) continue;
  const md = readFileSync(path, 'utf8').slice(0, cap);
  for (const s of markdownSections(md)) {
    for (const chunk of chunkText(s.text, { max: 1600 }))
      add({ kind: 'doc', title, section: s.heading, url: `${BLOB}${file}${s.heading ? `#${slug(s.heading)}` : ''}`, text: chunk });
  }
  docCount++;
}

// ---- 3. the blog -----------------------------------------------------------------

const POSTS = join(REPO, 'blog', 'src', 'lib', 'posts');
let postCount = 0;
if (existsSync(POSTS)) {
  for (const f of readdirSync(POSTS).filter((x) => x.endsWith('.md'))) {
    const { meta, body } = frontMatter(readFileSync(join(POSTS, f), 'utf8'));
    const postSlug = meta.slug ?? f.replace(/\.md$/, '');
    const title = meta.title ?? postSlug;
    const url = `${links.blog}/posts/${postSlug}`;
    for (const s of markdownSections(body))
      for (const chunk of chunkText(s.text, { max: 1600 }))
        add({ kind: 'post', title: `Blog: ${title}${meta.date ? ` (${meta.date})` : ''}`, section: s.heading, url, text: chunk });
    postCount++;
  }
}

// ---- 4. the repository's history, from the API -------------------------------------

let history = null;
const cacheFile = join(CACHE, 'prime-gh.json');
const fresh = existsSync(cacheFile) && Date.now() - statSync(cacheFile).mtimeMs < 24 * 3600 * 1000;
if (GH !== 'skip') {
  if (GH === 'cached' && fresh) history = readJson(cacheFile);
  else {
    try {
      const api = (path, jq) =>
        JSON.parse(execFileSync('gh', ['api', path, '--jq', jq], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
      const commits = [];
      for (let page = 1; page <= 3; page++)
        commits.push(
          ...api(
            `repos/${REPO_SLUG}/commits?per_page=100&page=${page}`,
            '[.[] | {sha: .sha[0:9], date: .commit.author.date[0:10], author: (.author.login // .commit.author.name), message: (.commit.message | split("\\n")[0])}]'
          )
        );
      const pulls = [];
      for (let page = 1; page <= 2; page++)
        pulls.push(
          ...api(
            `search/issues?q=repo:${REPO_SLUG}+is:pr+is:merged&sort=updated&per_page=100&page=${page}`,
            '[.items[] | {n: .number, title: .title, merged: .closed_at[0:10], author: .user.login}]'
          )
        );
      history = {
        as_of: new Date().toISOString().slice(0, 10),
        summary: api(
          `repos/${REPO_SLUG}`,
          '{name: .full_name, description: .description, stars: .stargazers_count, forks: .forks_count, open_issues: .open_issues_count, created: .created_at[0:10], pushed: .pushed_at[0:10], license: .license.spdx_id, default_branch: .default_branch}'
        ),
        releases: api(
          `repos/${REPO_SLUG}/releases?per_page=50`,
          '[.[] | {tag: .tag_name, name: .name, date: .published_at[0:10], prerelease: .prerelease, notes: ((.body // "") | .[0:400])}]'
        ),
        contributors: api(`repos/${REPO_SLUG}/contributors?per_page=100`, '[.[] | {login: .login, contributions: .contributions}]'),
        commits,
        pulls,
      };
      mkdirSync(CACHE, { recursive: true });
      writeFileSync(cacheFile, JSON.stringify(history));
    } catch (err) {
      console.warn(
        `corpus: the GitHub snapshot failed (${String(err?.message ?? err).split('\n')[0]}); ${existsSync(cacheFile) ? 'using the cached one' : 'the history is left out'}`
      );
      history = existsSync(cacheFile) ? readJson(cacheFile) : null;
    }
  }
}
// A commit, pull request or release whose title makes a withdrawn claim is left
// out of the history the guide reads, the passages and the structured half alike.
if (history) {
  history = {
    ...history,
    commits: history.commits.filter((c) => !isWithdrawn(c.message)),
    pulls: history.pulls.filter((p) => !isWithdrawn(p.title)),
    releases: history.releases.map((r) => ({ ...r, notes: withdraw(r.notes ?? '') })).filter((r) => !isWithdrawn(r.name ?? '')),
  };
}
if (history) {
  const s = history.summary;
  const people = history.contributors.filter((c) => !c.login.endsWith('[bot]'));
  add({
    kind: 'history',
    title: 'The repository at a glance',
    section: `as of ${history.as_of}`,
    url: `https://github.com/${REPO_SLUG}`,
    text: `${s.name}: ${s.description}. ${s.stars} stars, ${s.forks} forks, ${s.open_issues} open issues. Created ${s.created}, last push ${s.pushed}. License ${s.license}. ${people.length} people have landed commits; the most active are ${people
      .slice(0, 10)
      .map((c) => `${c.login} (${c.contributions})`)
      .join(', ')}. Automation accounts: ${
      history.contributors
        .filter((c) => c.login.endsWith('[bot]'))
        .map((c) => c.login)
        .join(', ') || 'none'
    }.`,
  });
  for (let i = 0; i < history.releases.length; i += 8) {
    const group = history.releases.slice(i, i + 8);
    add({
      kind: 'history',
      title: 'Releases',
      section: `${group[group.length - 1].tag} to ${group[0].tag}`,
      url: `https://github.com/${REPO_SLUG}/releases`,
      text: group
        .map(
          (r) =>
            `${r.tag} (${r.date}${r.prerelease ? ', pre-release' : ''}): ${r.name}${r.notes ? `. ${r.notes.replace(/\s+/g, ' ')}` : ''}`
        )
        .join('\n'),
    });
  }
  const byWeek = new Map();
  for (const c of history.commits) {
    const d = new Date(c.date);
    const week = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - d.getUTCDay())).toISOString().slice(0, 10);
    byWeek.set(week, [...(byWeek.get(week) ?? []), c]);
  }
  for (const [week, list] of byWeek)
    add({
      kind: 'history',
      title: 'Commits',
      section: `week of ${week}`,
      url: `https://github.com/${REPO_SLUG}/commits/main`,
      text:
        `${list.length} commits. ` +
        list
          .map((c) => `${c.date} ${c.author}: ${c.message}`)
          .join('\n')
          .slice(0, 2400),
    });
  const byMonth = new Map();
  for (const p of history.pulls) byMonth.set(p.merged.slice(0, 7), [...(byMonth.get(p.merged.slice(0, 7)) ?? []), p]);
  for (const [month, list] of byMonth)
    add({
      kind: 'history',
      title: 'Merged pull requests',
      section: month,
      url: `https://github.com/${REPO_SLUG}/pulls?q=is%3Apr+is%3Amerged`,
      text:
        `${list.length} merged in ${month}. ` +
        list
          .map((p) => `#${p.n} ${p.title} (${p.author}, ${p.merged})`)
          .join('\n')
          .slice(0, 2400),
    });
}

// ---- 5. the partner tier ------------------------------------------------------------

const partnerDocs = [];
if (PRIVATE) {
  if (!existsSync(PRIVATE)) die(`--private ${PRIVATE} does not exist`);
  if (resolve(PRIVATE).startsWith(REPO)) die('the private directory must be outside the repository');
  for (const f of readdirSync(PRIVATE).filter((x) => ['.txt', '.md'].includes(extname(x)))) {
    const raw = readFileSync(join(PRIVATE, f), 'utf8').replace(/�/g, '');
    const name = basename(f, extname(f)).replace(/[-_]+/g, ' ');
    const kind = /deck|pitch/i.test(f) ? 'deck' : 'plan';
    const pagesOf = raw.includes('\f') ? raw.split('\f') : [raw];
    pagesOf.forEach((pg, i) => {
      const text = pg
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      if (text.length < 40) return;
      const first =
        text
          .split('\n')
          .find((l) => l.trim())
          ?.trim()
          .slice(0, 80) ?? '';
      for (const chunk of chunkText(text, { max: 1800 })) {
        const t = withdraw(chunk);
        if (t.length < 40) continue;
        partnerDocs.push({
          id: `${kind}:${id(f, String(i), t.slice(0, 200))}`,
          kind,
          title: `${kind === 'deck' ? 'The deck' : 'Internal document'}: ${name}`,
          section: pagesOf.length > 1 ? `page ${i + 1}, ${first}` : first,
          url: '',
          text: t,
        });
      }
    });
  }
}

// ---- 6. the structured half ----------------------------------------------------------

let commit;
try {
  commit = execFileSync('git', ['rev-parse', '--short=9', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
} catch {
  commit = '';
}
const rows = [...(ladder.rows ?? [])]
  .sort((a, b) => a.c - b.c)
  .map((r) => {
    const m = r.baselines?.find((b) => b.id === r.best_baseline_id) ?? r.baselines?.[0] ?? {};
    return { c: r.c, atlas: r.atlas, baseline: m.label ?? '', baseline_tok_s: m.tok_s ?? null, ratio: r.ratio_vs_best ?? null };
  });
const data = {
  built: new Date().toISOString(),
  site: SITE,
  commit,
  company,
  pages: pageList.map((p) => ({ path: p.path, title: p.title, description: p.description ?? '', noindex: Boolean(p.noindex) })),
  routes,
  links,
  contacts,
  ladder: {
    title: ladder.title,
    subtitle: ladder.subtitle,
    aggregate: ladder.aggregate,
    workload: ladder.workload,
    box: ladder.box,
    generated_utc: ladder.generated_utc,
    results_doc_url: ladder.results_doc_url,
    rows,
    summary: ladder.summary ?? null,
  },
  history: history
    ? {
        as_of: history.as_of,
        summary: history.summary,
        releases: history.releases.slice(0, 50),
        commits: history.commits.slice(0, 100),
        pulls: history.pulls.slice(0, 100),
        contributors: history.contributors,
      }
    : null,
};

// ---- 7. write, and upload if asked ---------------------------------------------------

mkdirSync(OUT, { recursive: true });
const built = data.built;
const pub = { built, site: SITE, commit, docs };
const partner = { built, docs: partnerDocs };
writeFileSync(join(OUT, 'public.json'), JSON.stringify(pub));
writeFileSync(join(OUT, 'partner.json'), JSON.stringify(partner));
writeFileSync(join(OUT, 'data.json'), JSON.stringify(data));
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 12);
const manifest = {
  built,
  commit,
  site: SITE,
  public: docs.length,
  partner: partnerDocs.length,
  kinds: docs.reduce((a, d) => ({ ...a, [d.kind]: (a[d.kind] ?? 0) + 1 }), {}),
  bytes: {
    public: statSync(join(OUT, 'public.json')).size,
    partner: statSync(join(OUT, 'partner.json')).size,
    data: statSync(join(OUT, 'data.json')).size,
  },
  sha: { public: sha(join(OUT, 'public.json')), partner: sha(join(OUT, 'partner.json')), data: sha(join(OUT, 'data.json')) },
};
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(
  `corpus: ${docs.length} public passages (${pageCount} pages, ${docCount} documents, ${postCount} posts${history ? ', the history' : ''}), ${partnerDocs.length} partner passages, at commit ${commit || '?'}`
);
console.log(
  `        ${JSON.stringify(manifest.kinds)}  ${Math.round(manifest.bytes.public / 1024)} KB public, ${Math.round(manifest.bytes.partner / 1024)} KB partner, ${Math.round(manifest.bytes.data / 1024)} KB data`
);

if (UPLOAD) {
  const where = REMOTE ? '--remote' : '--local';
  const put = (key, file) => {
    const out = execFileSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['wrangler@4', 'kv', 'key', 'put', key, '--path', join(OUT, file), '--binding', 'PRIME', where],
      { cwd: WORKER, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' }
    );
    console.log(`        ${key} <- ${file} (${where.slice(2)})${out.trim() ? `: ${out.trim().split('\n').pop()}` : ''}`);
  };
  put('corpus:public', 'public.json');
  put('corpus:data', 'data.json');
  if (partnerDocs.length) put('corpus:partner', 'partner.json');
  else console.log('        corpus:partner not uploaded: no partner documents were given (--private <dir>)');
}
