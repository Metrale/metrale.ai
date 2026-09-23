# The Metrale facelift: handoff

September 2026. Branch `site/avarok-facelift`.

This document is for whoever touches the marketing site next: a person, a
different model, a team of agents, or someone deciding to throw it all away. It
says what was built, why each decision went the way it did, where every kind of
change is made, and what is still open. Start here, then read `README.md` for
the commands.

> **Start with [SITE-GUIDE.md](SITE-GUIDE.md)**, the generated map of every page, button,
> link, address and asset, and [AGENTS.md](AGENTS.md), the one page on how to work here.
> This document is the reasons: what was decided, why, and what is still open.

## What changed, in one paragraph

The front page used to sell a local inference engine to developers. It now
sells an enterprise platform to the people who own GPUs: faster inference,
stronger governance, a fraction of what they pay today. The brand is Metrale, its kit applied on 2026-09-21 (see BRANDING.md and BRAND-CHANGE.md), and Metrale Prime, the site's guide, answers from the pages (deploy/cloudflare/prime-worker/README.md).
The developer pages (`/engine`, `/control`, `/diligence`) are intact under the
new header, because they are where every number on the new pages comes from.
Around them there are now thirty marketing pages, a payback model, six product
clips recorded from a mockup of the enterprise console, a one minute product
film, and generated imagery and footage made from a prompt pack that ships
with the site.

## The order of the story

The brief asked for a site that tells a buyer or an investor an immediate
story, modelled on how artemissecurity.com is laid out. The front page runs in
that order, one component per beat, in `src/lib/components/avarok/home/`:

| Beat | Component | What it has to do |
| --- | --- | --- |
| Announcement | `Announcement` | One measured fact, linked to the proof |
| Hero | `Hero` | Say what the product is. Show the product. One call to action |
| Who built it | `LogoWall` | Prior roles of the team. No customer logos, we have none |
| The problem | `Problem` | GPUs report tokens per second. The CFO pays per workload |
| The platform | `Solution` | Three layers and how a request passes through them |
| Speed, security, governance | `ValueBand` | One card each, each linking to its page |
| Proof | `Proof` | The published ladder, live from the repository |
| The console | `Tour` | Five recorded clips, one tab each: ask, queue, fleet, economics, governance |
| Recognition | `Recognition` | NVIDIA Inception, MLCommons, Hugging Face, AMD |
| Three differences | `Differences` | Claims a buyer can test |
| The chain | `Chain` | Each layer earns the next |
| Deliveries | `Deliveries` | Week one, months one to six, at renewal |
| Voices | `Voices` | Community quotes, verbatim |
| Questions | `FaqList` | Deployment time, data ownership, pricing |
| Next step | `CtaBand` | Everything loops back to the demo |

## Where each visitor lands

The site is organised so that every kind of visitor has a page that is plainly
theirs, and the guide pitches to the same people. The four axes line up:

| who arrives | the page that is theirs | the guide's audience | the FAQ tag |
| --- | --- | --- | --- |
| Someone who owns or sells GPUs | `/solutions` under "Own the GPUs": neoclouds, enterprise datacenters, hyperscalers | I run GPUs at scale | `deploy`, `pricing` |
| A regulated buyer | "Regulated industries": financial services, healthcare, legal | I run GPUs at scale | `deploy` |
| The public sector | "Public sector": government and defense, police and public safety, state and local government | I run GPUs at scale | `deploy` |
| A lab or a small team | "Research and edge": research labs, SMB and edge | I want to contribute, Just looking | `hardware` |
| An investor or a diligence team | `/company`, `/trust`, `/diligence`, the deck on request | I am evaluating an investment | `pricing` |
| A developer | `/engine`, `/control`, `/benchmarks`, the repository | I want to contribute | `hardware` |

`sectors` in `brand.js` is the one list the Solutions menu and the sector bar
read; `AUDIENCES` in the guide's `prompt.js` is the other. When a sector is
added, add its people to the guide's audience briefs too, or the guide will
pitch them as "just looking".

## Where things live

```
site/src/lib/content/        every word, link and price. Edit here, not in components
  brand.js                   names, routes, sectors, nav tree, footer, contacts, form endpoint
  index.js                   the page registry: title and description for every page
  home.js why.js platform.js solutions.js pricing.js company.js resources.js faq.js
  live.js                    the generated numbers the copy prints, and fill()
  media.js  art.json         video slots, and stills installed from the prompt pack
site/src/lib/components/avarok/   the marketing components, prefix av-
site/src/lib/economics.js    the payback model, pure functions, tested
site/src/lib/prime/          Metrale Prime on the page: state, the stream reader, the renderer, the panel
site/deploy/cloudflare/prime-worker/   the Worker behind it: the model, the tools, the knowledge base, the receipts
site/scripts/prime/          cuts the knowledge base from the build; the trial that chose the model
site/scripts/brand/          the rename script. BRAND-CHANGE.md is its runbook
site/src/lib/broll/          procedural ambient loops
site/src/styles/avarok.css   the marketing design system
site/src/routes/(marketing)/ the marketing pages, thin: they pick content and components
site/src/routes/(engine)/    the developer pages, unchanged apart from the header
site/src/routes/(app)/       full viewport render pages for the media pipeline
site/scripts/media/          record, encode, install, film, social card, prompt sheet
site/media-brief/            the prompt pack, the takes ledger, the film's cut, the reasoning
web-shared/                  tokens, theme switch, the lockup. Shared with the blog
assets/brand/                vector masters
```

The three route groups exist so two stylesheets never meet. The developer pages
load `app.css`, the marketing pages load `avarok.css`, and SvelteKit only ships
a group's CSS to that group's pages.

## How to change things

| To change | Edit |
| --- | --- |
| Any sentence on any marketing page | The matching file in `src/lib/content/` |
| A page title or description | `src/lib/content/index.js` |
| The nav or the footer | `nav` and `footer` in `src/lib/content/brand.js` |
| A price, a tier, a feature list | `src/lib/content/pricing.js` |
| The payback model's defaults | `FLEET_DEFAULTS`, `API_DEFAULTS` and `ENERGY_DEFAULTS` in `src/lib/economics.js` |
| The tokens per watt tab from USER to MEASURED | Nothing on the site. Publish the draw in the ladder, see open question 20 |
| A contact address | `contacts` in `src/lib/content/brand.js`. Keyed by job (sales, business, technical, operations, collaboration, security), so a change of person is one line. Then `bun run guide` |
| Who is on a contact card | `contact.paths[].doors` in `src/lib/content/company.js`. Each door is a label and an address |
| A team member's line, photo or profile | `team.people` in `company.js`, portraits in `static/team/`. Only on that person's word |
| Offer the deck as a download | `team.deck.file` in `company.js`. Read open question 17 first |
| The culture lines, a role's detail, the interest form | `careers` in `company.js` |
| The map of the site | Never by hand. `bun x --bun vite build`, then `bun run guide -- --note "what changed"` |
| Where the forms post | `formEndpoint` in `src/lib/content/brand.js`, the address of the Worker in `deploy/cloudflare/forms-worker/`. Empty means they compose an email. The demo form and the waitlist form are one component, `DemoForm.svelte`, and each post carries a `source` |
| A form's fields or wording | `demoPage.form` or `waitlistPage.form` in `src/lib/content/company.js` |
| The team's prior employers | `logoWall` in `src/lib/content/home.js`, files in `static/logos/` |
| Emblems or plain type for the two commands | `logoWall.emblems` in `src/lib/content/home.js`. One boolean |
| A partner's logo | `logoWall.programs` and `recognition.cards` in `home.js`. `static/logos/README.md` says how to add a file |
| Releasing the Community Edition | Point the buttons that use `routes.waitlist` back at the install page, then delete `waitlistPage` and `src/routes/(marketing)/waitlist/` |
| A product name | `company` in `src/lib/content/brand.js`. Copy uses `{engine}` and friends |
| An industry | `industries` in `brand.js`, and its entry in `solutions.js` |
| A video | `node scripts/media/install.mjs --from <file> --as <slot>` |
| Which clip opens a page | `heroClips` in `src/lib/content/media.js` |
| The film | `media-brief/reel.json`, then `bun run reel` |
| A page hero image | Same command with an image. It registers itself in `art.json` |
| A colour | `web-shared/avarok-tokens.css`. Both themes. The blog reads it too. `BRAND-CHANGE.md` section 3 for a whole palette |
| The logo | `assets/brand/` masters, then `web-shared/components/AtlasLockup.svelte`. `BRAND-CHANGE.md` section 2 for a new kit |
| The brand name | `node scripts/brand/rename.mjs --from X --to Y --apply`, then `BRAND-CHANGE.md` section 1 |
| What the guide says or offers | `src/lib/prime/copy.js` for its words and starters, `deploy/cloudflare/prime-worker/src/prompt.js` for its rules and audiences, `src/tools.js` for what it can do |
| What the guide knows | Nothing by hand. `bun x --bun vite build`, then `node scripts/prime/corpus.mjs --upload --remote` |

To add a page: add its path to `routes`, its title to the registry, a
`+page.svelte` under `(marketing)`, and a nav entry if it should be found. The
tests in `src/lib/content/site.test.js` fail until all four agree.

## Rules the site keeps

**Numbers are generated, never typed.** Every performance figure comes from
`ladder.generated.json`, `live.generated.json`, `models.generated.json` or
`stars.generated.json`, through `live.js`. Copy says `{ratio}` and `{c}`, and
`fill()` substitutes. When the ladder is regenerated the front page follows.

**Every input to the payback model says what it is.** `MEASURED` comes from the
published ladder. `PROPOSED` is a price we have proposed and can change. `USER`
is the visitor's to edit. The 70% claim on the front page is the second
scenario with its defaults, and the page says "modeled". The third scenario
counts in tokens per joule. Its throughput is `MEASURED` and its draw is `USER`,
because the ladder publishes no power, and it prices energy only, so it makes
no payback claim.

**Prices are proposed.** The pricing page says so on every tier. They have not
been approved as a public list.

**No customer logos.** The logo wall shows where the team worked before, under
a line that says so, with a note that these are not customers or endorsements.
`static/logos/README.md` records each mark's source and terms, and a test fails
if a file there is not written down. United States Cyber Command and Naval
Special Warfare Command appear with their official emblems. Those are public
domain as artwork and protected as insignia, which is a different thing: see
open question 14 before launch. `logoWall.emblems = false` sets both back in
plain type.

**A button goes where it says.** Calls to action that promise a demo land on
the booking form, `/demo#book`, with the caret in the first field. Only the
header button and the footer link open the top of that page. A route may
carry an anchor, and `site.test.js` checks the id exists, because a link to a
missing anchor does not fail, it lands at the top and reads as a dead button.

**Nothing is offered that is not released.** The Community Edition is not out,
so its buttons say waitlist and go to `/waitlist`. The engine under it is
released and open source, and the waitlist page says so and points at the
developer page, because a developer who wants it today should not be told to
wait. A browser test fails if any page offers to install the edition.

**If the site says it about the company, a source says it.** Where the
company is based, how it works, what it pays, when something happens, how fast
it delivers: none of that is the site's to guess. A first draft of this
branch had a home city, a remote first policy, founding equity, hardware on
your desk, a results date MLCommons has not set, and a 48 hour delivery
promise. None had a source and all were removed. The careers page now states
only how the work is done, which the repository shows, and role locations
read "by agreement". Contributor roles are the ones people state about
themselves on the blog. Delivery timing uses the brief's own frame: week one,
months one to six, at renewal.

**Attributed quotes are verbatim.** Two community quotes use the engine's old
name. They stay as written, with a note under them. A quote is never edited to
follow a rebrand.

**The voice.** No em dashes, no semicolons, no exclamation marks, short
sentences. `site.test.js` enforces it on every string in `content/`.

**No third party requests.** Fonts, logos and media are self hosted. The
Lighthouse gate requires it and `e2e/marketing.spec.js` checks it.

**The map is generated and the ledger remembers.** `SITE-GUIDE.md` is rebuilt from the
built site on every `bun run guide`. `guide/ledger.json` gives every name, address,
link, licence line and asset a revision and a date. Change one without recording it and
the unit suite fails, by name, with the command to run. Pages whose links come from data
(contributors, recipes, records, the changelog) are mapped but their links are not
listed, so somebody else's commit cannot make the guide stale.

**An idle page costs nothing.** Lighthouse measures how fast a page arrives, not what it
costs to leave open. Anything that animates forever moves only `transform` or `opacity`
and stops when it is off screen. The budget is 5% of one core, `bun run perf:cpu` measures
it the way Chrome's task manager does, and a browser test enforces the rule behind it.

**The site is two documents.** The marketing pages and the developer pages have different
design systems, and the client router never removes a stylesheet. So a link between them
is a full page load and is never preloaded. `src/lib/route-groups.js`.

**An email button always does something.** A `mailto:` link is silent on a machine with no
mail app. Every one also copies the address and says so, and a form that could only draft
an email shows the draft so it can be pasted. `MailToast.svelte`, `DemoForm.svelte`.

**The marketing pages stay light.** `gates.generated.json` is a megabyte. Only
the benchmarks page may import it. `bundle-budget.test.js` holds that line,
after the first build of this branch put it on twelve pages by accident.

## The product mockup is not in this repository

The brief said to mock up the enterprise product, keep it out of the public
repo, work locally, and screen record it. So the console you see in the clips
is a separate private project on Alexi's machine, and only its recordings are
here. `media-brief/README.md` says where it is and how to re-record. Nothing on
the public site links to an interactive console, and a test checks that.

## The brand

The engine was named Atlas until September 2026. The company is Metrale, and its
kit landed on 2026-09-21. The rebrand reached every marketing page, the developer
pages' visible copy, the blog's chrome, the lockup and every icon, the social
cards, the film's title cards, `llms.txt`, the JSON-LD and the web manifest.

It deliberately did not reach:

- **Blog posts.** Dated articles with permanent URLs keep the name they were
  written under. Only the blog's chrome changed.
- **The diligence deck's evidence labels.** They mirror published campaign
  records that say Atlas. The deck's stamp says so on every slide.
- **Commands, crates, images, URLs.** `atlasctl`, `avarok/atlas-gb10`, the
  repository, the GitHub organisation and the domain are what they are until
  someone renames them, and that is a decision for the engine's maintainers.
- **The legal entity.** Atlas Cybernetics Corp., in the footer, until the
  company says otherwise.

The artwork: the kit is a generator (`assets/brand/gen.js` with its geometry and
letter outlines), and the site draws every lockup from that geometry through
one component and one generated module, so nothing is traced or redrawn and a
new kit is a script run. The palette is the kit's, with the light theme's text
hues lowered until they clear the contrast gates on every surface, including
the chips' tints. The type is Urbanist, self hosted behind metric matched
fallbacks, with IBM Plex Mono kept for numbers, labels and code. `BRANDING.md`
says how the site applies the kit; `BRAND-CHANGE.md` is the runbook for the
next change, name, artwork, palette and type, in the order that keeps every
gate green.

## Tests and gates

| Check | Command | What it holds |
| --- | --- | --- |
| Unit | `bun test --preload ./test-runes.js src/lib` | Content integrity, the payback model, loop seams, the prompt pack, bundle budget |
| Browser | `bun x --bun playwright test e2e/marketing.spec.js` | Menus, tabs, calculator, theme, form, every page, no third party requests |
| Contrast | `bun .contrast-check.mjs` from the repository root | Text contrast in both themes |
| Titles | In `.github/workflows/site.yml` | Each route kept its own title |
| Cross links | `bun blog/e2e/check-crosslinks.mjs site/build blog/build` | The blog's links into this site resolve |
| Cache rules | Part of the unit suite, `headers.test.js` | Every page has one rule in `static/_headers`, none has two, the file fits Pages' limit |
| Lighthouse | In CI | Performance, accessibility, best practices and SEO at 1.0 |
| The guide | Part of the unit suite (`prime-worker.test.js`, `prime-corpus.test.js`, `prime/*.test.js`) and `e2e/prime.spec.js` | The Worker's loop against a fake model, the knowledge base cut, the renderer, the stream, the page against a stub |
| The guide's Worker in CI | `.github/workflows/prime-worker.yml` | Deploys the Worker, writes its secrets from the repository's, checks health, and on request re-cuts the knowledge base and spends one real question |

## Decisions, and why

- **Developer pages kept, not rewritten.** They are the evidence. The new pages
  point at them for every claim. The old nav became a section bar under the
  new header (`src/styles/engine-shell.css`).
- **One masterbrand, descriptive product names.** Metrale Engine, Metrale
  Control, Metrale Economics, Metrale Console. The suite name is still being
  decided, and `company` in `brand.js` is the one place to change it.
- **The form composes an email.** A static host has nowhere to post to. Set
  `formEndpoint` and the same form posts JSON instead.
- **Procedural b-roll first, generated footage over it.** The loops drawn by
  code were the placeholder of known quality. Grok's first run on 2026-09-18
  replaced them, and `media-brief/takes/TAKES.md` is the ledger of that run.
  `media-brief/RATIONALE.md` has the full reasoning.
- **The mp4 is listed before the webm.** For flat interface footage H.264 came
  out smaller than VP9 at the same legibility.
- **Fonts arrive after the first paint.** The Lighthouse gate demands 100 and
  main, on system fonts, scores it. IBM Plex in the bundle cost every page a
  point. So the page paints in fallback faces scaled from the font files to
  occupy the space Plex will (`src/styles/fonts.css`), and `src/app.html`
  attaches `static/fonts/plex.css` after the first paint on a first visit and
  at once on later ones. The swap moves nothing.
- **Two named chunks, and menus rendered on demand.** One chunk per component
  made the front page 50 requests to main's 27, and three hidden mega menus
  plus a drawer doubled the DOM of every page. `vite.config.js` groups the
  chrome and the components, and `SiteNav` renders a menu only while it is
  open. Both were measured against main's build before and after.
- **A mouse click never closes a hover opened menu.** People hover, then click.
  A plain toggle shut the menu under their cursor. Keyboard and touch toggle.
- **The tour's panels are stacked, not hidden.** With `display: none` a tab's
  poster was fetched on the click, and the screen sat empty for a second. The
  panels now share one grid cell and the ones not chosen are
  `visibility: hidden`, so every poster is decoded before the first click. They
  are released only after the page is idle and the tour is near, so the first
  paint pays nothing. Only the chosen tab's video plays. A tab's video starts
  loading when the pointer reaches its tab. `home/Tour.svelte` has the detail.
- **Clips are started by script, not by `autoplay`.** `VideoClip.svelte` mounts
  a video once it is near the screen and the page is idle, then calls `play()`.
  The first version waited for `canplay` with `preload="none"`, which never
  fires, so nothing played. A browser test now watches a clip's clock advance.
- **Element resets use `:where()`.** `.av p { margin: 0 }` outranks any single
  class, so for a while the eyebrow, the lede and seven other classes lost the
  margins they ask for. The link reset had the same fault earlier. A reset in
  `avarok.css` must never carry the weight of a class.
- **The ring around a screen is turned, not repainted.** It was a conic gradient whose
  angle was animated through a registered custom property, with a blurred copy behind it.
  That repaints and re-blurs every frame: 38% of a core on the idle front page, measured.
  The gradient is now painted once on a square that is rotated with `transform`, clipped by
  the frame, and the glow is a static four colour shadow. Same picture, 2 to 3%.
- **What both halves of the site share is named, not left to the bundler.** A chunk
  group takes its modules' dependencies with it, so the star count and the ladder data,
  which both a marketing component and a developer page print, had landed in the
  marketing chunk. Every developer page then downloaded 130 KB of marketing components
  and inlined their CSS to read a number. They are listed in `av-chrome` in
  `vite.config.js` now, and `e2e/page-weight.spec.js` holds a request budget for seven
  pages. The same test would have caught the 22 byte facade chunk that one `import` of
  `$app/navigation` in the root layout left on every page.
- **The forms post to a Worker of their own.** `deploy/cloudflare/forms-worker/` keeps each
  request in KV, then tells Discord, Slack or an inbox, whichever has a secret set. It is a
  standalone Worker and not a Pages Function, because the site is uploaded by CI as plain
  files and a mistake in a function would stand in front of every page. If the post fails
  the form says so and hands the visitor the drafted email. It was run end to end on one
  machine, a browser through the site to the Worker in Cloudflare's own runtime, before it
  was committed. It is not deployed: that needs the account.
- **Media stays out of the service worker.** `static/` went from a few icons to 31 MB of
  video, and the worker precached all of `static/` on install, for every first visit and
  again on every deploy. Media is now neither precached nor handled (video arrives in byte
  ranges the Cache API cannot store). A test holds the precache under 1 MB.
- **The exchange is the real thread.** Captured from the public pull request in both
  themes, in UTC so its dates match the timeline, with the words in the alt text.
  `scripts/media/capture-thread.mjs` takes it again.
- **The team is on the page, the deck is not.** Names, titles, one line each, portraits
  and profiles, from the company's own team slide. See open questions 17 and 18.
- **No bounty is promised.** The careers page says a pull request is the fastest way in.
  A cash bounty is a term the company would have to set, fund and honour, so the page
  does not invent one. `careers.fastTrack` is where it would go.
- **The industry pages get a second look.** Daylight scenes of the buyer's own place of
  work instead of eleven dark corridors. `media-brief/RATIONALE.md` has the reasoning and
  the `N` shots in `shots.json` are the prompts. A page with several stills turns through
  them (`artsFor` in `media.js`).
- **The architecture diagram is sized from its text.** Plex Mono is 0.6 em a
  character, so a box's width is arithmetic. The comment in `ArchDiagram.svelte`
  has the rule, and a browser test measures every label against its box.

## Open questions for the team

1. **Prices.** Are the proposed list prices approved to be public?
2. **Sales contact.** The site uses Kyle's direct address at
   `atlascybernetics.ai`. A `sales@` alias would keep a personal inbox off a
   public page. One line in `brand.js`. The security address is still the one
   `SECURITY.md` publishes, on purpose: change both together, and only to a
   mailbox that exists.
3. **Form endpoint.** Do we want demo requests in a CRM? Then set `formEndpoint`.
4. **The legal name.** The corporate lockup sets the wordmark over "Cybernetics
   Corp", so it now reads "Metrale Cybernetics Corp", which is not the entity's
   name. It is therefore rendered nowhere: the README header and the blog
   footer use the full lockup. If the company adopts that name, switch both
   back to `kind="corp"` and the corp masters. The footers still say Atlas
   Cybernetics Corp. in text, which is true today.
5. **Author titles on the blog.** Changed from Atlas to Metrale. The people
   named should confirm their own.
6. **Founders section.** Skipped for now on instruction. The company page has
   the story, not the people.
7. **Repository README and docs book.** Still say Atlas. Out of scope here.
8. **GitHub social preview images** in `assets/brand/` still show the old
   wordmark. `scripts/media/og.mjs` is the pattern to regenerate them.
9. **"jev".** The brief names it beside Bend as a Labs topic. Nothing in the
   source material says what it is, so it is not on the page. Bend is. One
   line in `labs.tracks` in `src/lib/content/resources.js` adds it.
10. **Raw video takes.** About 34 MB of generated footage sits uncommitted in
    `media-brief/takes/`. Committing it means LFS. The team's call.
11. **The standby origin.** `deploy/nginx/atlascybernetics.ai.conf` rewrites clean
    URLs for three routes by name: `engine`, `control`, `diligence`. CI does not
    deploy that file, and I did not edit infrastructure I cannot test. Cloudflare
    Pages, which serves the site, needs nothing. If the standby ever takes
    traffic, the thirty new routes need the same rewrite there, for example
    `rewrite ^/([a-z0-9-]+(/[a-z0-9-]+)*)$ /$1.html break;` after excluding
    `_app`, `media`, `fonts`, `logos`, `brand` and `lattice`.
12. **Cloudflare Pages paths.** The build writes both `platform.html` and a
   `platform/` directory of child pages. Pages serves `/platform` from the
   file. Worth one look on the preview deployment.
13. **Domain.** `atlascybernetics.ai` is unchanged. `SITE` in `brand.js` is the
    one constant to move when DNS does.
14. **The two command emblems.** They are on the wall because they were asked
    for. Department of Defense emblems may not be used in a way that suggests
    endorsement, and a company normally needs the owning service's permission
    to show one. The wall carries the Department's standard disclaimer, which
    is not permission. Before launch, get it in writing or set
    `logoWall.emblems` to `false`. `static/logos/README.md` has the detail.
15. **Where waitlist entries go.** They go to the sales address, like demo
    requests. It is the `to` prop on the form in
    `src/routes/(marketing)/waitlist/+page.svelte`.
16. **What the Community Edition will contain.** The waitlist page says only
    that it is the free edition under AGPL-3.0 and is not released. The pricing
    tier still lists what is in it. The team should confirm that list.
17. **The deck.** Asked for as a download beside the team. It is not in the repository,
    because this repository is public and a file pushed here is published at that moment,
    before anyone reviews it. The deck was written for private meetings, so it needs a read
    through by its owner for what may be public before any version goes here. Until then
    the button asks for the deck by email. To publish a version made for the public, put
    the PDF under `static/` and set `team.deck.file`.
18. **Each person confirms their own entry.** Photo, title, line and profile link for the
    five people in `team.people` came from the company's team slide and the links Alexi
    supplied. Each of them should read their own before this merges. Two have: Tom
    Turney's line is his own wording, and Thomas Braun's was corrected on his word on
    2026-09-19 (patented, with the patent linked from his card).
19. **Deploy the forms Worker.** With no endpoint a form can only draft an email in the
    visitor's own mail app, and every visitor who does not press send is lost. The fix is
    written and tested: `deploy/cloudflare/forms-worker/`. It needs ten minutes from someone
    with the Cloudflare account (a KV namespace, one webhook or email key, `wrangler
    deploy`), then its address in `formEndpoint`. Its README has the steps and the options
    that were weighed against it.
20. **Publish power with the ladder.** The third payback tab counts in tokens per joule:
    tokens per second over watts, where the seconds cancel. `src/lib/economics.js` spells
    out the units above `efficiency()`. The ladder publishes throughput and no power, so
    the tab labels the draw `USER` and defaults it to 240 W, the rating of the DGX Spark's
    power supply, which is a ceiling. What the benchmark has to record for each rung and
    each engine is the mean draw in watts over the same timed window the tokens are counted
    in (or the energy in joules over it, which is the same thing), and which boundary it was
    read at, the GPU rail or the wall. The harness today reads `power.draw` once, as a rep
    starts, which is a sample and not a mean. When `scripts/gen-ladder.mjs` writes that
    draw into `ladder.generated.json` as `atlas_watts` on a row and `watts` on each
    baseline, `efficiencyLadder()` and `energyInputsFrom()` use it, and the labels, the
    starting draw and the graph's caption turn to `MEASURED` with no edit to the site. If
    the field names come out different, those two functions are the only place to change.
21. **Deploy Metrale Prime's Worker and name it.** The guide in the corner of every
    marketing page is written, tested with the model faked, and tried against the real
    model (`deploy/cloudflare/prime-worker/TRIALS.md`). It is off until someone with the
    Cloudflare account and an xAI key deploys `deploy/cloudflare/prime-worker/` (its README,
    about fifteen minutes) and pastes its address into `primeEndpoint` in `brand.js`. The
    daily budget in `wrangler.toml` starts at ten dollars; the trial put an answer at about
    a cent and a half.
22. **The partner tier.** The knowledge base can hold documents that are not in the
    repository (the deck, the plan) behind a code a visitor types into the panel. It is a
    gate, not a security boundary, and it is empty until someone builds the base with
    `--private <dir>`. Decide whether the deck belongs there at all: a code typed into a
    public page can be passed on.
23. **The origin of the name.** Answered on 2026-09-21: the About page now has a section,
    "Measure first.", on metron, the Greek word for measure, on the national accounts that
    made economies manageable, and on the same job done for inference. It is `name` in
    `company.js`, with its sources in the comment above it. Wording is the owners' to tune.
24. **Green is not in the kit.** The Metrale kit draws violet, cyan and gold. The site's
    grammar has four hues, and green carries governance and every verified result. It stays
    as a UI signal (`--ch-green`, `--green`), not a brand colour. If the kit ever names a
    fourth hue, swap it there and the meaning follows.
25. **Ink on violet.** The kit's violet cannot carry white text (2.9:1), so every filled
    button on both sites sets its text in the ground colour (`--on-accent`). Primary buttons
    are pale on dark now. If that reads wrong to the team, the alternative is a deeper
    violet derived from the kit's for fills, with white on it, which the kit does not draw.
26. **Plex Mono stays.** The kit names Urbanist and no monospace. Numbers, labels, receipts
    and code keep IBM Plex Mono; the developer pages depend on it. A monospace from the
    kit, if one comes, is a one line change in the tokens.
27. **The film and the cards were re-rendered from the new kit.** The social cards by
    `scripts/media/og.mjs`, the film's title cards by `bun run reel`. The product clips
    themselves were recorded from the mockup and do not show the logo.
28. **The console recordings.** Re-recorded on 2026-09-21 from the mockup with the Metrale
    lockup and typeface in its chrome (`scripts/media/record.mjs`, `encode.mjs`, then
    `bun run reel`); the "Demo data" chip stays. The previous takes are kept outside the
    repository in case they are wanted back.

29. **Role mailboxes at metrale.com.** On 2026-09-21 the founders asked for the team to be held
    back from the site for now, so every published door is a role mailbox at metrale.com
    (`contacts` in `brand.js`: sales, partnerships, engineering, community, press, careers),
    and the forms Worker sends the demo, waitlist and careers forms there (`TO_*` in its
    `wrangler.toml`; a test holds the two equal). None of those mailboxes exists yet, and the
    Worker still sends from forms@atlascybernetics.ai, which is the domain Resend has verified.
    Before launch: create the six mailboxes, or point `contacts` back at people
    (`contactsDirect` in the same file keeps the founders' addresses), and verify metrale.com
    in Resend if the sending address moves too. The security address is the repository's own
    and is unchanged.
30. **The team is held back.** `showTeam` in `company.js` is `false`, so the About page shows
    no portraits, titles or links; everything is kept in the file. The guide follows the
    site: without the team on a public page it will say the team is not published, and only
    the partner tier (the deck) can name the founders. Flip the switch when the founders say so.

31. **Lie detection is not on the police page.** The founders listed "lie detector analysis"
    among police workloads on 2026-09-21. The page carries transcription, indexing, report
    drafting and fleet telemetry, and not that one: a claim that a model detects deception is
    one a department would test in court, and the site's rule is receipts, not adjectives.
    If the product does ship an interview review workload, describe what it measures.
32. **The proposed blocks from the architecture brief.** `/platform/control#blueprint`,
    `/platform/economics#blueprint` and `#operators`, `/platform/deployment#parity` and
    `/pricing#metering` all carry "Proposed" in their note and date the brief. They are the
    products and features of the brief, not its internals. When the brief is published or
    revised, revisit each note; when a piece ships, move it out of "proposed".


## How to throw it away

The old front page is in git history at the commit before this branch. The new
pages are confined to `src/routes/(marketing)`, `src/lib/content`,
`src/lib/components/avarok`, `src/lib/broll`, `src/styles/avarok.css`,
`scripts/media` and `media-brief`. Deleting those and restoring
`src/routes/+page.svelte` and `+layout.svelte` from history returns the site to
where it was. The lockup, the developer page rename and the blog rename are
commits of their own for the same reason.
