# Cloudflare Pages hosting

metrale.ai is served by Cloudflare Pages, with no origin server in the request
path. The zone and the Pages project are in the Metrale Cloudflare account.

## Projects

| Project | Serves | pages.dev |
| --- | --- | --- |
| `metrale-ai` | `metrale.ai` | `metrale-ai.pages.dev` |

It is a **Direct Upload** project, not Pages' git integration. The build in
`.github/actions/build-site` needs checkouts of the recipe registry and of the
engine at `site/engine.ref` (`.github/actions/engine-inputs`), and it carries gates a Pages-native build would bypass:
the flagship-recipe check and the per-route `<title>` check. CI builds, CI
uploads the gated output: `deploy.yml` on every merge to `main`, and `pr.yml`'s
`preview` job for pull requests from this repository's branches. The apex is a
proxied CNAME to `metrale-ai.pages.dev`; the zone's mail records are separate
and not touched by any of this.

`--branch=main` on the upload is load-bearing: a deployment on any other branch
gets a preview URL and does not move the custom domain. That fails as "the
deploy went green and the site is stale".

## The forms

The site's three forms post to a small Worker, `metrale-forms`, kept in
[`forms-worker/`](forms-worker/README.md). It is deployed by hand with `wrangler deploy`,
apart from the site, so nothing about it can take a page down. Until it is deployed and
its address is set as `formEndpoint` in `src/lib/content/brand.js`, each form drafts an
email in the visitor's own mail app instead.

## Metrale Prime, the guide

The chatbot on every page talks to a second Worker, `metrale-prime`, kept in
[`prime-worker/`](prime-worker/README.md): the model key, the knowledge base cut
from the built pages, a daily budget and rate limits live there, and the page
holds nothing but the Worker's address (`primeEndpoint` in
`src/lib/content/brand.js`; empty means no guide on the site). It deploys from
`.github/workflows/prime-worker.yml` on a push that touches it, or by hand from
that directory; the README says which secrets it needs and how they were
handled while it was built.

## What an origin server would have done

There is no origin server. What an nginx vhost would do comes from two files:

- **`static/_headers`** — the security headers and the cache policy. Read the
  note at the top of that file before editing it; Pages concatenates a
  re-declared header rather than replacing it, which silently cost the hashed
  assets their year-long cache once already.
- **`src/routes/404/+page.svelte`** — prerenders to `build/404.html`. Pages has
  no `try_files ... =404`; with no such file it answers every unmatched path
  with index.html and a **200**, so broken links return the front page and
  crawlers index unbounded soft-404s.

## www -> apex, when it is added

`www.metrale.ai` has no DNS record today, so it does not resolve. When it is
added, do it as a zone-level Redirect Rule on `metrale.ai`, not as a custom
domain on the Pages project:

    expression: (http.host eq "www.metrale.ai")
    action:     redirect, 301
    target:     concat("https://metrale.ai", http.request.uri.path)
    preserve query string: yes

with `www` as a proxied CNAME to the apex. It needs no origin and no Pages
binding, because a redirect rule is evaluated before Cloudflare resolves one.

Why not the other ways, measured on the previous hosts: `_redirects` path rules
work, but the documented absolute-URL form does **not** match on these projects,
and a path rule would bounce the apex too. And a hostname attached to the Pages
project as a custom domain is served by the Pages edge and never reaches the
zone's ruleset engine: the rule, stored, enabled and correct, did nothing until
the hostname was detached. The tell is in the response headers: the apex
returns `cf-cache-status: DYNAMIC` and an attached `www` returned no
`cf-cache-status` at all.

Creating or editing the rule over the API needs a token with **Zone -> Dynamic
Redirect -> Edit**, on top of the Pages, DNS and Cache Purge permissions the
rest of this setup uses. A token holding only some of those fails with
`request is not authorized` on the ruleset write while still listing rulesets
happily, which reads like a bug and is not one.
