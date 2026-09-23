# Metrale website branding

The brand is Metrale. It was Atlas until September 2026, and for a few days on
an unmerged branch it was Avarok, a name no visitor saw. The kit landed on
2026-09-21 and this site applies it. The full guidelines are
`assets/brand/BRAND-GUIDELINES.md`, the kit's own text. This file says how the
website applies them, and `BRAND-CHANGE.md` is the runbook for the next change.

## The logo

One component draws every logo on the site, the blog and the product mockup:
`web-shared/components/AtlasLockup.svelte`. The file keeps its old name so the
imports across two apps did not have to move with the kit. It draws from
`web-shared/brand-art.js`, which `scripts/brand/lockup.mjs` writes from the
kit's own geometry (`assets/brand/src/geometry.js` and `src/paths.json`), and
`src/lib/lockup-artwork.test.js` fails if the module is behind the geometry or
the component draws anything of its own. Nothing is redrawn.

- The inks are tokens: `--m-ink-hi` and `--m-ink-lo` (the kit's two inks on
  dark, its one ink on light), `--m-lavender` and `--m-violet` (the M's right
  half), `--m-cyan-hi` and `-lo` (the bar), `--m-gold-hi` and `-lo` (the
  swash). The gradients keep the kit's directions. So the theme swap costs no
  second file and no second request.
- **Header**: the wordmark, 152 px wide (the floor is 140), on every page.
- **Footer**: the wordmark, 244 px.
- **Metrale Prime**, the guide: the mark with the swash lifted over the right
  shoulder, which reads as M′. `src/lib/prime/PrimeMark.svelte` draws it from
  the same definitions.
- **Favicons and icons**: the kit's own cuts, in `static/`: the app icon on the
  ground as `favicon.svg`, the kit's PNGs at 16, 32, 48, 180, 192, 512 and
  1024, the maskable 512, and `favicon.ico`. The blog carries the same set.
- **Social card**: `static/og-image.png`, rendered by `scripts/media/og.mjs`
  from `assets/brand/svg/wordmark-ondark.svg` and the front page headline, in
  Urbanist. The GitHub social preview is `assets/brand/social/`.
- Clear space is 76 units on every side (half the cyan bar), which the
  component applies as margin in proportion to its width. The header and the
  footer keep their own padding around it.
- One logo per surface. The kit's product lockups (`lockup-<product>`) are not
  used on the site: the products are named in type where they appear.

Never generate the logo with an image model, never redraw it, never recolour
it. `media-brief/README.md` repeats this for anyone making imagery.

## Colour

`web-shared/avarok-tokens.css` is the single source, for this site and the
blog, and `src/lib/brand-tokens.test.js` holds it equal to the kit's
`assets/brand/tokens/brand.json`. The ground is `#0E1318`, the only dark
background the kit allows, with the surfaces stepped off it. The inks are the
kit's: `#F7F7F9` for headings, `#D9D9DE` for body, `#8A8F99` for metadata, on
dark; `#15181F` on light. The accent is the M's violet: pale (`#CDBFF1`) as
text on dark, `#9F8DD8` as a fill, and the ink on a filled accent is the
ground, never white (`--on-accent`: white on that violet is 2.9:1, the ground
is 6.5:1). `data-theme` is set before first paint from `localStorage`
(`avarok-theme`) or the system preference. The contrast gate
(`.contrast-check.mjs`) runs in CI.

On the marketing pages each of the three promises has a hue, used
consistently: speed is violet, security is cyan, governance is green. Gold is
the fourth accent, for community and recognition. The kit draws three hues and
no green; green stays as a UI signal for governance and a verified result
(`--ch-green`, `--green`), a decision recorded in `FACELIFT.md`.

## Type

Urbanist for everything set in words: Medium for headings and the wordmark,
Regular for body copy, the way the kit says. IBM Plex Mono stays for numbers,
labels, receipts and code, which the kit does not cover. Both are self hosted
from `static/fonts/` with their licences beside them, because the site makes
no third party request: Urbanist as one variable file per style (weights 100
to 900, latin), attached by `src/app.html` after first paint behind metric
matched fallbacks in `src/styles/fonts.css`, so nothing moves when it lands.
The kit's own fallback, Helvetica Neue, follows in the stack.

## Imagery

Product footage is recorded from the product mockup and always carries its
"Demo data" chip. Ambient footage is procedural, drawn from the palette by
`src/lib/broll/scenes.js`. Generated imagery follows `media-brief/`. Logos of
other companies appear only on the prior roles wall, under the note that says
they are not customers, and `static/logos/README.md` records each source.

The cube loop under `static/media/brand/` is from the brand explorations, used
as the guide's thinking indicator. It is a placeholder that the kit may
replace; the two files are the whole of it.
