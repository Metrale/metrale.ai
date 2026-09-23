# The trial that chose the model

Run on 2026-09-21 against `wrangler dev` on one machine, with the knowledge base
cut from the site at commit `c55767fcb`, using `scripts/prime/trial.mjs`. The
questions are the script's fixed set: measured performance, the payback model,
air gapped deployment, the team, a fundraising question with and without the
partner code, install, gates, one paragraph, the January story, a where-is
question, a two turn intake, the releases, a prompt injection, an off topic
request, and a pricing table. Every number below is what the Worker reported
on the stream: xAI's own cost in dollars, and the timings as the Worker
measured them.

## Four configurations, the same five questions

Cases 1, 4, 7, 9 and 16: the ladder, the team, the install, the one paragraph,
the pricing table. Medians unless stated.

| configuration | first token | first answer token | total | slowest | thinking tokens | tools | words | citations | per answer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **grok-4.7, low** | 0.8 s | 4.7 s | 8.7 s | 11.5 s | 284 | 3.2 | 160 | 3.6 | $0.027 |
| grok-4.7, medium | 0.9 s | 6.7 s | 11.2 s | 35.9 s | 741 | 3.6 | 179 | 3.8 | $0.024 |
| grok-4.7, high | 0.8 s | 12.2 s | 16.9 s | 55.5 s | 1501 | 4.0 | 202 | 4.0 | $0.035 |
| grok-4.3, low | 2.1 s | 4.1 s | 5.4 s | 7.4 s | 489 | 1.2 | 97 | 1.8 | $0.0075 |

What the answers were like:

- **4.7 at low** answers in the site's voice, labels measured against modeled
  against proposed without being told twice, cites three or four passages,
  and calls the right tool (the ladder for the ladder, the payback model for
  the payback model). The first token is the model's own thinking, which the
  page shows, so the visitor sees work at once.
- **Medium and high** think longer and write longer, and the extra thinking
  did not change what they said. The slowest answers at high took most of a
  minute. Not worth it for a guide.
- **4.3 at low** is a quarter of the price and the fastest to finish, but it
  searches once, cites less, and answers in half the words. It has no thinking
  stream, so its first token is the answer itself, two seconds in. It is the
  right economy setting if the budget ever matters more than the depth.

The defaults in `wrangler.toml` are grok-4.7 at low.

## The full set on 4.7 low

Sixteen cases, seventeen answers, no errors, $0.37. Medians: first token 0.8 s,
first answer token 4.1 s, total 6.4 s. One answer stalled on xAI's side for
almost a minute before its first token; that is why the Worker now drops a
stream that sends nothing for twenty seconds and asks once more
(`PRIME_FIRST_TOKEN_TIMEOUT_MS`).

What the set found and what changed because of it:

- The team answer searched six times, once per name, and missed a person,
  because each card was its own tiny passage under a heading that never said
  "team" (the word is an eyebrow above the heading). The builder now folds an
  eyebrow into its heading and merges small sub sections into their parent,
  and an answer gets four searches.
- The model read `site/FACELIFT.md`, the document about how the site was made,
  and went looking for a person it names. That document is no longer a source.
- The intake sent the lead on the turn the details arrived in. The tool now
  refuses on that turn, so the details are read back and confirmed first.
- An off topic request (a poem) was answered. The rules now say to decline in
  a sentence and offer what the guide can help with.
- A prompt injection was refused without any rule aimed at it.
- Structured tools (the ladder, the payback model, the repository) carried no
  citation number, so those answers had no sources. They register one now.
- Every question cost a full extra model round, because retrieval happened only
  after the model asked for it. The Worker now searches the visitor's message
  before the first call and hands the passages in, numbered; plain questions
  finish in one round and the first token moved from two to eight seconds down
  to under one.

## Rerunning it

```sh
cd deploy/cloudflare/prime-worker && npx wrangler@4 dev --port 8787
cd ../../.. && node scripts/prime/trial.mjs --worker http://127.0.0.1:8787 --out ~/scratch/trial --label 4.7-low --budget 0.5
```

`--only 1,4,7,9,16` is the comparison subset; `--var PRIME_MODEL:... --var PRIME_EFFORT:...`
on `wrangler dev` tries another configuration. The trial's transcripts are not
in the repository: they are the model's words about the company on a given
day, read once and kept out of a public tree.
