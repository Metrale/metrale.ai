<script>
  // One benchmark inside a dashboard tab: the latest-run stat tiles, then a
  // GateChart per panel spec. The model chip is ALWAYS rendered — a 27B number
  // must never be readable as a 35B one.
  import GateChart from './GateChart.svelte';
  import GateLadderChart from './GateLadderChart.svelte';
  import { panelsFor, colorFor, shortModel, fmtDate, sampleCount, ladderPoints, isTtftBench } from '$lib/gates.js';
  import { variantLabel } from '$lib/gate-variants.js';
  import { baselineValue, describeTtftDiffers, speedup, ttftBaselineFor } from '$lib/ttft-baselines.js';
  import ttftData from '$lib/ttft-baselines.generated.json';

  // `stat` is the TTFT tabs' Median | p90 choice; every other bench ignores it.
  let { benchId, name, records, onselect, stat = null } = $props();

  const latest = $derived(records[records.length - 1]);
  const ttft = $derived(isTtftBench(benchId));
  const panels = $derived(panelsFor(benchId, records, ttft ? { stat } : {}));
  // One vLLM verdict per model on the chart: paired, refused or not measured.
  const vllm = $derived(
    ttft
      ? [...new Set(records.map((r) => r.target_model))].map((model) => ({ model, ...ttftBaselineFor(benchId, model, records, ttftData) }))
      : []
  );
  const drawn = $derived(
    vllm
      .filter((v) => v.state === 'paired')
      .map((v) => ({ model: v.model, value: baselineValue(v.baseline, stat), label: v.baseline.label, from: v.from }))
  );
  const fmtMs = (v) => `${Math.round(v).toLocaleString('en-US')} ms`;
  const methodOf = (b) =>
    b.method === 'one-shot' ? `one-shot, ${b.runs} steady requests` : `gate run, ${b.runs} runs of ${b.instrument.reps} samples`;
  const headline = $derived.by(() => {
    const m = latest?.metrics ?? {};
    if (benchId === 'agentic-webserver')
      return [
        { label: 'webserver_ok', value: `${m.webserver_ok}/${m.iterations}` },
        { label: 'Σ wall', value: `${Math.round(m.sum_wall_s).toLocaleString('en-US')} s` },
      ];
    if (benchId.startsWith('bfcl'))
      return [
        { label: 'overall', value: m.overall_accuracy },
        { label: 'normalized', value: m.normalized_single_turn_score },
      ];
    if (ttft) {
      const tiles = [
        { label: 'median', value: fmtMs(m.median_ms) },
        { label: 'p90', value: fmtMs(m.p90_ms) },
      ];
      // The ratio against vLLM, for the statistic on screen and this record's
      // model, only when the pairing drew a baseline.
      const paired = vllm.find((v) => v.model === latest.target_model && v.state === 'paired');
      const ratio = paired ? speedup(m[`${stat}_ms`], baselineValue(paired.baseline, stat)) : null;
      if (ratio) tiles.push({ label: `vs vLLM · ${stat}`, value: ratio });
      return tiles;
    }
    if (benchId === 'concurrency-sweep') {
      // Guarded per key: the tiles must survive a record that predates the
      // metrics map (or one whose cells were all vacuous and published no
      // comparable curve).
      const tiles = [];
      // The latest record in a grouped section can belong to either variant,
      // so the tile has to say which one it is. Unlabelled, a DFlash2 peak
      // would read as the plain gate's under the plain gate's heading.
      const variant = variantLabel(latest.benchmark_id);
      if (Number.isFinite(m.peak_aggregate_tok_s))
        tiles.push({
          label: variant ? `peak · ${variant}` : 'peak',
          value: `${(+m.peak_aggregate_tok_s).toFixed(1)} tok/s`,
        });
      const rungs = ladderPoints(latest).length;
      if (rungs > 0) tiles.push({ label: 'rungs', value: rungs });
      if (Number.isFinite(m.vacuous_cells) && m.vacuous_cells > 0) tiles.push({ label: 'vacuous cells', value: m.vacuous_cells });
      return tiles;
    }
    return [];
  });
</script>

<!-- article, not <section>: app.css pads the bare section element (5.5rem+). -->
<article class="gbs" aria-label="{name} results">
  <header class="gbs-head">
    <div class="gbs-title-row">
      <h3 class="gbs-name">{name}</h3>
      <span class="gbs-model" style="border-color:{colorFor(latest.target_model)}; color:{colorFor(latest.target_model)}">
        {shortModel(latest.target_model)}
      </span>
    </div>
    <div class="gbs-tiles">
      {#each headline as tile}
        <div class="gbs-tile">
          <span class="gbs-tile-val">{tile.value}</span>
          <span class="gbs-tile-label">{tile.label}</span>
        </div>
      {/each}
      <div class="gbs-tile">
        <span class="gbs-tile-val gbs-verdict" data-verdict={latest.verdict}
          >{latest.verdict === 'PASS' ? '✓ PASS' : '✗ ' + latest.verdict}</span
        >
        <span class="gbs-tile-label"
          >latest · {fmtDate(latest.recorded_at)}{#if sampleCount(latest) !== null}&nbsp;· n={sampleCount(latest)}{/if}</span
        >
      </div>
    </div>
  </header>

  {#each panels as panel}
    {#if panel.kind === 'ladder'}
      <GateLadderChart {records} {panel} {onselect} />
    {:else}
      <GateChart {records} {panel} {onselect} baselines={drawn} />
    {/if}
  {/each}

  {#if vllm.length > 0}
    <ul class="gbs-vllm" aria-label="vLLM baseline for {name}">
      {#each vllm as v (v.model)}
        <li class="gbs-vllm-item" data-state={v.state}>
          {#if v.state === 'paired'}
            {@const b = v.baseline}
            <strong>{b.label}</strong> on {shortModel(v.model)}:
            <span class="mono">{fmtMs(baselineValue(b, stat))}</span>
            {stat}, {b.engine}, {methodOf(b)}, {b.box}. {b.statistic}. Drawn from {fmtDate(v.from)}, the first run on the same prompt, reply
            length, cache state and sample count.
            {#if b.box_state}<span class="gbs-vllm-caveat">{b.box_state}</span>{/if}
            {#each v.refused as r (r.baseline.id)}
              <span class="gbs-vllm-refused"
                >Not drawn: {r.baseline.label} {methodOf(r.baseline)}, which differs in {describeTtftDiffers(r.differs)}.</span
              >
            {/each}
          {:else if v.state === 'refused'}
            <strong>vLLM on {shortModel(v.model)}: not drawn.</strong>
            {#each v.refused as r (r.baseline.id)}
              {r.baseline.label} {methodOf(r.baseline)} differs from this gate in {describeTtftDiffers(r.differs)}.
            {/each}
          {:else}
            <strong>vLLM on {shortModel(v.model)}: not measured.</strong> {v.reason}
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</article>
