# Changing the brand

How the name, the wordmark, the mark, the swatches and the derived files change,
in the order that keeps every gate green. Written while moving the site from
Avarok to Metrale, then applying the Metrale kit the same day, and meant to be
followed again the next time.

The rule behind it: a visitor reads words, sees artwork and sees colour. Those
three change. Identifiers, paths, class prefixes, repository names, crate
names and environment variables are not the brand, and they stay, the way
`avarok-tokens.css` and the `av-` prefix stay through this change. Renaming
those is a code refactor with its own review, never part of a brand change.

## 1. The name

```sh
cd site
node scripts/brand/rename.mjs --from Avarok --to Metrale          # the report
node scripts/brand/rename.mjs --from Avarok --to Metrale --apply  # the change
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
  public history is Atlas, then Metrale, because the Avarok name never reached
  a visitor: it lived on an unmerged branch and in crate names. Those
  sentences stay as "named Atlas until September 2026".
- **docs**: `README.md`, `FACELIFT.md`, `AGENTS.md`, `BRANDING.md`,
  `assets/brand/BRAND-GUIDELINES.md`, `media-brief/`. Reread each. A document
  that explains the previous rename explains this one after the same edit.

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
name in what a visitor would read; the organisation name in repository links
is the one mention that stays:

```sh
for f in build/*.html; do sed 's/<[^>]*>/ /g' "$f" | grep -o 'Avarok[^ <]*'; done | grep -v Avarok-Cybersecurity | sort | uniq -c
```

On 2026-09-21 this found three sentences the script's first boundary had
skipped (the name followed by a full stop), and the browser suite found a
fourth inside a regular expression. Both boundaries are fixed; the check stays.

## 2. The wordmark and the mark

Done on 2026-09-21 with the Metrale kit. The kit is a generator: everything it
ships is drawn by `assets/brand/gen.js` from `src/geometry.js` (the pieces),
`src/paths.json` (the letter outlines) and `src/products.json`. The site draws
from the same geometry rather than from a traced copy:

1. The kit's `svg/`, `src/`, `tokens/`, `gen.js` and `BRAND-GUIDELINES.md` are
   `assets/brand/`. Its social previews are `assets/brand/social/`. Its raster
   renders (`dark/`, `light/`, `transparent/`, `templates/`) stay with the kit;
   only the cuts the site serves were copied into `static/`.
2. `node scripts/brand/lockup.mjs` runs the kit's geometry and writes
   `web-shared/brand-art.js` (the paths and boxes the component draws with)
   and the plain wordmark masters `assets/brand/svg/wordmark*.svg`, which the
   kit does not ship as files. `src/lib/lockup-artwork.test.js` recomputes
   the module from the geometry: a module behind it is a failing test.
3. `web-shared/components/AtlasLockup.svelte` draws the module through four
   token gradients (`--m-ink-hi/lo`, `--m-lavender/--m-violet`, `--m-cyan-hi/lo`,
   `--m-gold-hi/lo`) in the kit's directions. Kinds: `wordmark`, `mark`,
   `compact`; the previous kinds still resolve to the wordmark.
4. `static/`: `favicon.svg` is the kit's app icon on the ground; the PNG cuts
   at 16, 32, 48, 180, 192, 512, 1024 and the maskable 512 are the kit's own;
   `logo.svg` is the wordmark on dark. The blog carries the same set.
5. `node scripts/media/og.mjs` and `--blog` render the social cards from
   `assets/brand/svg/wordmark-ondark.svg` and the headline, in Urbanist.
   `bun run reel` re-renders the film's title cards the same way.
6. The GitHub social preview (`assets/brand/social/`) is uploaded by hand in
   the repository settings.

When the kit changes again: replace `assets/brand/src/` and `svg/` with the new
ones, run `node scripts/brand/lockup.mjs`, copy the new cuts into `static/`,
run the two card scripts and the film, and read `BRANDING.md` for the sizes.

## 3. The swatches

Done on 2026-09-21 with the Metrale kit. One file is the source:
`assets/brand/tokens/brand.json`, which the kit's generator writes. The CSS
custom properties in `web-shared/avarok-tokens.css` restate it for both sites,
and `src/lib/brand-tokens.test.js` fails naming every token that has to follow
a change in the JSON.

1. Put the kit's `tokens/brand.json` in place: the two grounds, the inks per
   ground, the three hues as gradient pairs, the product gray.
2. In `avarok-tokens.css`, the tokens the test names follow mechanically:
   `--bg`, `--t1`, `--t2`, `--t3`, the `--m-*` set, `--ch-violet`, `--ch-cyan`,
   `--ch-gold`, `--accent-fill`. Then by hand: the surfaces stepped off the
   ground, the `-text` twins of the hues in the light theme (lightness lowered
   until each clears 4.6:1 on white, on `--bg2`, on `--card-2` and on the 12%
   chip tint of its own hue over each of those, the tightest pair on the site;
   a twenty line script, and the numbers are in the file), `--accent`,
   `--accent-fill-hover`, `--on-accent`, `--grad` and `--bar`.
3. `web-shared/theme.js` and each `app.html` pin the two ground colours for
   the theme-color meta tag. `src/lib/theme-color.test.js` holds them equal.
   The ground is also a literal in `src/lib/series-colors.js`, the b-roll
   scenes and the film script: search for the old hex.
4. Run the contrast gates. They are the reason the light theme has its own
   darker text hues, and a new hue that fails them cannot ship:

   ```sh
   bun .contrast-check.mjs                                  # from the repo root
   bun test --preload ./test-runes.js src/lib               # light-text-contrast, series-contrast, chart-swatch
   ```

5. The four hues carry meaning on the marketing pages: violet is speed and
   the engine, cyan is security and silicon, green is governance and a
   verified result, gold is community. `BRANDING.md` records that. The kit
   draws three hues and no green, so green stays as a UI signal (`--ch-green`,
   `--green`) rather than a brand hue. That is a decision recorded in
   `FACELIFT.md`, and the one to revisit if the kit ever names a fourth hue.
6. Ink on a filled accent. The kit's violet cannot carry white text (2.9:1),
   so every filled button reads `--on-accent`, the ground, instead of white.
   The old `color: #fff` on an accent fill is a contrast failure now.

## 4. The type

Done on 2026-09-21. The kit names Urbanist (Google Fonts, OFL) for headings and
body. It says nothing about a monospace, and the site's numbers, labels,
receipts and code stay in IBM Plex Mono.

1. The files: `static/fonts/urbanist-latin-wght-normal.woff2` and `-italic`,
   one variable file per style, the latin subset Google Fonts serves, with
   `URBANIST-LICENSE.txt` beside them. `static/fonts/type.css` declares them
   and Plex Mono; `src/app.html` attaches that sheet after first paint.
2. The fallback faces in `src/styles/fonts.css` are local Arial scaled to
   Urbanist's advance and given its ascent and descent, one face for weights
   up to 500 and one for 600 up, so the first paint occupies the space the web
   font will. The numbers come from the font files: instantiate the variable
   font at the weight (fontTools), average the advance over English letter
   frequencies, divide by Arial's, and express Urbanist's 0.95 em ascent and
   0.25 em descent in the adjusted em.
3. `--font-sans` in the tokens names the family, then the fallback, then the
   kit's own fallback (Helvetica Neue). `--font-mono` is unchanged.
4. `scripts/media/og.mjs` and `scripts/media/reel.mjs` set their cards in
   Urbanist from the same files.

## 5. What else names the brand

- The domain. `SITE` in `src/lib/content/brand.js` is the one constant. The
  blog's `MAIN_SITE` and `blog/src/app.html` follow it. DNS, Cloudflare Pages
  and the standby mirror are outside this repository.
- The X handle, `company.x` in `brand.js`, and the `twitter:site` meta tag.
- Email. `contacts` in `brand.js`, and `TO_*` in the forms Worker's
  `wrangler.toml` (a test holds them equal).
- The Worker names in `deploy/cloudflare/*/wrangler.toml` are internals.
- The chatbot's name is its own: `name` in `src/lib/prime/copy.js`.

## 6. What is not part of a brand change

The `av-` class prefix, `src/lib/components/avarok/`, `avarok-tokens.css`, the
`avarok-theme` storage key, the `Avarok-Cybersecurity` GitHub organisation, the
`avarok-*` crates, the `AVAROK_*` environment variables and `avarokctl`. The
first four are private to this repository and changing them buys nothing. The
last four are public interfaces of the engine, and renaming them is a decision
for its maintainers with a deprecation of its own.
