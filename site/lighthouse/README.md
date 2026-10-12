# Lighthouse gate

Every public page must score **100 in all four categories**: performance,
accessibility, best-practices and SEO, on **both form factors**: Lighthouse's
mobile run (a mid-range phone on a slow 4G link, its CPU slowed four times) and
its desktop preset. No page makes a request to a third party. There are no
exceptions and no audits switched off. A page that fails is fixed at the cause.

`lighthouserc.json` holds the list and the assertions. Its settings are
Lighthouse's defaults, which are the mobile run. CI (`pr.yml`) runs the list
twice, once as it is and once with `--collect.settings.preset=desktop`, and
`src/lib/lighthouse-pages.test.js` fails if either leg goes missing.
Accessibility, best-practices and SEO are asserted on the median of five runs.
Performance uses the `optimistic` aggregation over the same five runs, because
CI machines are noisy. The thresholds are never lowered.

## What the mobile run needs

The mobile run is the hard one. Lighthouse simulates the slow link from what
the page requests before it first paints, so every byte fetched by then is on
the clock. Every page is prerendered and paints from its HTML alone, and the
app's scripts start after that paint (`src/lib/boot/defer-boot.js` and the gate
in `src/app.html`). Started at once, as SvelteKit does by default, they held
every page at 91 to 99. Keep anything new off that path: no script, font or
stylesheet that must arrive before the first paint, and no image larger than
the space it fills on a phone.

## Which pages

A public page is every page in the sitemap (`src/routes/sitemap.xml`, built
from the registry in `src/lib/content/index.js`) plus any other route with a
`+page.svelte`, such as `/diligence`. The registry marks two routes
`sitemap: false`, and only those stay out: `/broll`, the render page the media
recorder drives, and `/404`.

## Adding a page

Add its built file to the `url` list in `lighthouserc.json`, as
`http://localhost/<path>.html`. `src/lib/lighthouse-pages.test.js` fails until
you do, and fails too if the list names a page that no longer exists.

## Running it

From the repository root, after a build, the mobile run and then the desktop one:

    bun x @lhci/cli@0.15 autorun --config=site/lighthouse/lighthouserc.json
    bun x @lhci/cli@0.15 autorun --config=site/lighthouse/lighthouserc.json --collect.settings.preset=desktop

`/control` keeps its 100 on best-practices because it opens the agent socket
on load only in a browser that has paired before. Anyone else, the CI runner
included, gets the install invitation and a Connect button, so no refused
connection reaches the console.
