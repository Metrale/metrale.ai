# The blog

`blog.metrale.ai`, once it is deployed: a SvelteKit app of its own beside the
site, prerendered to static files, on the same tokens and the same lockup
(`web-shared/`). Posts are markdown under `src/lib/posts/`, rendered at build
time by a parser, a highlighter and a maths renderer that never reach a reader
(`e2e/check-bundle.mjs` proves it on every pull request).

## Run it

```sh
cd blog
bun install
bun run build       # writes blog/build
bun run preview     # serves it on http://localhost:4173
```

`VITE_MAIN_SITE=http://127.0.0.1:5173 bun run dev` points the links at a local
copy of the site, for reviewing both apps from one machine.

## The checks

- `bun run test:unit`: the markdown pipeline, the cross-link checker, `llms.txt`.
- `bun e2e/check-bundle.mjs`, after a build: nothing from the markdown toolchain ships.
- `bun blog/e2e/check-crosslinks.mjs site/build blog/build`, from the repository root
  with both apps built: every deep link from the blog into the site lands on a
  section that exists. The workflow builds the site for this on every pull request.
- `bun e2e/check-headers.mjs https://blog.metrale.ai`, after a deploy: the four
  response headers `static/_headers` promises, on a document, an asset and a 404.
- `e2e/audit-a11y.js` is a manual tool; its header says why it is not a gate.

## How it ships

`.github/workflows/blog.yml`. A push to `main` that touches `blog/` or
`web-shared/` builds and deploys to Cloudflare Pages with the same two secrets
the site uses, once two repository variables exist:

| variable | value |
| --- | --- |
| `BLOG_PAGES_PROJECT` | the Pages project's name; the plan is `metrale-blog` |
| `BLOG_URL` | `https://blog.metrale.ai`, once the custom domain is on the project |

Until the first is set the deploy job is skipped, not failed. Creating the
project and putting the custom domain on it is done once, in the Cloudflare
account, the way the site's `metrale-ai` project was.

## When it is live

Three places in the site still send readers to the old blog address, and each
is one line: `links.blog` in `site/src/lib/content/brand.js`, `blogUrl` in
`site/src/lib/data.js`, and the `Documentation` link beside them if the docs
move too. The old blog address should then redirect to the new one at the zone,
so shared links and search results move.

## What stayed as it was

The posts keep their words. The ones written before the name changed say
"Atlas" for the engine; they are dated records, and a line over each of them
says so (`blog.formerName` in `src/lib/content.js`). Their links into the site
point at the new address. The share card, `static/og-image.png`, is drawn by the
site's renderer: `node scripts/media/og.mjs --blog` from `site/`, after a site
build.
