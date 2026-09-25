# The loopback foundation

A plan for the control plane's chat, the corpus that keeps it current, the
agent's inference endpoint, and the apps that can be built on the same
loopback. Written 2026-09-23 for the team, from what is in this repository
and the engine's. Nothing here is decided until the questions at the end are
answered; the phases are in the order the dependencies fall, not in the order
of ambition.

## What is already there

Three pieces exist and work. The plan builds on them rather than beside them.

**The agent.** The installed command's agent listens on `127.0.0.1:34333`, loopback only,
so no firewall applies to it. The page reaches it over a WebSocket and the
wire contract is protocol 2 (`site/src/lib/agent/protocol.js`, mirroring the
agent's protocol crate; the registry's `metralectl` speaks 4): a closed set of message types, no raw command
verb, no relay of opaque bytes, and one scoped exception, the seven control
verbs that may carry an `on` target for one hop toward a machine the agent
has pinned and that has granted control. Pairing is two phase (exchange, then
confirm or reject). The agent already has discovery, telemetry, a launcher,
logs, sessions and a token model. The page for it, `/control`, is prerendered
with no fleet data in it, probes the agent after hydration, and becomes the
bridge when one answers. The rules (row order, hotkeys, refusals with a name
on them, the session action log) live in plain modules with tests.

**Ask the codebase.** The engine repository's `coderag.yml` cuts the code into
chunks, embeds them, and publishes a corpus to GitHub Pages: on the last run,
5,831 points over 1,942 files at 2,048 dimensions, 286 MB as JSONL and 98 MB
gzipped, with a manifest that names the commit, the model and the checksum.
The run is already incremental; that manifest records 14 chunks embedded and
5,817 reused. In the browser, a vendored LatticeDB wasm build (763 KB, loaded
only when the chat opens) indexes the corpus, the decompressed file is cached
in the origin's private file system keyed by commit, and retrieval is embed,
vector search, rerank, then chat, all through OpenRouter with the visitor's
own key and the free Nemotron models (`site/src/lib/chat/config.js`). The
answer model can be swapped; the retrieval models cannot, because the corpus
vectors were made with one embedder. Answers cite the chunks they used.

**Metrale Prime.** The site's guide. A Cloudflare Worker with a BM25 index
over the built pages and, for partners, over documents that never enter the
repository; the model is xAI's, the key is the company's, and the Worker
enforces a daily budget. It is separate from the control plane's chat on
purpose: different corpus, different key holder, different audience.

## What is being asked for

1. **A live corpus.** An embedder that puts everything into LatticeDB, writes
   it out as JSON, and refreshes on a short cadence, about every five minutes,
   so the chat answers from the current state and not from a snapshot.
2. **Citations that land on lines.** Every claim cites, and the citation opens
   the code at the lines, not the file.
3. **A chat that any app can carry.** One self-contained chat unit, the same
   in the harness as on the site, instead of a chat per app.
4. **An enterprise posture.** A mode in which the chat and the page connect
   to a Metrale control agent and nothing else: no third-party model endpoint,
   no key that leaves the perimeter.
5. **Inference through the agent.** The agent exposes an OpenAI-compatible
   endpoint; from the control plane an operator selects a node and uses it for
   inference in real time, to test it.
6. **Apps without an app store.** A name that resolves to the loopback and a
   certificate for it, so a web page, installed as a PWA or not, can reach the
   machine over a secure WebSocket; the harness is the first such app, and
   others can be built on the same foundation.

Prime stays separate for now. The last phase says how the two meet.

## Principles to carry across

These come from the code that exists and should survive everything below.

- **Closed verbs, no open proxy.** New capabilities are new message types in
  the closed enum, each with a name and a test, never a passthrough. The agent
  stays something a page can talk to, not something a page can drive.
- **Nothing leaves the machine unless the operator says so.** The page ships
  with no fleet data. A model endpoint outside the perimeter is opt-in, by a
  key the visitor pastes. Enterprise mode makes the opt-in impossible.
- **Cite or say nothing.** An answer without a source is an opinion; the chat
  either shows where a claim came from or says it does not know.
- **One contract per boundary, written down first.** Corpus, citation, verb,
  manifest. The pieces can then be built and tested apart, which is how the
  agent modules are built today.
- **Plain modules, tested.** Rules live in `.js` files that the unit runner
  can import; components render what the rules decide. The browser suite
  proves the assembly against a fake agent, never against a network.

## The contracts

The interfaces to fix before the building starts. Shapes are illustrative;
the field names are proposals.

### Corpus manifest

Extends the manifest `coderag.yml` already writes.

```json
{
  "format": "lattice-jsonl",
  "version": 2,
  "tier": "code",
  "source": { "repo": "Metrale/metrale-inference-alpha", "commit": "2988586", "ref": "main" },
  "model": "nvidia/llama-nemotron-embed-vl-1b-v2:free",
  "dim": 2048,
  "points": 5831,
  "generated_at": "2026-09-23T18:00:00Z",
  "cadence_s": 300,
  "full": { "url": ".../metrale-coderag.jsonl.gz", "sha256": "…", "gz_bytes": 98625375 },
  "delta": { "since": "5f1c2e9", "url": ".../metrale-coderag.delta.jsonl.gz", "removed": ["…"] },
  "cite": "https://github.com/Metrale/metrale-inference-alpha/blob/{commit}/{path}#L{start}-L{end}",
  "license": "AGPL-3.0-only"
}
```

`tier` names what the corpus covers (`code`, `docs`, `site`, `records`,
`fleet`). `delta` is what makes a five-minute cadence affordable: a browser
that holds the previous commit fetches the difference, not 98 MB. `cite` is
the template every citation from this corpus resolves through.

### Chunk record

One line of the JSONL.

```json
{ "id": "crates/metrale-core/src/scheduler.rs#L120-L168@2988586", "path": "crates/metrale-core/src/scheduler.rs",
  "lang": "rust", "start": 120, "end": 168, "sha": "…", "text": "…", "vector": [ … ] }
```

The id carries the path, the lines and the commit, so a citation can be
formed from the id alone and a stale id says which commit it belongs to.

### Citation record

The one shape both chats produce, so a panel that renders citations renders
either.

```json
{ "id": "…", "title": "scheduler.rs, lines 120 to 168", "url": "https://github.com/…#L120-L168",
  "tier": "code", "score": 0.12, "quote": "the first sentence of the chunk" }
```

For the fleet tier, `url` is a route inside the control plane
(`/control#node=dgx3&log=…`), so a claim about a machine opens the panel
that shows it.

### Agent verbs (additions to the closed enum)

- `index_status` → `{ tier, points, built_at, cadence_s, embedder }` for each
  index the agent holds.
- `index_search { tier, query, k }` → `[chunk id, score, text]`, retrieval on
  the machine, for the fleet tier that never leaves it.
- `infer_target { node }` → the agent points its inference endpoint at that
  node, or refuses with the same named refusal shape the control verbs use.

Each is a control verb: it may carry `on`, one hop, under the same grant.

### The inference endpoint

`http://127.0.0.1:34333/v1/chat/completions` and `/v1/models`, the
OpenAI-compatible surface, served by the agent and forwarded to the selected
node's engine. It takes the same origin allowlist and the same pairing token
as the WebSocket, so a page that may not talk to the agent may not use its
inference either. `/v1/models` lists the fleet's loaded models with the node
each one is on.

### App manifest and grants

```json
{ "name": "Metrale harness", "origin": "https://harness.example", "version": "1.2.0",
  "verbs": ["index_search", "infer_target", "status"], "signature": "…" }
```

An app is an origin plus the verbs it asks for. The operator grants them the
way a peer is paired today: shown the request, then confirm or reject, and
the grant is a pin the agent keeps. Signatures use the same signing the
recipes use, so a manifest can be checked before it is shown.

### Model source

The chat has one setting for where answers come from, and every app sees the
same three values: `openrouter` (the visitor's key, the free models),
`agent` (the endpoint above), `none` (retrieval only, the chunks shown as
they are, which is a fine answer for a code question). Enterprise builds
offer `agent` and `none`.

## Phases

### Phase 0: housekeeping

Small, and it clears the ground.

- Citations that open a file should open the lines. The chunk id has them; the
  renderer should form the `#L{start}-L{end}` anchor from the id and the
  manifest's `cite` template rather than linking the path.
- Publish the corpus manifest at version 2 with `cite` and `tier`, without
  changing the corpus itself, so the browser can start reading the template.

### Phase 1: the live corpus

Two tiers, because "everything" is two different things with two different
homes.

**The static tiers** (`code`, `docs`, `site`, `records`) are public and
change with commits. `coderag.yml` already embeds incrementally; the work is
to run it on a schedule as well as on push, to write a delta beside the full
file, and to add the other sources (the site's built pages are already cut
for Prime by `scripts/prime/corpus.mjs`; the docs and the campaign records
can be cut the same way). Five minutes is the ceiling GitHub allows for a
schedule and it is best effort; a push trigger plus a schedule gives "current
within minutes" honestly. In the browser, the chat checks the manifest,
fetches the delta when it has the previous commit and the full file when it
does not, and writes the points into the wasm collection; the OPFS file is rewritten by
commit as it is today.

**The fleet tier** is the state of this operator's machines: nodes, loaded
models, recipes, launch logs, telemetry. It never leaves the machine, so it
is embedded on the machine. The agent holds a LatticeDB collection of its own
and refreshes it on the cadence (five minutes, or on the events it already
sees); the embedder is a small model the engine runs locally, so no key is
needed and nothing is sent anywhere. The page reaches it through
`index_search`, and a citation from this tier opens the control plane panel.
Retrieval merges the tiers: the question is embedded once (locally when the
agent is present, through OpenRouter otherwise), each tier returns its top
candidates, the reranker orders the union.

What "JSON" means here: the static tiers are the published JSONL and its
manifest; the fleet tier is a snapshot the agent writes beside its index
(`fleet-index.json`: what is indexed, from when, with ids), which is what a
page shows in an "index status" panel and what an app can read to know what
it can ask about.

Deliverables: `coderag.yml` on a schedule with deltas; a `records` and
`docs` cut; manifest v2; the browser's delta path; agent `index_status` and
`index_search`; the local embedder in the engine; citations to lines and to
panels; tests for the merge and for the delta apply.

### Phase 2: inference through the agent

- The agent serves `/v1/chat/completions` and `/v1/models` on the loopback,
  forwarded to the selected node's engine, under the WebSocket's allowlist
  and token.
- `infer_target` selects the node from the control plane; the bridge gets a
  "use this node" action beside the seven verbs, with the same named refusal
  when the node has not granted control.
- The chat's model source gains `agent`. The same chat, the same citations,
  answered by the fleet.
- Enterprise mode is a build flag on the page (`VITE_MODEL_SOURCES=agent,none`)
  and a policy in the agent (refuse to forward to any origin but the pinned
  page's). Two layers, because a page can be rebuilt and an agent cannot be
  talked around.

Deliverables: the endpoint, the verb, the action, the flag, the policy, and a
browser test that proves enterprise mode has no path to a third-party
endpoint.

### Phase 3: the foundation for apps

**Naming and certificates.** A page served from `https://` may open
`ws://127.0.0.1` today because browsers treat the loopback as secure; that is
why `/control` works without a certificate. It stops working the moment the
agent is on another machine on the LAN, or the app is a PWA that wants a
name. The pattern that works is a name per install under a domain the company
controls, resolving to the machine's address (A and AAAA records, including
the loopback ones), with a certificate for that name issued through DNS
validation and handed to the agent, which serves `wss://` on it. The agent
already has an identity and a token; the certificate is one more thing it
keeps. This is infrastructure the company runs (a zone, an issuer, a small
registration service) and it is the one piece of this plan that is not code
in these repositories.

**Apps.** With a name and a secure socket, an app is a web page: it declares a
manifest, the operator grants it verbs, and it talks to the agent through the
same client the control plane uses. The client modules under
`site/src/lib/agent/` become a package (`@metrale/agent`, or whatever the
name is) with the protocol, the pairing readers, the refusals and the action
log, so an app gets the doctrine with the code. The chat becomes a component
in the same package, carrying the citation renderer and the model source
setting.

**The harness first.** The team's own harness is the first app on the
foundation: it consumes the package, declares a manifest, and its chat is the
shared one. What it needs that the package lacks is the backlog for the
package.

Deliverables: the naming and certificate service; `wss://` in the agent; the
manifest and grant flow (protocol 3, since the enum grows); the package; the
harness on it; a second, small example app that proves the package is enough.

### Phase 4: where Prime meets the control chat

They stay separate until the contracts above exist. Then two things become
possible without merging them:

- Prime's site corpus becomes one more static tier (`site`), cut by the same
  script, published with the same manifest, so the control chat can answer a
  question about the product and cite the page.
- Prime renders citations through the shared citation record, so a Prime
  answer and a control chat answer look and behave the same.

Whether Prime itself should ever run on the fleet instead of xAI is a
question of who is asking: the site's visitor has no fleet. Leave it.

## Security and privacy, by phase

| phase | what could go wrong | what holds it |
| --- | --- | --- |
| 1 | fleet data leaks through the corpus | the fleet tier is embedded and searched on the machine; nothing about a fleet is ever in a published file |
| 1 | a stale corpus cites lines that moved | ids carry the commit; a citation to another commit says so and links to that commit |
| 2 | a page uses the fleet for inference it should not | the endpoint sits under the same allowlist and token as the socket; enterprise policy in the agent, not only the page |
| 2 | a runaway client spends a node's time | per-origin rate limits in the agent, as Prime has per address |
| 3 | an app asks for more than it needs | grants are per verb, shown before confirmation, revocable like a pin |
| 3 | a certificate for a loopback name is abused elsewhere | one name per install, the private key never leaves the agent, short lifetimes, revocation at the issuer |
| all | a key pasted into a page leaks | it stays in the page's storage as today; enterprise builds have nowhere to paste one |

## Costs and limits

- The free models on OpenRouter have a daily allowance per key; the chat
  already tells the visitor when it is spent rather than retrying. The agent
  path has no such limit, which is one reason to build it.
- The full corpus is 98 MB gzipped. The delta path is what makes a short
  cadence usable; without it, five minutes would mean 98 MB per refresh for
  every open tab.
- A five-minute schedule in CI runs 288 times a day. With reuse it embeds
  only what changed and most runs embed nothing; the cost is the runner
  minutes, not the model.
- The local embedder on a node costs GPU time on the operator's own machine,
  on the cadence, over a small index. Measure it in phase 1 and put the
  number in the manifest's `index_status`.

## Open questions

1. What is "everything" for the static tiers: the engine's code and docs, the
   recipes, the site, the campaign records, the blog? Each is a cut to write.
2. Where should the embedder for the static tiers run: CI only, or also the
   agent, so an air-gapped fleet can cut its own code corpus?
3. Is enterprise mode a separate build of the page, a flag at deploy, or a
   policy the agent announces on connect so one page serves both?
4. The name under which installs get their loopback names, and who runs the
   issuer.
5. Which embedding model the engine should run locally for the fleet tier,
   and whether the static tiers should move to it too, so one embedder serves
   both and the retrieval models stop depending on a third party.
6. The harness: its current shape, what it already asks the agent for, and
   what it would need from the package on day one.
7. Protocol 3's scope: manifests and grants only, or also the index and
   inference verbs, so that pages and agents move in one step.

## What to do first

1. Write the four contracts as JSON schemas beside `protocol.js` and
   `chat/config.js`, with a test that the current corpus manifest validates
   against version 2 once the two fields are added.
2. Land phase 0 in this repository and the manifest change in the engine's.
3. Prototype the delta path in the browser against a hand-made delta, before
   the workflow produces one.
4. Answer questions 1, 2 and 5 with the engine team; they decide the shape of
   phase 1.
