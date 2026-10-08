# Changing the brand

How the name, the logo, the mark, the swatches, the type and the derived files
change, in the order that keeps every gate green. Written while applying the
Metrale kit, revised for brand v2 (2026-10-08), and meant to be followed again
the next time.

The rule behind it: a visitor reads words, sees artwork and sees colour. Those
three change. Identifiers, paths, class prefixes, repository names, crate
names and environment variables are not the brand; renaming those is a code
refactor with its own review, never part of a brand change. Section 7 lists
them.

## 1. The name

```sh
cd site
node scripts/brand/rename.mjs --from Metrale --to Newname          # the report
node scripts/brand/rename.mjs --from Metrale --to Newname --apply  # the change
```

The script rewrites the name only where it is a word: content modules, page
markup, `app.html`, the manifest, the lockup's accessible names, the blog
shell, the generators that print prose, and the tests and CI configuration
that spell the public name or the public URL. It moves the `/why-<name>` page,
rewrites every reference to it and adds a 301 to `static/_redirects`. Then it
lists what it did not touch and why: internals, artwork, generated files, and
the handoff documents that need a person.

Read the report's two hand lists before building:

- **history lines**: sentences that say what the brand was called before. The
  site keeps none: a visitor reads the current name only.
- **docs**: `README.md`, `FACELIFT.md`, `AGENTS.md`, `BRANDING.md`,
  `media-brief/`. Reread each. `assets/brand/` is the kit's, never edited here:
  a name change there is a release of the kit.

Then rebuild everything that is generated from the words:

```sh
bun x --bun vite build                                  # llms.txt, sitemap, the pages
bun run guide -- --note "Renamed to Metrale" --pr <n>   # SITE-GUIDE.md and the ledger
bun test --preload ./test-runes.js src/lib              # the voice test, routes, the ledger
bun x --bun playwright test                             # titles, menus, the header
```

`src/lib/content/brief.test.js` bans the brand name from the imagery prompts.
Add the new name to its list, or a still will be generated with the name in it.

Last, read the built pages, not the source. Strip the tags and look for the old
name in what a visitor would read:

```sh
OLD=Oldname; for f in build/*.html; do sed 's/<[^>]*>/ /g' "$f" | grep -o "$OLD[^ <]*"; done | sort | uniq -c
```

On 2026-09-21 this found three sentences the script's first boundary had
skipped (the name followed by a full stop), and the browser suite found a
fourth inside a regular expression. Both boundaries are fixed; the check stays.

## 2. Where the brand comes from

The brand is `Metrale/metrale-assets`, the kit: the mark, the logos, the colour
tokens, the typeface, the favicons and app icons, the social cards. This
repository consumes it and never originates it.

- `assets/take-assets.sh` vendors the files the site, the blog and the docs use
  from a signed release tag of the kit into `assets/brand/`, and writes
  `assets/brand.pin`: the tag, its commit and every file's git blob id. Its
  `FILES` list is the whole of what is taken; Office templates, previews and the
  generator stay with the kit.
- `assets/take-assets.sh --check` fails when a vendored file was edited, added
  or removed by hand. CI runs it (`pr.yml`, the unit job). `--check --upstream`
  also asks GitHub that the pinned commit holds exactly those blobs, which needs
  read access to the kit.
- `site/scripts/brand/kit.mjs` derives everything the properties serve or build
  with from `assets/brand/`, and nothing else: the favicons, the touch and app
  icons, the social card and `logo.svg` in `site/static/` and `blog/static/`,
  byte for byte; `site.webmanifest` (the kit's, with the site's own fields
  added); Manrope and its licence in `site/static/fonts/`; the kit's
  `manrope-fallback.css` in `site/src/styles/`; `web-shared/brand-art.js`, the
  logo cuts and marks as data; and the palette block of
  `web-shared/metrale-tokens.css`. `src/lib/brand-kit.test.js` runs the same
  derivation and fails naming every derived file that is behind the kit.

To take a new release of the kit:

```sh
assets/take-assets.sh ../metrale-assets v2.1.0    # a signed tag; rewrites assets/brand and the pin
cd site && node scripts/brand/kit.mjs             # rewrites every derived file
bun test --preload ./test-runes.js src/lib        # brand-kit, brand-tokens, token-contrast, theme-color
cd .. && bun .contrast-check.mjs                  # the contrast table, both themes
```

A major release of the kit changes the mark, a logo or a colour role, so read
its `BRAND-GUIDELINES.md` and its changelog and look at sections 3 to 5 below. A
minor or patch release usually needs only the four commands. To take a file the
site does not use yet, add it to `FILES` in `take-assets.sh`, re-run it, and
give it a destination in `kit.mjs`.

## 3. The logo and the mark

One component draws every logo on the site, the blog and the deck:
`web-shared/components/MetraleLockup.svelte`, from `web-shared/brand-art.js`.
The kit draws the horizontal logo in two cuts, chosen by ground and never
swapped (`logo-horizontal-ondark.svg`, `logo-horizontal.svg`: a different rule
weight and ink, not a recolour), the mark, and a compact mark with a wider fold
gap for 48 px and below. The component references both cuts and the theme shows
the one for its ground; a surface whose ground does not follow the theme pins a
cut with `ground`. Nothing is redrawn or recoloured: every piece carries the
kit's own ink, and `brand-kit.test.js` fails if the component writes a path or a
colour of its own.

The kit's rules the component applies: 160 px minimum for the horizontal logo,
the compact mark at 48 px and below, clear space of one stem (53 units) on every
side as margin in proportion to the width. One logo per surface: the company
logo everywhere public, a product lockup only on a page about that product
(none today). The kit's guidelines are `assets/brand/BRAND-GUIDELINES.md`.

The social card is the kit's `og-image-1200x630.png`, served as
`static/og-image.png` on the site and the blog. The GitHub social preview is the
kit's `github-social-preview-1280x640.png` (vendored in `assets/brand/dark/`),
uploaded by hand in the repository settings. The film's title cards are set by
`bun run reel` from the kit's dark-ground logo and colours.

## 4. The swatches

`web-shared/metrale-tokens.css` holds the roles; the kit holds the colours. The
block between `BEGIN brand palette` and `END brand palette` is the kit's
`tokens/brand.json` as `--brand-*` custom properties, written by `kit.mjs`, and
the roles below it name those (`--accent: var(--brand-copper-light)`) rather
than restating them. `src/lib/brand-tokens.test.js` holds each role to the kit
colour it should name and fails when a role restates a kit colour as a hex.

The roles, from the kit's guidelines and the owner's rulings of 2026-10-08:

- **Copper leads.** Links, labels, calls to action, the section accent, rails,
  chips and focus rings are copper. The kit's copper itself is 4.4:1 on the
  ground and 4.3:1 on white, under the 4.5:1 small text needs, so it is the
  mark and non-text marks only (`--mark`, `--sx`). Text takes copper-light on
  dark and copper-deep on light (`--accent`, `--sx-text`); filled controls take
  the same steps with the ground as ink on dark and white on light
  (`--accent-fill`, `--on-accent`).
- **One section accent.** Sections, the ledger rail, chips and receipts used to
  carry one of four hues by meaning. The kit has one brand colour, so they are
  all copper; the hue classes are gone.
- **Status is not brand.** Green says a verified result and amber a warning or a
  pending one (`--green`, `--amber`, the `.av-chip-ok` and `.av-chip-warn`
  chips). Nothing else is green or amber.
- **Violet is product only**, for a product's name, set in type. No page uses it
  today.
- **No cyan.** The kit's signal colour is not emitted (`kit.mjs` leaves it out of
  the palette block) and `brand-kit.test.js` fails on it or on any colour of the
  previous kit anywhere in the sites' code.
- **The chart series keep their data palette** (`--series-*`,
  `src/lib/series-colors.js`). They are data, not brand.

`web-shared/theme.js` and each `app.html` pin the two grounds for the
theme-color meta tag (the kit's ground and white); `src/lib/theme-color.test.js`
holds them, and the manifest, equal to the tokens.

Then the contrast gates. Every pairing the token file promises, in both themes,
is listed once in `site/scripts/brand/contrast.mjs`: the text tokens on every
surface, copper text on the copper tints chips and tags use, the status colours
on their own tints, the ink on a filled control, and copper as a rail and a
focus ring at 3:1. A new token that fails one cannot ship:

```sh
bun .contrast-check.mjs                                  # from the repo root: the table
bun test --preload ./test-runes.js src/lib               # token-contrast, series-contrast, chart-focus-contrast
```

## 5. The type

The kit names Manrope (Google Fonts, OFL) and ships it: one variable file,
weights 200 to 800, latin, with its licence and a metric-matched fallback face.
It says nothing about a monospace, and the site's numbers, labels, receipts and
code stay in IBM Plex Mono.

1. The files: `static/fonts/manrope-latin-wght-normal.woff2` and
   `MANROPE-LICENSE.txt`, copied from the kit by `kit.mjs`. `static/fonts/type.css`
   declares Manrope and Plex Mono; `src/app.html` attaches that sheet after first
   paint.
2. The fallback: `src/styles/manrope-fallback.css` is the kit's 'Manrope
   Fallback', local Arial scaled to Manrope's advance and given its ascent and
   descent, so the first paint occupies the space the web font will. The Plex
   Mono fallback, which the kit does not cover, is in `src/styles/fonts.css`.
3. `--font-sans` in the tokens names the family, then the kit's fallback face,
   then the kit's fallback stack (Helvetica Neue, Helvetica, Arial).
   `--font-mono` is unchanged.
4. Manrope sets wider than the previous face: the marketing header's links move
   to the drawer below 1180 px (measured, `SiteNav.svelte`).
5. The blog's reading face is Charter, which is not the brand's; its headings
   and interface take `--font-sans`. The engine's book under docs.metrale.ai
   carries its own theme and fonts (in the engine's repository), so its
   typeface moves with that theme; `docs/check.mjs` checks that whatever faces
   the book names ship, and that its icons and card are the kit's.

## 6. What else names the brand

- The domain. `SITE` in `src/lib/content/brand.js` is the one constant. The
  blog's `MAIN_SITE` and `blog/src/app.html` follow it. DNS and Cloudflare Pages
  are outside this repository.
- The social profiles, `sameAs` in `src/routes/+layout.svelte`. No handle is
  published in the pages' meta tags today.
- Email. `contacts` in `brand.js`, and `TO_*` in the forms Worker's
  `wrangler.toml` (a test holds them equal).
- The Worker names in `deploy/cloudflare/*/wrangler.toml` are internals.
- The chatbot's name is its own: `name` in `src/lib/prime/copy.js`.

## 7. What is not part of a brand change

The `av-` class prefix, the component folders, the token file's name, the
storage keys and the environment variables are private to this repository and
follow the brand only when someone chooses to spend a refactor on them. The
engine's repository, crates and commands are public interfaces of the engine:
renaming them is its maintainers' decision, with a deprecation of its own, and
`web-shared/sources.mjs` is the one file the site changes when they move.
