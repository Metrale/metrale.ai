# Lighthouse gate

Every public page must score **100 in all four categories**: performance,
accessibility, best-practices and SEO. No page makes a request to a third
party. There are no exceptions and no audits switched off. A page that fails
is fixed at the cause.

`lighthouserc.json` holds the list and the assertions. Accessibility,
best-practices and SEO are asserted on the median of five runs. Performance
uses the `optimistic` aggregation over the same five runs, because CI machines
are noisy. The thresholds are never lowered.

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

From the repository root, after a build:

    bun x @lhci/cli@0.15 autorun --config=site/lighthouse/lighthouserc.json

`/control` keeps its 100 on best-practices because it opens the agent socket
on load only in a browser that has paired before. Anyone else, the CI runner
included, gets the install invitation and a Connect button, so no refused
connection reaches the console.
