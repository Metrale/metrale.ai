# metrale-prime: the Worker behind Metrale Prime (M′)

Metrale Prime is the guide built into the website: a visitor asks a question in
the corner of any marketing page and gets an answer that cites the page it came
from. The site is static files, so the model, its key and the knowledge base
live here, in one Worker with one KV namespace. A page posts a conversation to
`/chat` and reads back a stream of named events while the answer is worked out.

What one answer does, in order:

1. Checks the caller is one of the site's origins, the address is under its
   rate, and the day is under its budget.
2. Builds the prompt (`src/prompt.js`): who the visitor said they are, the page
   they are on, the map of the site, and the rules: cite, never invent a number,
   label measured against modeled against proposed, no fundraising terms
   without the partner tier.
3. Streams the model (`src/xai.js`, xAI's chat completions, grok-4.7 by default).
   Its thinking streams to the page as it happens.
4. Runs the tools it asks for (`src/tools.js`) against the knowledge base
   (`src/corpus.js`), telling the page each one: `search_site`,
   `get_benchmark`, `estimate_economics` (the pricing page's own payback model,
   imported from `site/src/lib/economics.js`), `list_pages`, `next_steps`,
   `repo_activity`, `capture_lead`.
5. Sends the sources, then the receipt: tokens, the dollars xAI charged (to
   the tick), time to first token, time to first answer token, total.
6. Keeps a telemetry record (`src/telemetry.js`) with no message text in it,
   and adds the dollars to the day's counter.

The page side is `site/src/lib/prime/`. The two are joined by the events in
`src/sse.js`, and both halves are exercised by `site/src/lib/prime-worker.test.js`
and `site/e2e/prime.spec.js`, with the model faked.

## Set it up

About fifteen minutes, by someone with the Cloudflare account and an xAI key.
From this folder:

```sh
npx wrangler@4 login

# 1. The namespace. Paste the id it prints into wrangler.toml.
npx wrangler@4 kv namespace create PRIME

# 2. The secrets. Each asks for the value.
npx wrangler@4 secret put XAI_API_KEY          # from console.x.ai
npx wrangler@4 secret put PRIME_ADMIN_CODE     # optional: lets you read /stats
npx wrangler@4 secret put PRIME_PARTNER_CODE   # optional: see "The partner tier"

# 3. The knowledge base, cut from the built site. From site/:
bun x --bun vite build
node scripts/prime/corpus.mjs --upload --remote
#    add --private <a directory outside the repository> for the partner tier

# 4. Ship it. It prints the address, https://metrale-prime.<account>.workers.dev
npx wrangler@4 deploy
```

Then prove it:

```sh
curl https://metrale-prime.<account>.workers.dev/
# {"ok":true,"service":"metrale-prime","model":"grok-4.7","effort":"low","corpus":{"public":770,...},...}
```

## Switch the site on

One line, in `site/src/lib/content/brand.js`:

```js
export const primeEndpoint = 'https://metrale-prime.<account>.workers.dev';
```

Then from `site/`: `bun x --bun vite build`, `bun run guide -- --note "Prime is on"`,
commit, push. The launcher appears on every marketing page from that build.
Empty, nothing renders and nothing is requested.

## Keep the knowledge base current

The base is cut from the built pages, so it says what the site says. After a
copy change ships, rebuild and upload again:

```sh
bun x --bun vite build && node scripts/prime/corpus.mjs --upload --remote
```

`scripts/prime/corpus.mjs` also reads the engine's documents in the repository
(`README.md`, `QUICKSTART.md`, `docs/ARCHITECTURE.md`, the ladder's results
log and the rest of the list at the top of the script), the blog, and a
snapshot of the repository's history from the GitHub API (`gh api`, cached a
day in `scripts/.cache/`). The health check reports the build time and the
commit the base was cut from, and every answer's `meta` event carries them.

## Money and limits

`wrangler.toml`:

| var | default | what it does |
| --- | --- | --- |
| `PRIME_MODEL` | `grok-4.7` | the model. `grok-4.5` and `grok-4.6` take the same settings; `grok-4.3` is half the price and does not think |
| `PRIME_EFFORT` | `low` | how hard it thinks: `low`, `medium`, `high`, `xhigh`. See the trials below |
| `PRIME_DAILY_BUDGET_USD` | `10` | after this much in a day, new conversations get a 503 and the page says the guide is resting |
| `PRIME_RATE_PER_MINUTE` | `8` | turns a minute from one address |
| `PRIME_RATE_PER_DAY` | `120` | turns a day from one address |
| `PRIME_MAX_ROUNDS` | `4` | tool rounds before the model has to write. Within a round, an answer gets four searches |
| `PRIME_FIRST_TOKEN_TIMEOUT_MS` | `20000` | a stream that sends nothing for this long is dropped and asked once more |
| `FORMS_ENDPOINT` | empty | the forms Worker's `/lead` address; a lead goes there as source `prime`. Empty keeps leads in this Worker's KV under `lead:` |
| `LOG_TTL_DAYS` | `30` | how long a telemetry record lives |

The cost of an answer is xAI's own figure, `cost_in_usd_ticks` on the usage
block, so the counter is what the invoice will say. The price table in
`src/xai.js` is only the fallback for a response that carries no figure.

Reading the telemetry, with the admin code:

```sh
curl 'https://metrale-prime.<account>.workers.dev/stats?code=<PRIME_ADMIN_CODE>&days=7'
```

It answers with, per day: answers, failures, dollars, tokens, the p50 and p95
of time to first token and of total time, and the audiences; plus the same by
model and effort, and how often each tool ran. No record holds a question or
an answer. `wrangler kv key list --binding PRIME --prefix log:` lists the raw
records.

## Secrets, and how CI gets them

Three secrets, and the Worker reads them from Cloudflare's secret store only:

| secret | what it is |
| --- | --- |
| `XAI_API_KEY` | the model key. Use a company key made at console.x.ai with a monthly spending limit set there, not a person's own key |
| `PRIME_PARTNER_CODE` | the code that opens the partner tier (the deck, the plan, the architecture brief). Anyone who has it can read those documents through the guide, so treat it like the documents |
| `PRIME_ADMIN_CODE` | opens `/stats` |

**How the key was held while this was built (2026-09-21).** In `.dev.vars` in
this directory, which `.gitignore` here excludes (`git check-ignore` confirms
it) and which `wrangler dev` reads. It was never in a tracked file, a commit, a
log or a test fixture: the tests fake the model and the KV, and the browser
tests answer for the Worker with a stub. The key that ran the trials was a
founder's personal key; production gets its own.

**How it was tested.** `TRIALS.md`: sixteen questions across the audiences on
grok-4.7 at low effort, a re-run of the four that had exposed a fault, and the
same five questions on 4.7 low, medium and high and on 4.3 low, about $0.90
in total, all through `scripts/prime/trial.mjs` against `wrangler dev` on this
machine. The Worker's request loop, the knowledge base builder and the page's
renderer have unit tests that spend nothing (`bun test` in `site/`), and the
browser suite exercises the whole page against a stubbed stream.

**Production, by hand.** Step 2 of "Set it up" above: `wrangler secret put`
for each of the three, from a shell that has the value. Nothing else needs
to change; the Worker reads the secret on its next request.

**Production, from CI.** `.github/workflows/prime-worker.yml`. Put the three
values in the repository's secrets beside the two Cloudflare ones the site's
deploy already uses, and set the repository variable `PRIME_WORKER_URL` to the
Worker's address. A push to `main` that touches this Worker's code deploys it
and rewrites every secret the repository holds a value for; "Run workflow"
also re-cuts the public knowledge base from a fresh site build, and, if you
tick it, spends one real question on the deployed Worker and fails if the
stream does not finish or the answer costs more than ten cents. The partner
tier's documents are not in the repository and are uploaded by hand
(`--private <dir> --upload --remote`).

**Rotation.** Make a new key at xAI, put it in the repository's secrets, run
the workflow (or `wrangler secret put` by hand), then revoke the old key. The
Worker never caches a key. Set the daily budget (`PRIME_DAILY_BUDGET_USD`)
and xAI's own monthly limit so a leaked key cannot spend more than a day's
worth before `/stats` shows it.

## The partner tier

The base has two tiers. The public tier is everything a visitor may see. The
partner tier is built from documents that are not in this repository (the
deck, the plan), given to the builder with `--private <dir>`, and answers only
for a visitor who typed the partner code into the panel. Without the code the
model is told it has no fundraising terms, valuation, revenue or customer
names, and to offer the CEO instead. The code is a Worker secret; give it to
whoever should read those documents, and change it to close the door.

This is a gate on the knowledge base, not a security boundary: the code is
typed into a public page. Do not put anything in the partner tier that would
hurt if the code leaked.

## Try it on your own machine

Two terminals. Everything stays on this machine except the calls to xAI.

```sh
# here: the secrets, then the Worker in Cloudflare's own runtime
cp .dev.vars.example .dev.vars    # fill in XAI_API_KEY (git ignores this file)
npx wrangler@4 dev --port 8787

# in site/: the knowledge base into the local KV, then the site pointed at it
node scripts/prime/corpus.mjs --upload
VITE_PRIME_ENDPOINT=http://127.0.0.1:8787 bun x --bun vite dev
```

`scripts/prime/trial.mjs` asks the running Worker a fixed set of sixteen
questions across the four audiences (including a refusal, an intake in two
turns, and a prompt injection) and writes the answers with their receipts to a
scratch directory. It stops at `--budget` dollars. Use it to choose a model and
an effort, and to read the answers before a change ships:

```sh
node scripts/prime/trial.mjs --worker http://127.0.0.1:8787 --out ~/scratch/trial --label 4.7-low --budget 0.5
```

To try another model or effort, start `wrangler dev` with overrides:
`npx wrangler@4 dev --port 8787 --var PRIME_MODEL:grok-4.3 --var PRIME_EFFORT:low`.

## What the trials found

See `TRIALS.md` beside this file for the numbers from the trial that chose the
defaults, and how to rerun it.

## Options that were weighed

| option | for | against | verdict |
| --- | --- | --- | --- |
| **A Worker holding the key** (this) | The key never reaches a page. One place for the budget, the rate, the telemetry and the knowledge base. Deployed apart from the site, like the forms Worker, so it cannot take a page down. | One more deploy, and the base has to be re-cut after a copy change. | Chosen. |
| Calling xAI from the browser | No server at all. | The key would be in every visitor's browser, and a key with a budget behind it cannot be. The developer pages' "Ask the codebase" does this only because the visitor brings their own key. | Never. |
| A vector index (Cloudflare Vectorize and a Workers AI embedder) | Better recall on long, vague questions. | Two more resources to create and keep in step with the base, and an embedding call before every search. The base is a few hundred passages about one company; BM25 with the brand's synonyms finds them, and the model searches again in its own words when the first pass is thin. | Not yet. `search()` in `src/corpus.js` is the only contract; swap it when the base outgrows lexical search. |
| A Pages Function inside the site | Same origin, no CORS. | The site is a Direct Upload project fed by CI. Functions would have to enter that deploy path, and a bad `_worker.js` stands in front of every page. The forms Worker faced the same choice. | No. |
| A hosted chatbot product | Nothing to run. | The answers would not be cut from the site, the receipts would not be xAI's, and the visitor's questions would sit with a third party. | No. |
| OpenRouter instead of xAI direct | One key for many models. | A second party between the site and the model, and no `cost_in_usd_ticks`. | Not now. `src/xai.js` is the one file to change. |
