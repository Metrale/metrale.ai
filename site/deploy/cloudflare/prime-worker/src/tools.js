// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// tools.js — what Metrale Prime can do besides talk.
// -----------------------------------------------------------------------------
// Each tool is a JSON schema the model sees and a function the Worker runs. A
// tool returns plain data; the model writes the sentence. The seven here are
// the scaffold of a multi function assistant, one per job:
//
//   search_site         information: the site, the docs, the blog, the history
//   get_benchmark       measured numbers, from the published ladder only
//   estimate_economics  the payback model, the same functions the pricing page runs
//   list_pages          direction: where on the site a thing is
//   next_steps          planning: what to do next, by who is asking
//   repo_activity       the repository's releases, commits, pull requests, people
//   capture_lead        intake: a visitor who wants a person to follow up
//
// `data` is the structured half of the knowledge base (pages, the ladder, the
// history, links), written by scripts/prime/corpus.mjs next to the documents.
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
        'Search everything Metrale has published: the pages of this website, the engine documentation in the repository, the blog, and the repository history. Returns numbered passages to cite as [n]. Search again with different words if the first results are thin.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to look for, in plain words. Five to twelve words works best.' },
          kinds: {
            type: 'array',
            items: { type: 'string', enum: ['page', 'doc', 'post', 'history', 'deck', 'plan'] },
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
        'The published concurrency ladder: Metrale against the matched vLLM configuration on the same box, every rung, with the workload and the link to the results log. The only source for measured performance numbers.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'estimate_economics',
      description:
        'Run the payback model from the pricing page. Three scenarios: "fleet" (get more out of GPUs you own), "api" (replace a metered API bill with boxes you own), "energy" (tokens per joule). Any input left out takes the page default. Results are modeled, not measured, and must be labelled that way.',
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
      const l = data.ladder;
      if (!l) return { error: 'The ladder is not in the knowledge base.' };
      const n = cite(ctx, {
        id: 'tool:ladder',
        title: 'The concurrency ladder',
        section: l.box?.gpu ?? '',
        url: `${site}${data.routes?.benchmarks ?? '/benchmarks'}`,
        kind: 'page',
        tier: 'public',
      });
      return {
        cite_as: n,
        title: l.title,
        subtitle: l.subtitle,
        aggregate: l.aggregate,
        workload: l.workload,
        box: l.box,
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
        page: `${site}${data.routes?.benchmarks ?? '/benchmarks'}`,
        note: 'Measured on the box named above, one checkpoint, one workload. It is the only measured performance number. Any other figure is a model.',
      };
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
          evidence: { uplift: 'USER, defaults below the measured GB10 ratio', licensePerGpuYear: 'PROPOSED list price', others: 'USER' },
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
            licensePerBoxMonth: 'PROPOSED',
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
