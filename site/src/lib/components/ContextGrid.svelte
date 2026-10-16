<script>
  // One model's gates by served context: each cell is the newest record's value,
  // the gate's own limit and the vLLM figure BENCH.toml declares beside it.
  // Which models, rows and columns appear is decided in context-grid.js; this
  // component renders what it is handed and adds nothing.
  import { onMount } from 'svelte';
  import { limitText, metricLabel, withUnit } from '$lib/context-grid.js';
  import { contextLabel, vllmLabel } from '$lib/reference-serve.js';
  import { receiptDay, shortModel } from '$lib/gates.js';
  import { scrollRegion } from '$shared/scroll-region.js';
  import CaveatMark from './CaveatMark.svelte';
  import TargetNotes from './TargetNotes.svelte';

  let { section, onselect } = $props();

  const versusText = (v) =>
    v.side === 'level' ? 'margin vs vLLM 0.0%' : `margin vs vLLM ${v.side === 'ahead' ? '+' : '−'}${Math.abs(v.pct).toFixed(1)}%`;
  // The scroll hint is a script-time affordance: without JS no scroll check runs, so it stays hidden.
  let mounted = $state(false);
  onMount(() => {
    mounted = true;
  });
</script>

<article class="cg" aria-labelledby="cg-{section.model}">
  <h3 class="av-h3" id="cg-{section.model}">{shortModel(section.checkpoint)}</h3>
  <p class="av-small">
    Rows are the context each gate serves. A cell is the newest record's value, the gate's own limit and the vLLM figure the model's
    BENCH.toml declares for that cell. The gate's own limit decides pass or fail; the battles below compare against this vLLM figure.
  </p>
  {#each section.tables as t (t.key)}
    {@const name = `${t.label}, ${shortModel(section.checkpoint)}`}
    {@const scope = `cg-${section.model}-${t.key}`}
    {#if mounted}<p class="av-small cg-hint" aria-hidden="true">Scroll sideways for more →</p>{/if}
    <!-- The table scrolls sideways on a phone: while it does, its wrapper is a named, focusable region (web-shared/scroll-region.js). -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="cg-scroll" role="region" aria-label={name} tabindex="0" use:scrollRegion={{ label: name }}>
      <table class="av-table cg-table">
        <caption>{t.label}</caption>
        <thead>
          <tr>
            <th scope="col" class="cg-corner">Served context</th>
            {#each t.metrics as m}<th scope="col">{metricLabel(m)}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each t.rows as row (row.gate)}
            <tr>
              <th scope="row">
                {contextLabel(row.context)}
                {#if row.qualifier}<span class="cg-qual">{row.qualifier}</span>{/if}
                {#if row.record}
                  {@const when = receiptDay(row.record.recorded_at)}
                  <button type="button" class="cg-receipt" onclick={() => onselect?.([row.record])}
                    >Record, {when.day}<span class="cg-sr">{` ${when.year}: ${name}, ${contextLabel(row.context)} context`}</span></button
                  >
                {/if}
              </th>
              {#each row.cells as c (c.metric)}
                <td>
                  {#if c.state === 'not-gated'}
                    <span class="cg-muted">not gated</span>
                  {:else}
                    {#if c.state === 'measured'}
                      <span class="cg-value" class:cg-over={c.violation !== null}
                        ><span class="cg-sr">ours</span> {withUnit(c.value, c.metric)}</span
                      >
                      {#if c.violation !== null}<span class="cg-flag"><span aria-hidden="true">▲</span> over its own limit</span>{/if}
                    {:else if c.state === 'no-record'}
                      <span class="cg-muted">no record</span>
                    {:else}
                      <span class="cg-muted">not reported</span>
                    {/if}
                    {#if limitText(c.limit, c.metric)}<span class="cg-line">own limit {limitText(c.limit, c.metric)}</span>{/if}
                    {#if c.target !== null}
                      <span class="cg-line">{vllmLabel(row.target_context)} {withUnit(c.target, c.metric)}</span>
                      {#if c.caveat}<CaveatMark caveat={c.caveat} {scope} gate={row.gate} />{/if}
                    {/if}
                    {#if c.versus}<span class="cg-line cg-{c.versus.side}">{versusText(c.versus)}</span>{/if}
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <TargetNotes notes={t.notes} {scope} />
  {/each}
</article>

<style>
  .cg {
    display: grid;
    gap: 1rem;
  }
  /* The hint shows only while the table actually scrolls (scroll-region.js keeps tabindex only then). */
  .cg-hint {
    display: none;
    margin: 0;
    color: var(--t3);
  }
  .cg-hint:has(+ .cg-scroll[tabindex]) {
    display: block;
  }
  /* Relative, so the visually hidden labels inside are clipped with the table and never widen the page. */
  .cg-scroll {
    position: relative;
    overflow-x: auto;
  }
  .cg-table caption {
    text-align: left;
    font-weight: 600;
    color: var(--t1);
    padding-bottom: 0.5rem;
  }
  .cg-table td {
    white-space: nowrap;
    vertical-align: top;
  }
  /* The row header stays in view while the cells scroll under it. */
  .cg-table th[scope='row'],
  .cg-corner {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--bg);
  }
  .cg-table th[scope='row'] {
    color: var(--t1);
    white-space: nowrap;
    vertical-align: top;
  }
  .cg-qual {
    display: block;
    font-family: var(--font-sans);
    letter-spacing: normal;
    text-transform: none;
    max-width: 11rem;
    white-space: normal;
    font-size: 0.75rem;
    font-weight: 400;
    color: var(--t2);
  }
  .cg-value {
    display: block;
    color: var(--t1);
    font-family: var(--font-mono);
  }
  .cg-over {
    color: var(--red);
  }
  .cg-line,
  .cg-flag {
    display: block;
    font-size: 0.8rem;
  }
  .cg-flag {
    color: var(--red);
  }
  .cg-ahead {
    color: var(--green);
  }
  .cg-behind {
    color: var(--amber);
  }
  .cg-muted {
    color: var(--t3);
  }
  .cg-receipt {
    display: block;
    margin-top: 0.25rem;
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent);
    font: inherit;
    font-size: 0.75rem;
    text-decoration: underline;
    cursor: pointer;
  }
  .cg-sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
