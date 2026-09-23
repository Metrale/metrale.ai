# Metrale documentation: a proposed outline

Written 2026-09-23 for the team to decide on. Nothing here is built. The book
published today at `docs.metrale.ai` is the engine's, organised around the
engine's internals (getting started, architecture, the crates, kernels,
quantization, models, benchmarks, contributing). That is the right shape for a
contributor and the wrong first page for everyone else: an operator who has a
fleet, a buyer who has a question about cost, a developer who wants a request
to work in ten minutes. This outline starts from those readers and folds the
book in where it belongs.

## The shape

Seven parts. The first is short and the reader picks a path from it; the rest
are homes for what exists and what has to be written.

### 1. Start here

- What Metrale is, in one page: the engine, the control plane and the economics
  layer, one request path. (New; the site's platform page says it.)
- Pick your path: I want to run a model on my machine · I run a fleet · I am
  deciding whether to buy · I want to contribute. (New; four links.)
- Install: the one-liner, what it does, how to verify the download. (From the
  book's Installation and the site's developer page.)
- First request: serve a model, call the OpenAI-compatible API, read the
  receipt. (From the book's Quickstart.)
- The Console, in one screen. (New; the site's film shows it.)

### 2. Metrale Engine

The book, as it is, under one heading. Its parts stay in its order:
philosophy, installation, quickstart, supported models, troubleshooting;
architecture (AI kernel hypercompiling, workspace, dispatch, SBIO); the
crates; kernels and quantization; benchmarks and the ladder; contributing.
Two additions: a page that says what "certified" means for a benchmark (the
site's diligence deck already says it), and a page per hardware target that
lists what is measured on it and what is not.

### 3. Metrale Control

- The agent on your machine: what it is, what it listens on, what it will and
  will not do (the closed protocol, one hop, named refusals). (New; the site's
  `agent/` modules document the rules in their headers.)
- Pairing and trust: the two-phase exchange, controller grants, unpairing.
- The fleet: discovery, the roster, topology, what a node reports.
- Recipes: signed, what a recipe declares, how one is chosen for a node.
- Launching a cluster: the phases, what can fail where, and how to read it.
- Logs and telemetry: what is kept, for how long, what never leaves.
- The inference endpoint through the agent, node selection, enterprise mode.
  (Planned; `site/ECOSYSTEM.md` phases 2 and 3.)

### 4. Metrale Economics

- Cost per workload: what is measured, how the number is formed. (From the
  site's economics page and the payback calculator's notes.)
- Chargeback and metering: the metering block on the pricing page, as a spec.
- Stranded capacity and payback: the arithmetic, worked on one fleet.
- Tokens per joule and the other measured figures: what makes a figure
  MEASURED rather than proposed. (The site's why page has the rule.)

### 5. Deploy

- The three owners: your GPUs, a regulated estate, the public sector; what
  differs for each. (From the site's deployment page.)
- Air-gapped: install from media, run isolated, export telemetry on your
  schedule or never.
- Kubernetes: in the customer's account and in ours.
- Hardware: what is on the bench, what is next, what is measured on each.

### 6. Reference

- `atlasctl` and the engine's commands, every flag. (New as a single page;
  today they are spread through the book.)
- Configuration files and environment.
- The OpenAI-compatible API, with the extensions.
- The agent protocol, version by version.
- The recipe format.
- The API reference (rustdoc), where the engine publishes it.

### 7. Records

- The ladder, the gates and the changelog, as the site publishes them, with
  the reproduction steps beside each. (From the site's diligence deck and
  benchmarks page.)

## Where the book's chapters go

| the book today | proposed home |
| --- | --- |
| Part I, Getting Started | 1. Start here (installation, first request, models, troubleshooting) |
| Part II, Architecture | 2. Metrale Engine |
| Part III, The Crates | 2. Metrale Engine |
| kernels, quantization, models | 2. Metrale Engine |
| benchmarks and the ladder | 7. Records, with the method in 2 |
| contributing | 2. Metrale Engine, last |

Nothing is dropped. Chapters that are engine internals keep their words and
their order; the change is the front door and the four parts around them.

## What has to be written

Most of parts 3 to 6 does not exist as documentation yet. Their sources do:
the module headers under `site/src/lib/agent/`, the site's platform and
economics pages, the pricing page's metering block, the deployment page's
owners table, `site/ECOSYSTEM.md` for what is planned. A first pass could be
cut from those the way the guide's knowledge base is cut from the built site.

## Decisions for the team

1. One site or two: the book stays a book at `docs.metrale.ai/engine/` with the
   new parts around it, or the whole outline is one mdBook with the engine's
   chapters pulled in at build time (which is what `docs/build.mjs` already
   knows how to do for the book alone).
2. Who owns parts 3 and 4: the engine team writes the agent's pages, or the site
   team drafts them from the module headers for the engine team to correct.
3. Naming in the reference: the commands are still `atlasctl` and `atlas`, and
   the docs should say so plainly until the engine renames them.
4. When: after the engine's repository move, so the outline is built once,
   under the final names.
