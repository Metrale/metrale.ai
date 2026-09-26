# The Metrale website

The marketing site and the developer pages at metrale.ai. SvelteKit,
prerendered to static files, deployed to Cloudflare Pages by
`.github/workflows/deploy.yml`.

Read `FACELIFT.md` for what is where and why. This file is the commands.

## Run it

You need [git](https://git-scm.com), [bun](https://bun.sh), and clones of
[metralectl](https://github.com/Metrale/metralectl), whose `recipes/` the
build reads the model list from, and of
[metrale-inference-alpha](https://github.com/Metrale/metrale-inference-alpha),
the engine, whose benchmark records, ladder and changelog the pages print. The root
[README](../README.md) has the commands; `engine.ref` names the engine commit CI
builds against.

The three `METRALE_*` variables there are the only settings. Everything the pages show is in the
repository: the fonts, the logos, the product clips, the film and the generated
stills are ordinary files under `static/`, not Git LFS pointers, so a plain
clone has them. This was checked from a clean clone with no GitHub login.

`GIT_LFS_SKIP_SMUDGE=1` on the engine clone makes it faster. The engine keeps
some large assets in LFS and the site needs none of them.

To build and preview the static output the way it deploys:

```sh
bun x --bun vite build               # writes build/, about two minutes
bun x --bun vite preview             # serves build/ on http://localhost:4173
```

A GitHub login is optional. With `GH_TOKEN=$(gh auth token)` the build refreshes
the star history. Without it the history falls back to the committed file and
the build says so without failing.

On Windows use Git Bash, and give the variable a forward slash path
(`/c/Users/you/metralectl/recipes`).

## Test it

The unit suite reads the engine checkout as the build does: the benchmark
dashboard's tests check the published manifests, the gate limits and the energy
producer at `METRALE_ENGINE_ROOT`.

```sh
bun test --preload ./test-runes.js src/lib          # unit, about a second
bun x --bun playwright test e2e/marketing.spec.js   # browser, builds first
(cd .. && bun .contrast-check.mjs)                  # contrast, run from the repository root
```

## Change it

All copy, links, prices and page titles are data in `src/lib/content/`.
`FACELIFT.md` has a table of what to edit for each kind of change. The unit
suite fails when a link points nowhere, when a page has no title, or when a
sentence breaks the house voice, so run it after editing copy.

## Media

```sh
bun run media     # record and encode the procedural loops, keep the console clips
bun run og        # render static/og-image.png
```

The console clips are recordings of a private product mockup that is not in
this repository. `media-brief/README.md` explains that, and holds the prompt
pack for the imagery still to be generated. `scripts/media/README.md` explains
each script.

## The guide, and the brand

Metrale Prime, the chatbot in the corner of every page, is a Cloudflare Worker
in `deploy/cloudflare/prime-worker/` (its README has the setup and the trials).
The page renders it only when `primeEndpoint` in `src/lib/content/brand.js`
names the Worker; a build can point at a local one with `VITE_PRIME_ENDPOINT`.

The brand is the kit in `../assets/brand/`. `BRANDING.md` says how the site
applies it; `BRAND-CHANGE.md` is the runbook for changing the name, the
artwork, the palette or the type without breaking a gate.

## Layout

```text
src/lib/content/             copy, routes, nav, prices, page registry
src/lib/components/marketing/   marketing components
src/lib/components/          developer page components
src/routes/(marketing)/      marketing pages
src/routes/(engine)/         /engine, /control, /diligence
src/routes/(app)/            render pages for the media pipeline
src/styles/metrale.css        marketing design system
scripts/                     generators, run by the build
scripts/media/               media pipeline
media-brief/                 prompt pack and reel storyboard
e2e/                         browser tests
static/                      shipped as is: fonts, logos, media, icons
```
