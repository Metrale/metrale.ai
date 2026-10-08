// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// tools.js — what Metrale Prime can do besides talk.
// -----------------------------------------------------------------------------
// Each tool is a JSON schema the model sees and a function the Worker runs. A
// tool returns plain data; the model writes the sentence. The eight here are
// the scaffold of a multi function assistant, one per job:
//
//   search_site         information: the site, the docs, the blog, the history
//   get_benchmark       measured numbers: every published ladder against vLLM
//   get_coverage        which models have run on which hardware, and the evidence
//   estimate_economics  the payback model, the same functions the pricing page runs
//   list_pages          direction: where on the site a thing is
//   next_steps          planning: what to do next, by who is asking
//   repo_activity       the repository's releases, commits, pull requests, people
//   capture_lead        intake: a visitor who wants a person to follow up
//
// `data` is the structured half of the knowledge base (pages, the ladders, the
// hardware account, the history, links), written by scripts/prime/corpus.mjs
// next to the documents.
// =============================================================================

import {
  fleetModel,
  apiModel,
  energyModel,
  energyInputsFrom,
  FLEET_DEFAULTS,
  API_DEFAULTS,
  ENERGY_DEFAULTS,
} from '../../../../src/lib/economics.js';
import { ENGINE_REPO } from '../../../../../web-shared/sources.mjs';

const MAX_RESULT_CHARS = 7000;

export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_site',
      description:
        'Search everything Metrale has published: the pages of this website, the engine documentation in the repository, the record of which models have run on which hardware, the blog, and the repository history. Returns numbered passages to cite as [n]. Search again with different words if the first results are thin.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to look for, in plain words. Five to twelve words works best.' },
          kinds: {
            type: 'array',
            items: { type: 'string', enum: ['page', 'doc', 'record', 'post', 'history', 'deck', 'plan'] },
            description: 'Narrow to a kind of source. Omit to search everything the visitor may see.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_benchmark',
      description:
        'The published concurrency ladders, one per checkpoint: Metrale Engine against the matched vLLM configuration on the same box, every rung, with the workload and the link to the results log. Name a model to get its ladder only.',
      parameters: {
        type: 'object',
        properties: { model: { type: 'string', description: 'Optional. A model or checkpoint in plain words, for example Qwen3.6 35B.' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_coverage',
      description:
        "Which models have run on which hardware, and what evidence says so, strongest first: signed gate records by hardware and checkpoint, the published ladders against vLLM, the launch recipes and the hardware they run on, and the kernel sets the engine builds for each hardware target with the site's own status for it. Leave both filters out for the overview, or name a hardware or a model for its detail: the gates, the record links, the recipe ids and the documents about a target.",
      parameters: {
        type: 'object',
        properties: {
          hardware: {
            type: 'string',
            description: 'A GPU, box or target in plain words, for example GB10, DGX Spark, H100, B200, Strix Halo, Apple.',
          },
          model: { type: 'string', description: 'A model or checkpoint in plain words, for example Qwen3.6 35B, Gemma 4, DeepSeek V4.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'estimate_economics',
      description:
        'Run the payback model from the pricing page. Three scenarios: "fleet" (get more out of GPUs you own), "api" (replace a metered API bill with boxes you own), "energy" (tokens per joule). Any input left out takes the page default. Results are modeled, not measured, and must be labelled that way. The license inputs (licensePerGpuYear, licensePerBoxMonth) come only from a quote the visitor has: Metrale publishes no price, so leave them out unless the visitor gives one. Without them the result is before the license and the fleet scenario names no payback period.',
      parameters: {
        type: 'object',
        properties: {
          scenario: { type: 'string', enum: ['fleet', 'api', 'energy'] },
          inputs: {
            type: 'object',
            description:
              'Overrides. fleet: gpus, gpuCostPerYear, utilization, uplift, licensePerGpuYear, wattsPerGpu, pue, usdPerKwh, replacedSoftwarePerGpuYear. api: monthlySpend, usdPerMillionTokens, boxTokensPerSecond, boxCapex, amortMonths, utilization, wattsPerBox, pue, usdPerKwh, licensePerBoxMonth. energy: tokensPerSecond, baselineTokensPerSecond, watts, baselineWatts, pue, usdPerKwh, millionTokensPerMonth.',
            additionalProperties: { type: 'number' },
          },
        },
        required: ['scenario'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_pages',
      description:
        'The map of this website: every page with its path, title and one line description. Use it to point the visitor at the right page.',
      parameters: { type: 'object', properties: { query: { type: 'string', description: 'Optional words to filter by.' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'next_steps',
      description:
        'What a visitor can do next, with links: a working session on their workload, a scoped pilot, the release notes, the deck on request, the open source engine, the contributing guide, the contact paths. Pick by who is asking.',
      parameters: {
        type: 'object',
        properties: { audience: { type: 'string', enum: ['infra', 'investor', 'contributor', 'curious'] } },
        required: ['audience'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'repo_activity',
      description:
        'The public repository as of the knowledge base build: a summary (stars, forks, license, contributors), the latest releases, the latest commits, the latest merged pull requests, or the contributors by commit count.',
      parameters: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['summary', 'releases', 'commits', 'pulls', 'contributors'] },
          limit: { type: 'integer', minimum: 1, maximum: 40 },
        },
        required: ['kind'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'capture_lead',
      description:
        "Send the visitor's details to the Metrale team so a person follows up. Only after the visitor has given their name and email and agreed to be contacted. Never call it twice in one conversation.",
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          company: { type: 'string' },
          interest: {
            type: 'string',
            description: 'What they want: a working session, a pilot, the deck, partnership, hiring, press, something else.',
          },
          notes: { type: 'string', description: 'Anything else they said that the team should know: hardware, workload, timing.' },
        },
        required: ['name', 'email', 'interest'],
      },
    },
  },
];

const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/;
const clip = (s, n) => (String(s ?? '').length > n ? String(s).slice(0, n - 1) + '…' : String(s ?? ''));
const num = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
// A visitor's words against a checkpoint or a target: "Qwen3.6 35B" squashes to
// qwen3635b, which Qwen/Qwen3.6-35B-A3B-FP8 contains; "DGX Spark" is two words
// the GB10 target's names carry.
const squash = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
const wordsOf = (s) =>
  String(s ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1);

/** What each kind of evidence in get_coverage stands for, strongest first. */
const EVIDENCE = {
  signed_record:
    'A gate measured the checkpoint on that hardware, and the record is committed with its signature in the engine repository. The strongest evidence.',
  ladder: 'A published concurrency ladder: Metrale Engine against vLLM on the same box, with the same checkpoint and workload.',
  recipe: 'A launch recipe: one validated way to serve one checkpoint, with its image and serve settings. Not a benchmark record.',
  kernel_set: 'Kernels the engine builds for a hardware target. Code for that target, not a measurement.',
};

/** One published ladder as the model reads it. */
function ladderOut(l, n) {
  return {
    cite_as: n,
    label: l.label,
    title: l.title,
    subtitle: l.subtitle,
    checkpoint: l.checkpoint,
    aggregate: l.aggregate,
    workload: l.workload,
    box: l.box,
    against: l.against,
    generated_utc: l.generated_utc,
    rows: (l.rows ?? []).map((r) => ({
      concurrency: r.c,
      metrale_tok_s: r.engine,
      matched_baseline: r.baseline,
      matched_baseline_tok_s: r.baseline_tok_s,
      ratio: r.ratio,
    })),
    summary: l.summary,
    results_doc_url: l.results_doc_url,
  };
}

/**
 * One number per source for the whole answer. A passage found twice is cited
 * once, and a structured tool (the ladder, the payback model, the repository)
 * gets a number too, so the answer can cite where a figure came from.
 */
export function cite(ctx, src) {
  let entry = ctx.sources.find((s) => s.id === src.id);
  if (!entry) {
    entry = { n: ctx.sources.length + 1, ...src };
    ctx.sources.push(entry);
  }
  return entry.n;
}

/** Which audience gets which doors. Paths and links come from the knowledge base. */
function stepsFor(audience, data, site) {
  const p = (path) => `${site}${path}`;
  const routes = data.routes ?? {};
  const links = data.links ?? {};
  const contacts = data.contacts ?? {};
  const common = [
    { step: 'Read the three differences a buyer can test', url: p(routes.why ?? '/why-metrale') },
    { step: 'See the published ladder and reproduce it', url: p(routes.benchmarks ?? '/benchmarks') },
  ];
  const byAudience = {
    infra: [
      {
        step: 'Book a working session on your workload: the console on demo data, the ladder, and the payback model with your inputs',
        url: p(routes.demoForm ?? '/demo#book'),
      },
      {
        step: 'Scope a four week proof of value: one model, one hardware target, one workload, a side by side ladder in week one',
        url: p(routes.pricing ?? '/pricing'),
      },
      {
        step: 'Read how it deploys: hosted, your cloud account, on premises or air gapped',
        url: p(routes.deployment ?? '/platform/deployment'),
      },
      { step: 'Email sales and pilots', url: `mailto:${contacts.sales ?? ''}` },
    ],
    investor: [
      {
        step: 'Request the deck and the verification walkthrough from the team',
        url: `mailto:${contacts.press ?? ''}?subject=Metrale%20deck`,
      },
      { step: 'Read the story and meet the team', url: p(routes.company ?? '/company') },
      { step: 'Read the pricing model and the illustrative contract economics', url: p(routes.pricing ?? '/pricing') },
      { step: 'Walk the diligence page: every measured claim with its receipt', url: p(routes.diligence ?? '/diligence') },
    ],
    contributor: [
      { step: 'Install the open source engine and run a recipe', url: p(routes.openSource ?? '/engine') },
      { step: 'Read the contributing guide', url: links.contributing ?? '' },
      { step: 'Pick a good first issue', url: links.issues ? `${links.issues}?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22` : '' },
      { step: 'Join the Discord, which is also the test fleet', url: links.discord ?? '' },
      { step: 'Get the release notes', url: p(routes.waitlist ?? '/waitlist') },
    ],
    curious: [
      { step: 'Start with the platform overview', url: p(routes.platform ?? '/platform') },
      { step: 'Watch the one minute film on the demo page', url: p(routes.demo ?? '/demo') },
      { step: 'Read the blog', url: links.blog ?? '' },
    ],
  };
  return [...(byAudience[audience] ?? byAudience.curious), ...common].filter((s) => s.url);
}

/**
 * Run one tool. `ctx` carries the index, which tiers may answer, the structured
 * data, the environment, the site origin, the numbering of sources across the
 * whole answer, and the page the visitor is on.
 */
export async function runTool(name, rawArgs, ctx) {
  let args;
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { error: 'The arguments were not valid JSON.' };
  }
  const { index, tiers, data = {}, env = {}, site = '', page = '' } = ctx;

  switch (name) {
    case 'search_site': {
      const query = clip(args.query, 300);
      if (!query.trim()) return { error: 'A query is needed.' };
      // A bound on the round trips one answer can buy. Each search re-sends the
      // whole conversation to the model; six of them made one answer cost four
      // times the median in the trial.
      ctx.searches = (ctx.searches ?? 0) + 1;
      if (ctx.searches > (ctx.maxSearches ?? 4))
        return { error: 'The search limit for this answer is reached. Answer from the passages you have, and say what they do not cover.' };
      const kinds = Array.isArray(args.kinds) && args.kinds.length ? args.kinds : null;
      const hits = index.search(query, { k: 6, tiers, kinds });
      if (hits.length === 0)
        return { results: [], note: 'Nothing matched. Try other words, or say that the published material does not cover it.' };
      const results = [];
      let budget = MAX_RESULT_CHARS;
      for (const { doc } of hits) {
        const n = cite(ctx, {
          id: doc.id,
          title: doc.title,
          section: doc.section ?? '',
          url: doc.url ?? '',
          kind: doc.kind,
          tier: doc.tier,
        });
        const text = clip(doc.text, Math.min(1400, budget));
        budget -= text.length;
        results.push({ n, title: doc.title, section: doc.section ?? '', url: doc.url ?? '', kind: doc.kind, text });
        if (budget < 200) break;
      }
      return { results };
    }

    case 'get_benchmark': {
      const page = `${site}${data.routes?.benchmarks ?? '/benchmarks'}`;
      // Every published ladder, from the hardware account. A base cut before the
      // account existed carries the one ladder, and still answers.
      const all = data.coverage?.ladders?.length
        ? data.coverage.ladders
        : data.ladder
          ? [{ id: 'ladder', label: data.ladder.title, checkpoint: data.ladder.workload?.checkpoint ?? '', ...data.ladder }]
          : [];
      if (!all.length) return { error: 'The ladder is not in the knowledge base.' };
      const q = squash(args.model);
      const picked = q ? all.filter((l) => squash(`${l.checkpoint} ${l.label} ${l.id}`).includes(q)) : all;
      return {
        ladders: (picked.length ? picked : all).map((l) =>
          ladderOut(
            l,
            cite(ctx, {
              id: `tool:ladder:${l.id}`,
              title: 'The concurrency ladder',
              section: l.label,
              url: page,
              kind: 'page',
              tier: 'public',
            })
          )
        ),
        ...(q && !picked.length ? { no_match: 'No published ladder is for that model. These are all of them.' } : {}),
        page,
        note: 'Each ladder was measured on the box it names, with one checkpoint and one workload. The signed gate records behind the dashboard are measured too (get_coverage). A figure from the payback model is modeled.',
      };
    }

    case 'get_coverage': {
      const cov = data.coverage;
      if (!cov)
        return { error: 'The record of which models have run on which hardware is not in the knowledge base. Search the site instead.' };
      const routes = data.routes ?? {};
      const repo = cov.engine?.repo ?? ENGINE_REPO;
      // Three places a visitor can check, numbered only when the result uses them.
      const src = {
        records: () =>
          cite(ctx, {
            id: 'tool:coverage:records',
            title: 'The benchmark dashboard',
            section: 'every signed gate record, by hardware and model',
            url: `${site}${routes.benchmarks ?? '/benchmarks'}`,
            kind: 'record',
            tier: 'public',
          }),
        site: () =>
          cite(ctx, {
            id: 'tool:coverage:hardware',
            title: 'Hardware and models',
            section: 'verified silicon, targets in bring up, every recipe',
            url: `${site}${routes.hardware ?? '/platform/hardware'}`,
            kind: 'page',
            tier: 'public',
          }),
        engine: () =>
          cite(ctx, {
            id: 'tool:coverage:targets',
            title: 'Engine README',
            section: 'Other hardware targets',
            url: `${repo}/blob/main/README.md#other-hardware-targets`,
            kind: 'doc',
            tier: 'public',
          }),
      };
      const nameOf = (cls) => cov.targets.find((t) => t.dir === cls)?.name ?? cls;
      const targetCite = (t) => (t.site ? src.site() : src.engine());
      const ladderLine = (l) => ({
        cite_as: src.records(),
        checkpoint: l.checkpoint,
        hardware: l.box?.gpu ?? null,
        box: l.box?.name ?? null,
        against: l.against,
        rungs: `C=${l.rows?.[0]?.c} to C=${l.rows?.at(-1)?.c}`,
        ahead: l.summary ? `${l.summary.won} of ${l.summary.rungs} rungs, ${l.summary.min_ratio}x to ${l.summary.max_ratio}x` : null,
        results: l.results_doc_url,
      });
      const gatesOf = (m) => m.gates.map((g) => ({ name: g.name, records: g.records, last: g.last, newest_record: g.newest }));
      const hw = String(args.hardware ?? '').trim();
      const model = String(args.model ?? '').trim();
      const out = { evidence: EVIDENCE, engine_commit: cov.engine?.ref?.slice(0, 10) ?? null };

      if (!hw && !model) {
        const byCheckpoint = new Map();
        for (const r of cov.recipes) byCheckpoint.set(r.checkpoint, [...(byCheckpoint.get(r.checkpoint) ?? []), r]);
        return {
          ...out,
          measured: cov.measured.map((c) => ({
            cite_as: src.records(),
            hardware: nameOf(c.class),
            gpu: c.gpu,
            boxes: c.boxes.length,
            signed_records: c.records,
            from: c.first,
            to: c.last,
            checkpoints: c.models.map((m) => ({ checkpoint: m.checkpoint, records: m.records, gates: m.gates.map((g) => g.name) })),
          })),
          ladders: cov.ladders.map(ladderLine),
          recipes: {
            cite_as: src.site(),
            total: cov.recipes.length,
            checkpoints: byCheckpoint.size,
            by_engine: cov.recipes.reduce((a, r) => ({ ...a, [r.engine]: (a[r.engine] ?? 0) + 1 }), {}),
            by_hardware: cov.recipes.reduce(
              (a, r) => (r.hardware ? { ...a, [nameOf(r.hardware)]: (a[nameOf(r.hardware)] ?? 0) + 1 } : a),
              {}
            ),
            across_two_or_more_boxes: cov.recipes.filter((r) => r.nodes > 1).map((r) => r.id),
            not_metrale_engine: cov.recipes
              .filter((r) => r.engine !== 'Metrale Engine')
              .map((r) => `${r.checkpoint}, served by ${r.engine}`),
          },
          targets: cov.targets.map((t) => ({
            cite_as: targetCite(t),
            hardware: t.name,
            arch: t.arch,
            site_status: t.site?.status ?? null,
            signed_records: t.records,
            recipes: t.recipes,
            kernel_sets: t.models.length,
            models: t.models.map((m) => m.family),
          })),
          named_on_the_site_without_a_kernel_set: cov.site_only.map((c) => ({
            cite_as: src.site(),
            hardware: `${c.name} (${c.chip})`,
            site_status: c.status,
          })),
          readme: { cite_as: src.engine(), says: cov.note },
          detail: 'Call again with a hardware or a model for the gates, the record links, the recipe ids and the documents about a target.',
        };
      }

      if (hw) {
        const asked = wordsOf(hw);
        const score = (text) => {
          const have = new Set(wordsOf(text));
          return asked.filter((w) => have.has(w)).length;
        };
        const scored = cov.targets.map((t) => [
          t,
          score(`${t.dir} ${t.name} ${t.arch} ${t.vendor} ${t.site?.name ?? ''} ${t.site?.chip ?? ''}`),
        ]);
        const best = Math.max(0, ...scored.map(([, s]) => s));
        const targets = best ? scored.filter(([, s]) => s === best).map(([t]) => t) : [];
        const cards = cov.site_only.filter((c) => score(`${c.name} ${c.chip}`) >= Math.max(1, best));
        out.hardware = targets.map((t) => {
          const c = cov.measured.find((m) => m.class === t.dir);
          const detail = {
            cite_as: targetCite(t),
            hardware: t.name,
            arch: t.arch,
            vendor: t.vendor,
            builds_on: t.inherits,
            site_status: t.site ? { status: t.site.status, says: t.site.says } : null,
            kernel_sets: t.models.map((m) => [m.hf_id || m.family, m.params].filter(Boolean).join(', ')),
            signed_records: c
              ? {
                  cite_as: src.records(),
                  records: c.records,
                  boxes: c.boxes,
                  from: c.first,
                  to: c.last,
                  checkpoints: c.models.map((m) => ({ checkpoint: m.checkpoint, records: m.records, gates: gatesOf(m) })),
                }
              : 0,
            recipes: cov.recipes.filter((r) => r.hardware === t.dir).map((r) => ({ id: r.id, checkpoint: r.checkpoint, boxes: r.nodes })),
          };
          if (!c) {
            detail.readme = { cite_as: src.engine(), says: cov.note };
            // What the engine's own documents say about a target with no record:
            // a compile gate, a receipt in the changelog, a bring up note.
            detail.documents = index.search(`${t.name} ${t.dir} ${t.arch}`, { k: 3, tiers, kinds: ['doc'] }).map(({ doc }) => ({
              cite_as: cite(ctx, {
                id: doc.id,
                title: doc.title,
                section: doc.section ?? '',
                url: doc.url ?? '',
                kind: doc.kind,
                tier: doc.tier,
              }),
              title: doc.title,
              section: doc.section ?? '',
              text: clip(doc.text, 900),
            }));
          }
          return detail;
        });
        if (cards.length)
          out.named_on_the_site_without_a_kernel_set = cards.map((c) => ({
            cite_as: src.site(),
            hardware: `${c.name} (${c.chip})`,
            site_status: c.status,
            says: c.says,
          }));
        if (!targets.length && !cards.length)
          out.no_match = `Nothing in the published record names that hardware. The targets are: ${cov.targets.map((t) => t.name).join('; ')}.`;
      }

      if (model) {
        const q = squash(model);
        const hit = (...s) => q.length > 1 && s.some((x) => squash(x).includes(q));
        out.model = {
          signed_records: cov.measured.flatMap((c) =>
            c.models
              .filter((m) => hit(m.checkpoint))
              .map((m) => ({
                cite_as: src.records(),
                hardware: nameOf(c.class),
                checkpoint: m.checkpoint,
                records: m.records,
                from: m.first,
                to: m.last,
                gates: gatesOf(m),
              }))
          ),
          ladders: cov.ladders.filter((l) => hit(l.checkpoint, l.label)).map(ladderLine),
          recipes: cov.recipes
            .filter((r) => hit(r.checkpoint, r.id))
            .map((r) => ({
              cite_as: src.site(),
              id: r.id,
              checkpoint: r.checkpoint,
              engine: r.engine,
              hardware: nameOf(r.hardware),
              boxes: r.nodes,
            })),
          kernel_sets: cov.targets.flatMap((t) =>
            t.models
              .filter((m) => hit(m.hf_id, m.family))
              .map((m) => ({
                cite_as: targetCite(t),
                hardware: t.name,
                site_status: t.site?.status ?? null,
                model: m.hf_id || m.family,
                signed_records_on_this_hardware: t.records,
              }))
          ),
        };
        if (!Object.values(out.model).some((v) => v.length))
          out.model.no_match =
            'Nothing in the published record names that model: no signed record, ladder, recipe or kernel set. Say so, and point at the hardware and models page.';
      }
      return out;
    }

    case 'estimate_economics': {
      const scenario = String(args.scenario ?? '');
      const inputs = {};
      for (const [k, v] of Object.entries(args.inputs ?? {})) if (Number.isFinite(Number(v))) inputs[k] = Number(v);
      const rows = data.ladder?.rows ?? [];
      const top = rows.reduce((a, r) => (r.c > (a?.c ?? -1) ? r : a), null);
      const pricing = `${site}${data.routes?.pricing ?? '/pricing'}#payback`;
      const LABELS = { fleet: 'Get more out of the fleet you own', api: 'Stop renting tokens', energy: 'Get more tokens per watt' };
      const n = LABELS[scenario]
        ? cite(ctx, {
            id: `tool:payback:${scenario}`,
            title: 'The payback model',
            section: LABELS[scenario],
            url: pricing,
            kind: 'page',
            tier: 'public',
          })
        : 0;
      if (scenario === 'fleet') {
        const used = { ...FLEET_DEFAULTS, ...inputs };
        return {
          cite_as: n,
          scenario,
          modeled: true,
          inputs_used: used,
          evidence: {
            uplift: 'USER, defaults below the measured GB10 ratio',
            licensePerGpuYear: "USER, the visitor's quote: Metrale publishes no list price for now",
            others: 'USER',
          },
          result: fleetModel(used),
          page: pricing,
        };
      }
      if (scenario === 'api') {
        const used = { ...API_DEFAULTS, ...(top ? { boxTokensPerSecond: top.engine } : {}), ...inputs };
        return {
          cite_as: n,
          scenario,
          modeled: true,
          inputs_used: used,
          evidence: {
            boxTokensPerSecond: top ? `MEASURED at C=${top.c} on ${data.ladder.box?.gpu ?? 'the published box'}` : 'default',
            licensePerBoxMonth: "USER, the visitor's quote: Metrale publishes no list price for now",
            others: 'USER',
          },
          result: apiModel(used),
          page: pricing,
        };
      }
      if (scenario === 'energy') {
        const ladderRows = rows.map((r) => ({
          c: r.c,
          engine: r.engine,
          best_baseline_id: 'm',
          baselines: [{ id: 'm', tok_s: r.baseline_tok_s }],
        }));
        const used = { ...ENERGY_DEFAULTS, ...energyInputsFrom(ladderRows), ...inputs };
        return {
          cite_as: n,
          scenario,
          modeled: true,
          inputs_used: used,
          evidence: {
            tokensPerSecond: 'MEASURED, top rung',
            baselineTokensPerSecond: 'MEASURED, same rung',
            watts: 'USER, the ladder publishes no power; 240 W is the DGX Spark power supply rating, a ceiling',
            others: 'USER',
          },
          result: energyModel(used),
          page: pricing,
        };
      }
      return { error: 'scenario must be fleet, api or energy.' };
    }

    case 'list_pages': {
      const q = String(args.query ?? '')
        .toLowerCase()
        .trim();
      const pages = (data.pages ?? []).filter((p) => !p.noindex);
      const picked = q ? pages.filter((p) => `${p.path} ${p.title} ${p.description}`.toLowerCase().includes(q)) : pages;
      return {
        pages: picked.slice(0, 40).map((p) => ({
          path: p.path,
          url: `${site}${p.path === '/' ? '' : p.path}`,
          title: p.title,
          description: clip(p.description, 200),
        })),
      };
    }

    case 'next_steps': {
      const audience = ['infra', 'investor', 'contributor', 'curious'].includes(args.audience) ? args.audience : 'curious';
      return { audience, steps: stepsFor(audience, data, site) };
    }

    case 'repo_activity': {
      const h = data.history;
      if (!h) return { error: 'The repository history is not in the knowledge base.' };
      const limit = Math.max(1, Math.min(40, num(args.limit, 12)));
      const repo = data.links?.github ?? ENGINE_REPO;
      const kind = ['releases', 'commits', 'pulls', 'contributors'].includes(args.kind) ? args.kind : 'summary';
      const n = cite(ctx, {
        id: `tool:repo:${kind}`,
        title: 'The repository on GitHub',
        section: `${kind}, as of ${h.as_of}`,
        url:
          kind === 'releases'
            ? `${repo}/releases`
            : kind === 'commits'
              ? `${repo}/commits/main`
              : kind === 'pulls'
                ? `${repo}/pulls?q=is%3Apr+is%3Amerged`
                : kind === 'contributors'
                  ? `${repo}/graphs/contributors`
                  : repo,
        kind: 'history',
        tier: 'public',
      });
      switch (kind) {
        case 'releases':
          return { cite_as: n, as_of: h.as_of, releases: (h.releases ?? []).slice(0, limit) };
        case 'commits':
          return { cite_as: n, as_of: h.as_of, commits: (h.commits ?? []).slice(0, limit) };
        case 'pulls':
          return { cite_as: n, as_of: h.as_of, pulls: (h.pulls ?? []).slice(0, limit) };
        case 'contributors':
          return {
            cite_as: n,
            as_of: h.as_of,
            contributors: (h.contributors ?? []).slice(0, limit),
            note: 'Commit counts. Roles are not recorded here.',
          };
        default:
          return { cite_as: n, as_of: h.as_of, ...(h.summary ?? {}) };
      }
    }

    case 'capture_lead': {
      const name = clip(args.name, 200).trim();
      const email = clip(args.email, 254).trim();
      const company = clip(args.company, 200).trim();
      const interest = clip(args.interest, 300).trim();
      const notes = clip(args.notes, 3000).trim();
      if (!name || !EMAIL.test(email) || !interest)
        return { ok: false, error: 'A name, a valid email address and what they want are needed.' };
      if (ctx.leadCaptured)
        return { ok: false, error: 'A lead was already sent in this conversation. Tell the visitor it is with the team.' };
      // The details are confirmed on a later turn than the one they arrived in,
      // so a typo in an address is caught by the visitor and not by nobody.
      if ((ctx.turns ?? 2) < 2)
        return {
          ok: false,
          error:
            'Not yet. Repeat the name, the email, the company and what they want back to the visitor in one line and ask them to confirm. Send it when they say yes.',
        };
      const lead = { source: 'prime', name, email, company, notes: `${interest}${notes ? `\n\n${notes}` : ''}`, page: clip(page, 200) };
      let id;
      if (env.FORMS_ENDPOINT) {
        try {
          const res = await (ctx.fetchImpl ?? fetch)(env.FORMS_ENDPOINT, {
            method: 'POST',
            headers: { 'content-type': 'application/json', origin: site },
            body: JSON.stringify({ ...lead, website: '' }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok || !body.ok)
            return { ok: false, error: 'The team could not be reached. Give the visitor the sales address instead.' };
          id = body.id ?? null;
        } catch {
          return { ok: false, error: 'The team could not be reached. Give the visitor the sales address instead.' };
        }
      } else if (env.PRIME) {
        id = `prime-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
        try {
          await env.PRIME.put(`lead:${new Date().toISOString()}:${id}`, JSON.stringify({ ...lead, id, at: new Date().toISOString() }), {
            expirationTtl: 180 * 86400,
          });
        } catch {
          return { ok: false, error: 'The lead could not be kept. Give the visitor the sales address instead.' };
        }
      } else {
        return { ok: false, error: 'Nothing is configured to receive a lead. Give the visitor the sales address instead.' };
      }
      ctx.leadCaptured = true;
      return {
        ok: true,
        id,
        note: 'Sent. Tell the visitor a person will reply, and which address to write to if they want to add anything.',
      };
    }

    default:
      return { error: `Unknown tool ${name}.` };
  }
}
