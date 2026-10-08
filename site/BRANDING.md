# Metrale website branding

The brand is Metrale, version 2 of the kit, applied on 2026-10-08. The kit is
`Metrale/metrale-assets`; the files this site, the blog and the docs use are
vendored from a signed release into `assets/brand/` by `assets/take-assets.sh`,
pinned in `assets/brand.pin`, and never edited here. The kit's guidelines are
`assets/brand/BRAND-GUIDELINES.md`. This file says how the website applies them,
and `BRAND-CHANGE.md` is the runbook for the next change.

## The logo

One component draws every logo on the site, the blog and the deck:
`web-shared/components/MetraleLockup.svelte`. It draws from
`web-shared/brand-art.js`, which `scripts/brand/kit.mjs` writes from the kit's
own SVGs, and `src/lib/brand-kit.test.js` fails if the module is behind the kit
or the component draws or colours anything of its own. Nothing is redrawn.

- **Two cuts, by ground.** The kit draws the horizontal logo (mark, rule,
  METRALE) once for dark grounds and once for light: on dark, ink letters and a
  violet-deep rule; on light, graphite letters and a heavier violet rule. The
  component references both and the theme shows the one for its ground. They
  are never swapped or recoloured.
- **The mark** is always the kit's copper. At 48 px and below the kit's compact
  cut is drawn, its fold gap widened so it survives small sizes.
- **Header**: the logo at 160 px, the kit's minimum, on every page.
- **Footer**: the logo at 244 px.
- **Metrale Prime**, the guide: the compact mark beside its name in type
  (`src/lib/prime/PrimeMark.svelte`). The kit draws no mark of its own for it.
- **Favicons and icons**: the kit's own, copied into `static/` by `kit.mjs`:
  `favicon.svg`, `favicon.ico` (the compact mark at 16, 32 and 48),
  `apple-touch-icon.png` (180, opaque on the ground), `icon-192.png`,
  `icon-512.png`, `icon-maskable-512.png`, and `logo.svg`, the dark-ground cut.
  `app.html` links the tab and touch icons with `?v=3`, so a browser holding an
  older cached icon fetches the kit's.
  The manifest is the kit's with the site's own fields added. The blog carries
  the favicons, the touch icon and the card.
- **Social card**: `static/og-image.png` is the kit's `og-image-1200x630.png`,
  on the site and the blog. The GitHub social preview is the kit's
  `github-social-preview-1280x640.png`, vendored in `assets/brand/dark/`.
- **Clear space** is one stem, 53 of the kit's units, on every side, which the
  component applies as margin in proportion to its width. The header and the
  footer keep their own padding around it.
- **One logo per surface.** The company logo everywhere public. The kit's
  product lockups belong only on a page about that product, and the site has
  none today: the products are named in type where they appear.

Never generate the logo with an image model, never redraw it, never recolour,
stretch, skew or glow it, never retype METRALE. `media-brief/README.md` repeats
this for anyone making imagery.

## Colour

`web-shared/metrale-tokens.css` is the single source of the roles, for this site
and the blog. Its palette block is the kit's `tokens/brand.json`, written by
`kit.mjs`; the roles name those colours, and `src/lib/brand-tokens.test.js`
holds each role to the kit colour it should name.

- **Copper is the brand.** The mark is the kit's copper, `#C65A2E`. Copper read
  as text, and every filled control, uses the kit's contrast-safe steps:
  copper-light `#D9774D` on dark (5.9:1 on the ground), copper-deep `#9E4422` on
  light (6.4:1 on white). Copper itself is 4.4:1 and 4.3:1, so it carries no
  text: it is the mark, the section rails, the chips' tint and the focus ring's
  family. Filled buttons are copper-light with ground ink on dark, copper-deep
  with white ink on light.
- **One accent.** Every section, ledger rail, chip and receipt edge is copper.
  The four section hues of the previous kit are gone.
- **Status**: green for a verified result, amber for a warning or a result still
  pending. They are UI signals, not brand colours, and used for nothing else.
- **Violet** is for product names only, in type. No page sets one today.
- **No cyan**, anywhere on the public sites. Focus rings are copper.
- **Grounds**: the kit's ground `#0E1318` is the only dark background, with the
  surfaces stepped off it; on light, the kit's white and paper `#F4F3F0`. Inks
  are the kit's: `#E6E6E9` for headings on dark, `#15181F` on light, graphite
  `#3C4049` for body on light, `#8A8F99` for metadata on dark.
- **Charts** keep their own data palette (`--series-*`,
  `src/lib/series-colors.js`): data, not brand.

`data-theme` is set before first paint from `localStorage` (`metrale-theme`) or
the system preference. `.contrast-check.mjs` measures every pairing the token
file promises, in both themes, and runs in CI.

## Type

Manrope, the kit's typeface, for everything set in words. IBM Plex Mono stays
for numbers, labels, receipts and code, which the kit does not cover. Both are
self hosted from `static/fonts/` with their licences beside them, because the
site makes no third party request: Manrope as the kit's one variable file
(weights 200 to 800, latin), attached by `src/app.html` after first paint behind
the kit's metric-matched 'Manrope Fallback' (`src/styles/manrope-fallback.css`),
so nothing moves when it lands. The kit's fallback stack, Helvetica Neue,
Helvetica, Arial, follows. The blog sets its articles in Charter and its
interface in the same stack.

## Imagery

Product footage is recorded from the product mockup and always carries its
"Demo data" chip. Generated imagery follows `media-brief/`, whose palette rule
is now the ground and copper. Logos of other companies appear only on the prior
roles wall, under the note that says they are not customers, and
`static/logos/README.md` records each source.

Still to follow the kit, and not redrawn here: the console recordings show the
mockup's previous logo in its chrome until the mockup takes v2 and they are
recorded again; the product film (`static/media/reel.*`) is cut from those
recordings and its title cards were set in the previous logo, so it is
re-rendered with `bun run reel` (which now sets the cards from the kit) once
they are; the generated b-roll and page stills were made in the previous
palette; and the cube loop under `static/media/brand/`, the guide's thinking
indicator, is the previous mark and waits for a new master from the kit.
