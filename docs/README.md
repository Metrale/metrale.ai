# The docs

`docs.metrale.ai`: the engine's book, with the engine's API reference (rustdoc)
at `docs.metrale.ai/api/`. The book itself (an mdBook) is written and
kept in the engine's repository, `Metrale/metrale-inference`, under
`book/` beside the crates, by the engine team, skin and wordmark included.
Nothing here changes it there. This directory publishes it at the company's
docs address, at the commit the site is built against.

## How a build works

`docs/build.mjs`, over a fresh copy of the book in `docs/.book`:

1. **The links.** The book links its tokens, its fonts and their licences to
   files outside `book/` (`web-shared/metrale-tokens.css` and
   `site/static/fonts/` in the engine's repository), which a checkout of `book/`
   alone does not have. This repository keeps the same files at the same paths,
   so each link is replaced by the file it names, from here. The docs, the site
   and the blog share one palette and one set of faces that way.
2. **The hosts.** The engine team publishes the book at `book.dev.metrale.ai`.
   Its former blog and project site hosts, `blog.dev.metrale.ai` and
   `dev.metrale.ai`, are retired and redirect to `blog.metrale.ai` and
   `metrale.ai/engine`. `docs/hosts.mjs` moves all three to `docs.metrale.ai`,
   `blog.metrale.ai` and `metrale.ai`, so the canonical addresses and `llms.txt`
   name this host whichever engine commit the book comes from. Links to the
   API reference move from `docs.dev.metrale.ai` to the same path under
   `docs.metrale.ai/api/`, where it is published now; `docs.dev.metrale.ai`
   redirects every path there. The unit test beside the site's
   (`site/src/lib/docs-hosts.test.js`) pins the map.

Then mdBook 0.4.40 builds it, the book's own two scripts add `llms.txt` and the
per-page social metadata, and the icons, the card, the Pages headers and a
`version.txt` (the engine commit and this repository's) are copied in.

**The API reference.** The rustdoc that `cargo doc --workspace --no-deps` wrote
into the same engine checkout's `target/doc` is copied to `/api/`, in place of
the redirect stub the book puts there, with the front page the engine's own
rustdoc site always had (straight to `metrale_core`). rustdoc links everything
relative to the page, so its pages, assets and search work under the prefix
unchanged. The workflow builds it the way the engine's docs workflow does: the
engine's pinned toolchain, with `METRALE_SKIP_BUILD=1` and
`CUDARC_CUDA_VERSION=13000` so the build scripts skip CUDA, and a Cargo cache.

`docs/check.mjs` then reads every built page and fails on a host the build
should have moved, on a missing title, skin, font or file, on a link shipped as the
text of its path, and on an API reference that is not rustdoc's: the front
page, a page for every crate its crate list names, its scripts and its search
index. The host check reads the book's pages only: the API reference renders the
engine's source as written.

```sh
# from the repository root, with a checkout of the engine beside it
(cd ../metrale-inference && METRALE_SKIP_BUILD=1 CUDARC_CUDA_VERSION=13000 cargo doc --workspace --no-deps)
METRALE_ENGINE_ROOT=../metrale-inference node docs/build.mjs   # needs mdbook 0.4.40 on PATH
node docs/check.mjs
npx serve docs/build                                                 # or any static server
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
`version.txt`, and then asks for an API reference page.

## Moving the engine forward

The docs follow `site/engine.ref`, the same pin the site's numbers come from.
Moving it is a pull request like any other; this workflow runs on it, so a
chapter the engine team added or renamed, a link the book grew, or a host it
started naming shows up in the check before it is published.

## What is deliberately not here

- **The chapters.** They belong with the code they describe. A wrong sentence in
  the docs is a pull request against the engine's `book/`, and it reaches
  `docs.metrale.ai` when the pin moves.
- **The skin.** The book carries its own (`theme/css/metrale.css`, the wordmark
  in `theme/metrale.js` and `wordmark.css`). A change of dress is a pull request
  there too.
- **A new outline.** The book is organised around the engine's internals. What
  Metrale's documentation should look like, starting from the reader, is
  proposed in [`OUTLINE.md`](OUTLINE.md) for the team to decide on; nothing of
  it is built until they do.
