// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// coverage.mjs — which models have run on which hardware, and what says so.
// -----------------------------------------------------------------------------
// "What has been tested on what hardware" has four answers of different
// strength, and Metrale Prime has to keep them apart:
//
//   records   signed gate records: a gate measured this checkpoint on this
//             hardware class, and the record is committed in the engine's
//             .benchmarks/ (gates.generated.json, the dashboard's input)
//   ladders   the published concurrency ladders against vLLM, same box, same
//             checkpoint, same workload (ladders.generated.json)
//   recipes   the engine's launch recipes: one validated way to serve one
//             checkpoint, on the image (and so the hardware) the recipe names
//   targets   the kernel sets the engine builds per hardware target, from
//             kernels/<hw>/, with the site's own status for each. A target
//             with no record is built for, not certified.
//
// Every input is public: the engine at site/engine.ref and what the site
// generates from it. Pure functions, no I/O. corpus.mjs reads the files, the
// Worker's get_coverage tool reads the result, and src/lib/prime-corpus.test.js
// pins the rules.
// =============================================================================

import { hardwareClass } from '../../src/lib/repro-steps.js';
import { recordFileUrl } from '../../src/lib/receipt.js';
import { chunkText, isWithdrawn } from './chunk.mjs';

const day = (unix) => (Number.isFinite(unix) ? new Date(unix * 1000).toISOString().slice(0, 10) : null);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** How many records, how they came out, and the first and last day. */
function tally(records) {
  const at = records.map((r) => r.recorded_at).filter(Number.isFinite);
  const verdicts = {};
  for (const r of records) verdicts[r.verdict ?? 'none'] = (verdicts[r.verdict ?? 'none'] ?? 0) + 1;
  return { records: records.length, verdicts, first: day(Math.min(...at)), last: day(Math.max(...at)) };
}

/**
 * The signed records by hardware class, then checkpoint, then gate. A record
 * with no class or no checkpoint is left out, as the dashboard leaves it out,
 * and so is a gate whose name makes a withdrawn claim.
 * @param {Record<string, {name: string, records: object[]}>} benchmarks gates.generated.json `benchmarks`
 */
export function recordCoverage(benchmarks) {
  const classes = new Map();
  for (const [id, bench] of Object.entries(benchmarks ?? {})) {
    if (isWithdrawn(id) || isWithdrawn(bench?.name ?? '')) continue;
    for (const r of bench?.records ?? []) {
      const cls = hardwareClass(r);
      if (cls === null || typeof r.target_model !== 'string' || r.target_model === '') continue;
      if (!classes.has(cls)) classes.set(cls, { gpus: new Map(), perBox: 0, boxes: new Set(), all: [], models: new Map() });
      const c = classes.get(cls);
      if (r.hardware?.gpu) c.gpus.set(r.hardware.gpu, (c.gpus.get(r.hardware.gpu) ?? 0) + 1);
      c.perBox = Math.max(c.perBox, Number(r.hardware?.gpu_count) || 0);
      const box = String(r.perf_class).split('@')[1];
      if (box) c.boxes.add(box);
      c.all.push(r);
      if (!c.models.has(r.target_model)) c.models.set(r.target_model, { all: [], recipes: new Set(), gates: new Map() });
      const m = c.models.get(r.target_model);
      m.all.push(r);
      if (r.served_by) m.recipes.add(r.served_by);
      if (!m.gates.has(id)) m.gates.set(id, { name: bench.name || id, records: [] });
      m.gates.get(id).records.push(r);
    }
  }
  return [...classes.entries()]
    .map(([cls, c]) => ({
      class: cls,
      gpu: [...c.gpus.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? cls,
      gpus_per_box: c.perBox || null,
      boxes: [...c.boxes].sort(),
      ...tally(c.all),
      models: [...c.models.entries()]
        .map(([checkpoint, m]) => ({
          checkpoint,
          ...tally(m.all),
          recipes: [...m.recipes].sort(),
          gates: [...m.gates.entries()]
            .map(([gid, g]) => {
              const newest = g.records.reduce((a, r) => ((r.recorded_at ?? 0) > (a.recorded_at ?? 0) ? r : a));
              return { id: gid, name: g.name, ...tally(g.records), newest: recordFileUrl(newest) };
            })
            .sort((a, b) => a.name.localeCompare(b.name)),
        }))
        .sort((a, b) => b.records - a.records || a.checkpoint.localeCompare(b.checkpoint)),
    }))
    .sort((a, b) => b.records - a.records || a.class.localeCompare(b.class));
}

/**
 * The published ladders, one per subject: what was measured, where, against
 * what, and how it came out, with every rung.
 * @param {Record<string, object>} subjects ladders.generated.json `subjects`
 * @param {Array<{id: string, label: string}>} labels concurrency-subjects.json
 */
export function ladderCoverage(subjects, labels = []) {
  return Object.entries(subjects ?? {}).map(([id, l]) => {
    const matched = l.rows?.[0]?.baselines?.find((b) => b.parity === 'matched');
    const series = (l.series ?? []).find((s) => s.id === matched?.id);
    const rows = (l.rows ?? []).map((r) => {
      const m = r.baselines?.find((b) => b.parity === 'matched') ?? r.baselines?.find((b) => b.id === r.best_baseline_id) ?? {};
      return {
        c: r.c,
        engine: r.engine,
        baseline: m.label ?? '',
        baseline_tok_s: m.tok_s ?? null,
        ratio: r.ratio_vs_matched ?? r.ratio_vs_best ?? null,
      };
    });
    return {
      id,
      label: labels.find((s) => s.id === id)?.label ?? id,
      checkpoint: l.workload?.checkpoint ?? '',
      title: l.title ?? '',
      subtitle: l.subtitle ?? '',
      aggregate: l.aggregate ?? '',
      workload: l.workload ?? null,
      box: l.box ?? null,
      against: matched ? `${matched.label}${series?.engine ? `, ${series.engine}` : ''}` : '',
      summary: l.summary ?? null,
      results_doc_url: l.results_doc_url ?? '',
      generated_utc: l.generated_utc ?? null,
      rows,
    };
  });
}

/** A recipe's top-level scalars (`model`, `runtime`, `container`, node counts). Nested blocks are skipped. */
export function recipeScalars(text) {
  const out = {};
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][\w-]*):[ \t]*(.*?)[ \t]*$/);
    if (!m || m[2] === '' || /^[|>]/.test(m[2])) continue;
    const quoted = m[2].match(/^(["'])(.*)\1/);
    out[m[1]] = quoted ? quoted[2] : m[2].replace(/\s+#.*$/, '');
  }
  return out;
}

/**
 * What each recipe serves, with which engine, on which hardware, on how many
 * boxes. The hardware is the image's: `metrale/metrale-inference-gb10:latest`
 * runs on gb10. A recipe that launches another engine says so.
 * @param {Array<{id: string, text: string}>} recipes `id` is the path under recipes/ without `.yaml`
 */
export function recipeCoverage(recipes) {
  return recipes
    .map(({ id, text }) => {
      const s = recipeScalars(text);
      const image = s.container ?? '';
      const runtime = (s.runtime ?? '').toLowerCase();
      const engine = runtime === 'metrale' ? 'Metrale Engine' : /vllm/i.test(runtime || image) ? 'vLLM' : runtime || 'unknown';
      return {
        id,
        checkpoint: s.model ?? '',
        engine,
        hardware: image.match(/metrale-inference-([a-z0-9]+(?:-[a-z0-9]+)*)(?::|$)/)?.[1] ?? null,
        image,
        nodes: Math.max(1, Number(s.max_nodes) || 0, Number(s.min_nodes) || 0),
      };
    })
    .filter((r) => r.checkpoint)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** The `key = value` scalars of one `[section]` of a TOML file: enough for HARDWARE.toml and MODEL.toml. */
export function tomlScalars(text, section) {
  const out = {};
  let inside = false;
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('[')) {
      inside = line === `[${section}]`;
      continue;
    }
    if (!inside || !line || line.startsWith('#')) continue;
    const m = line.match(/^([\w-]+)\s*=\s*(.+)$/);
    if (!m) continue;
    const quoted = m[2].match(/^"((?:[^"\\]|\\.)*)"/);
    out[m[1]] = quoted ? quoted[1] : m[2].replace(/\s+#.*$/, '').trim();
  }
  return out;
}

/**
 * The engine README's table of the hardware it builds for beyond the certified
 * box, and the sentence above the table. Rows read
 * `| name | \`kernels/<dir>\` | \`arch\` | model sets |`.
 */
export function readmeTargets(readme) {
  const lines = String(readme ?? '').split(/\r?\n/);
  const at = lines.findIndex((l) => /^#{2,4}\s+Other hardware targets\s*$/.test(l));
  if (at === -1) return { note: '', rows: [] };
  const rest = lines.slice(at + 1);
  const end = rest.findIndex((l) => /^#{1,4}\s/.test(l));
  const body = end === -1 ? rest : rest.slice(0, end);
  const note =
    body
      .join('\n')
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .find((p) => p && !p.startsWith('|')) ?? '';
  const rows = [];
  for (const line of body) {
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.replace(/`/g, '').trim());
    const dir = cells[1]?.match(/^kernels\/([\w.-]+)$/)?.[1];
    if (dir) rows.push({ dir, name: cells[0], arch: cells[2] ?? '', model_sets: Number(cells[3]) || null });
  }
  return { note: note.replace(/\s+/g, ' '), rows };
}

/** One key for an architecture however it is written: `sm_121f`, `SM121`, `gfx1151`. */
export function archKey(s) {
  const t = String(s ?? '');
  const sm = t.match(/\bsm_?(\d{2,3})/i);
  if (sm) return `sm${sm[1]}`;
  const gfx = t.match(/\bgfx(\d{3,4})\b/i);
  return gfx ? `gfx${gfx[1]}` : null;
}

/**
 * Each hardware target the engine builds kernels for, with its model sets and
 * the site's own status for it (Verified, Bring up and so on). A card on the
 * site's hardware page goes to the one target with its architecture, and of two
 * that share one (Strix Halo through SCALE and through native HIP) to the one
 * whose name shares the most words with the card. A card that matches no
 * target is kept apart: the site names hardware the engine has no kernel set for.
 * @param {Array<{dir: string, hardware: object, models: object[]}>} trees kernels/<dir>/HARDWARE.toml and its MODEL.toml files
 * @param {{rows: object[]}} readme readmeTargets()
 * @param {Array<{name: string, chip: string, status: string, body: string}>} cards the hardware page's cards
 */
export function kernelTargets(trees, readme, cards = []) {
  const rowOf = (t) => readme.rows.find((r) => r.dir === t.dir);
  const archOf = (t) => t.hardware.arch || rowOf(t)?.arch || '';
  const words = (s) =>
    new Set(
      String(s)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
    );
  const cardOf = new Map();
  const site_only = [];
  for (const card of cards) {
    const key = archKey(card.chip);
    const said = words(`${card.name} ${card.chip} ${card.status} ${card.body}`);
    const overlap = (t) => [...words(rowOf(t)?.name ?? t.dir)].filter((w) => said.has(w)).length;
    const best = trees.filter((t) => key && archKey(archOf(t)) === key && !cardOf.has(t.dir)).sort((a, b) => overlap(b) - overlap(a))[0];
    if (best) cardOf.set(best.dir, card);
    else site_only.push({ name: card.name, chip: card.chip, status: card.status, says: card.body });
  }
  const targets = trees.map((t) => {
    const row = rowOf(t);
    const card = cardOf.get(t.dir) ?? null;
    return {
      dir: t.dir,
      name: row?.name ?? (card ? `${card.name} (${card.chip})` : t.dir),
      vendor: t.hardware.vendor ?? '',
      arch: archOf(t),
      inherits: t.hardware.inherits ?? null,
      readme_row: Boolean(row),
      site: card ? { name: card.name, chip: card.chip, status: card.status, says: card.body } : null,
      models: t.models
        .map((m) => ({ family: m.dir, hf_id: m.hf_id ?? '', params: m.params ?? '' }))
        .sort((a, b) => a.family.localeCompare(b.family)),
    };
  });
  return { targets, site_only };
}

/**
 * The whole account, in one object for data.json: what is measured where,
 * against what, what has a recipe, and what is only built for.
 */
export function coverage({ benchmarks, subjects, labels, recipes, trees, readme, cards, engine }) {
  const measured = recordCoverage(benchmarks);
  const recipeList = recipeCoverage(recipes ?? []);
  const fromReadme = readmeTargets(readme);
  const { targets, site_only } = kernelTargets(trees ?? [], fromReadme, cards ?? []);
  const certified = new Map(measured.map((c) => [c.class, c.records]));
  const order = (t) => (certified.has(t.dir) ? 0 : t.readme_row ? 1 + fromReadme.rows.findIndex((r) => r.dir === t.dir) : 99);
  for (const t of targets) {
    t.records = certified.get(t.dir) ?? 0;
    t.recipes = recipeList.filter((r) => r.hardware === t.dir).length;
  }
  targets.sort((a, b) => order(a) - order(b) || a.dir.localeCompare(b.dir));
  return {
    engine: engine ?? null,
    note: fromReadme.note,
    measured,
    ladders: ladderCoverage(subjects, labels),
    recipes: recipeList,
    targets,
    site_only,
  };
}

/**
 * The same account as passages, so a plain question ("which models have been
 * tested on which hardware?", "does it run on an H100?") finds it in the search
 * made before the model is called, and is answered in one round with no tool.
 *
 * Only the overview is titled in the words of the general question. A title
 * counts twice in the search, and when every short detail passage carried
 * "hardware" in its title, "what hardware does it run on?" read six of them,
 * not one about GB10, and not the site's own answer. So the details are titled
 * by what they are about: a hardware target by its name, the records, the
 * ladders and the recipes by theirs.
 */
export function coveragePassages(cov, { site }) {
  const out = [];
  // 1400 is what a search result carries of a passage (MAX in the Worker's
  // search_site), so nothing here is cut off where the model reads it, and
  // each passage says what matters first.
  const add = (title, section, url, text) => {
    for (const chunk of chunkText(text, { max: 1400 })) out.push({ kind: 'record', title, section, url, text: chunk });
  };
  const nameOf = (cls) => cov.targets.find((t) => t.dir === cls)?.name ?? cls;
  const byCheckpoint = new Map();
  for (const r of cov.recipes) byCheckpoint.set(r.checkpoint, [...(byCheckpoint.get(r.checkpoint) ?? []), r]);
  const engines = [...new Set(cov.recipes.map((r) => r.engine))].map((e) => {
    const list = cov.recipes.filter((r) => r.engine === e);
    const hw = [...new Set(list.map((r) => r.hardware).filter(Boolean))];
    return `${plural(list.length, 'recipe')} ${list.length === 1 ? 'launches' : 'launch'} ${e}${hw.length ? ` on ${hw.map(nameOf).join(' and ')}` : ''}`;
  });
  const certified = cov.targets.filter((t) => t.records > 0);

  add(
    'Which models have been tested on which hardware',
    'Overview: what runs on which hardware and GPUs, and how each was tested',
    `${site}/platform/hardware`,
    [
      certified.length
        ? `Signed gate records, the strongest evidence, exist only for ${certified.map((t) => t.name).join(' and ')}.`
        : 'No signed gate record is published yet.',
      'Four kinds of evidence, strongest first.',
      ...cov.measured.map(
        (c) =>
          `Signed gate records (measured on the hardware, committed with a signature in the engine repository): ${c.records} on ${c.gpu}, ${plural(c.boxes.length, 'box', 'boxes')}, ${c.first} to ${c.last}, for ${c.models.map((m, i) => `${m.checkpoint} (${i ? `${m.records}, ${m.gates.length}` : `${plural(m.records, 'record')}, ${plural(m.gates.length, 'gate')}`})`).join(', ')}.`
      ),
      cov.ladders.length
        ? `Ladders against vLLM on the same box: ${cov.ladders.map((l) => l.checkpoint).join(' and ')}, on ${[...new Set(cov.ladders.map((l) => l.box?.gpu?.split(',')[0] ?? 'the published box'))].join(' and ')}, C=${cov.ladders[0].rows[0]?.c} to ${cov.ladders[0].rows.at(-1)?.c}.`
        : '',
      `Launch recipes (a validated way to serve one checkpoint, not a benchmark): ${cov.recipes.length} for ${plural(byCheckpoint.size, 'checkpoint')}. ${engines.join(', and ')}.`,
      `Kernel sets by hardware target, with the site's status: ${cov.targets
        .map((t, i) => `${t.name}, ${t.site?.status ?? 'no status'}, ${i ? t.models.length : plural(t.models.length, 'model')}`)
        .join('; ')}.`,
      cov.site_only.length ? `On the site with no kernel set: ${cov.site_only.map((c) => `${c.name}, ${c.status}`).join('; ')}.` : '',
      cov.note ? `The engine README: "${cov.note}"` : '',
    ]
      .filter(Boolean)
      .join(' ')
  );

  for (const c of cov.measured)
    add(
      'Signed gate records',
      `${nameOf(c.class)}, by checkpoint and gate`,
      `${site}/benchmarks`,
      [
        `${plural(c.records, 'signed gate record')} on ${c.gpu}${c.gpus_per_box ? `, ${plural(c.gpus_per_box, 'GPU')} per box` : ''}, from ${plural(c.boxes.length, 'box', 'boxes')} (${c.boxes.join(', ')}), dated ${c.first} to ${c.last}. Each is a gate measured on that hardware and committed with its signature in the engine repository.`,
        ...c.models.map(
          (m) =>
            `${m.checkpoint}: ${plural(m.records, 'record')} from ${plural(m.gates.length, 'gate')}, ${m.gates.map((g) => g.name).join(', ')}.`
        ),
      ].join('\n')
    );

  for (const l of cov.ladders) {
    const s = l.summary;
    add(
      'Published ladders against vLLM',
      l.label,
      `${site}/benchmarks`,
      `${l.checkpoint} on ${l.box?.gpu ?? 'the published box'}${l.box?.name ? ` (${l.box.name})` : ''}, Metrale Engine against ${l.against}, at C=${l.rows.map((r) => r.c).join(', ')}.${s ? ` Metrale Engine is ahead at ${s.won} of ${s.rungs} rungs, ${s.min_ratio}x to ${s.max_ratio}x.` : ''} The results log is ${l.results_doc_url}.`
    );
  }

  for (const t of cov.targets)
    add(
      t.name,
      t.site ? `${t.site.status} on the site` : 'kernel set, no status on the site',
      t.site ? `${site}/platform/hardware` : `${cov.engine?.repo ?? ''}/blob/main/README.md#other-hardware-targets`,
      [
        `${t.name}, architecture ${t.arch}, kernel directory kernels/${t.dir}.`,
        t.site ? `The site lists it as ${t.site.status}: ${t.site.says}` : 'The site gives it no status.',
        t.records
          ? `${plural(t.records, 'signed gate record')} on this hardware.`
          : `No signed gate record on this hardware.${cov.note ? ` The engine README says: "${cov.note}"` : ''}`,
        t.recipes ? `${plural(t.recipes, 'launch recipe')} ${t.recipes === 1 ? 'runs' : 'run'} on it.` : 'No launch recipe runs on it.',
        `Kernel sets for ${plural(t.models.length, 'model')}: ${t.models.map((m) => m.hf_id || m.family).join(', ')}.`,
      ].join(' ')
    );

  if (cov.site_only.length)
    add(
      cov.site_only.map((c) => c.name).join(', '),
      'named on the site, with no kernel set in the repository',
      `${site}/platform/hardware`,
      cov.site_only.map((c) => `${c.name} (${c.chip}), ${c.status}: ${c.says}`).join('\n')
    );

  const recipeName = (r) => `${r.id.split('/').pop()}${r.nodes > 1 ? ` (${r.nodes} boxes)` : ''}`;
  add(
    'Launch recipes',
    'by checkpoint',
    `${site}/platform/hardware#models`,
    [
      `${plural(cov.recipes.length, 'launch recipe')} for ${plural(byCheckpoint.size, 'checkpoint')}. A recipe is one validated way to serve one checkpoint: the image, the checkpoint and the serve settings it was measured under. It is not a signed benchmark record. ${engines.join('. ')}.`,
      ...[...byCheckpoint.entries()].map(
        ([checkpoint, list]) =>
          `${checkpoint}: ${list.map(recipeName).join(', ')}${list.every((r) => r.engine !== 'Metrale Engine') ? `, served by ${list[0].engine}` : ''}.`
      ),
    ].join('\n')
  );
  return out;
}
