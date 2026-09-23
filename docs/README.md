# The docs

`docs.metrale.ai`: the engine's book, published as Metrale's. The book itself
(37 chapters, an mdBook) is written and kept in the engine's repository, under
`book/` beside the crates, by the engine team. Nothing here changes it there.
This directory publishes it under the Metrale brand, at the commit the site is
built against, and it is the one place to look when the docs need a change of
dress rather than a change of words.

## How a build works

`docs/build.mjs`, in four moves over a fresh copy of the book in `docs/.book`:

1. **The tokens.** This repository's `web-shared/avarok-tokens.css` replaces the
   copy the book links, so the docs, the site and the blog share one palette.
2. **The type.** The site's Urbanist and IBM Plex Mono, self hosted beside the
   pages (`fonts/fonts.css` is written by the build), in place of the system
   stacks the book falls back to.
3. **The layer.** `docs/theme/metrale.css` and `metrale.js` put the lockup in the
   menu bar, linked to the front page, with "Engine docs" beside it. The book's
   own skin (`theme/css/avarok.css`, the engine's) keeps every rule it has.
4. **The words.** `docs/rebrand.mjs` renames what a reader sees and nothing
   else. The pairs are listed longest first and applied with the same word
   boundary the site's rename uses (`site/scripts/brand/rename.mjs`), so
   `atlasctl`, `atlas serve`, `atlas-recipes`, `AtlasConfig`, `ATLAS_HOME` and
   `github.com/Avarok-Cybersecurity/atlas` stay exactly as they are. Hosts move
   as hosts, inside addresses. The unit test beside the site's
   (`site/src/lib/docs-rebrand.test.js`) pins both halves of that rule.

Then mdBook 0.4.40 builds it, the book's own two scripts add `llms.txt` and the
per-page social metadata, and the icons, the card, the Pages headers and a
`version.txt` (the engine commit and this repository's) are copied in.
`docs/check.mjs` then reads every built page the way a reader would, without
its scripts, code and markup, and fails on any "Atlas" left, any old host, a
missing title, layer, font or file.

```sh
# from the repository root, with a checkout of the engine beside it
AVAROK_ENGINE_ROOT=../atlas node docs/build.mjs    # needs mdbook 0.4.40 on PATH
node docs/check.mjs
npx serve docs/build                              # or any static server
```

`MDBOOK=/path/to/mdbook` names the binary when it is not on the PATH. The
workflow installs the pinned version itself.

## How it ships

`.github/workflows/docs.yml`. A pull request that touches `docs/`, the shared
tokens, the site's fonts or the engine pin builds and checks the book. A push
to `main` deploys it to Cloudflare Pages with the same two secrets the site
uses, once two repository variables exist:

| variable | value |
| --- | --- |
| `DOCS_PAGES_PROJECT` | the Pages project's name, `metrale-docs` |
| `DOCS_URL` | `https://docs.metrale.ai`, once the custom domain is on the project |

Until the first is set the deploy job is skipped, not failed. The deploy's last
step waits until the host serves the commit it just published, read from
`version.txt`.

## Moving the engine forward

The docs follow `site/engine.ref`, the same pin the site's numbers come from.
Moving it is a pull request like any other; this workflow runs on it, so a
chapter the engine team added or renamed shows up in the check before it is
published. When the engine's repository itself renames, every pair in
`rebrand.mjs` stops matching and the pass becomes a no-op; delete the list then,
and the checkout step's repository name in the workflow.

## What is deliberately not here

- **The chapters.** They belong with the code they describe. A wrong sentence in
  the docs is a pull request against the engine's `book/`, and it reaches
  `docs.metrale.ai` when the pin moves.
- **A new outline.** The book is organised around the engine's internals. What
  Metrale's documentation should look like, starting from the reader, is
  proposed in [`OUTLINE.md`](OUTLINE.md) for the team to decide on; nothing of
  it is built until they do.
- **The API reference** (`/api/`, rustdoc), which the engine's own workflow
  builds from the crates. The book's redirect to it stays; the pages behind it
  come with a later step, or a link to where the engine publishes them.
