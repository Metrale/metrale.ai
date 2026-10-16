<script>
  // One model's gates by served context: each cell is the newest record's value,
  // the gate's own limit and the vLLM figure BENCH.toml declares beside it.
  // Which models, rows and columns appear is decided in context-grid.js; this
  // component renders what it is handed and adds nothing.
  import { contextLabel, metricLabel, metricUnit } from '$lib/context-grid.js';
  import { fmtLimit } from '$lib/gate-limits.js';
  import { fmtDate, shortModel } from '$lib/gates.js';
  import { scrollRegion } from '$shared/scroll-region.js';

  let { section, onselect } = $props();

  const fmt = (v, metric) => {
    const unit = metricUnit(metric);
    return `${fmtLimit(v)}${unit ? ` ${unit}` : ''}`;
  };
  const limitText = (limit, metric) =>
    [limit.max !== null ? `≤ ${fmt(limit.max, metric)}` : null, limit.min !== null ? `≥ ${fmt(limit.min, metric)}` : null]
      .filter(Boolean)
      .join(', ');
  const versusText = (v) =>
    v.side === 'level' ? 'level with vLLM' : `${Math.abs(v.pct).toFixed(1)}% ${v.side === 'ahead' ? 'ahead of' : 'behind'} vLLM`;
</script>

<article class="cg" aria-labelledby="cg-{section.model}">
  <h3 class="av-h3" id="cg-{section.model}">{shortModel(section.checkpoint)}</h3>
  <p class="av-small">
    Rows are the context each gate serves. A cell is the newest record's value, the gate's limit, and the vLLM figure the model's BENCH.toml
    declares for that cell, a reference that no verdict reads.
  </p>
  {#each section.tables as t (t.key)}
    <!-- The table scrolls sideways on a phone: while it does, its wrapper is a named, focusable region (web-shared/scroll-region.js). -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="cg-scroll"
      role="region"
      aria-label="{t.label}, {shortModel(section.checkpoint)}"
      tabindex="0"
      use:scrollRegion={{ label: `${t.label}, ${shortModel(section.checkpoint)}` }}
    >
      <table class="av-table cg-table">
        <caption>{t.label}</caption>
        <thead>
          <tr>
            <th scope="col">Context</th>
            {#each t.metrics as m}<th scope="col">{metricLabel(m)}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each t.rows as row (row.gate)}
            <tr>
              <th scope="row">
                {contextLabel(row.context)}
                {#if row.record}
                  <button type="button" class="cg-receipt" onclick={() => onselect?.(row.record)}
                    >{fmtDate(row.record.recorded_at)}<span class="cg-sr"> record of {row.gate}</span></button
                  >
                {/if}
              </th>
              {#each row.cells as c (c.metric)}
                <td>
                  {#if c.state === 'not-gated'}
                    <span class="cg-muted">not gated</span>
                  {:else}
                    {#if c.state === 'measured'}
                      <span class="cg-value" class:cg-over={c.violation !== null}>{fmt(c.value, c.metric)}</span>
                      {#if c.violation !== null}<span class="cg-flag">over its {c.violation}</span>{/if}
                    {:else if c.state === 'no-record'}
                      <span class="cg-muted">no record</span>
                    {:else}
                      <span class="cg-muted">not reported</span>
                    {/if}
                    {#if limitText(c.limit, c.metric)}<span class="cg-line">limit {limitText(c.limit, c.metric)}</span>{/if}
                    {#if c.target !== null}<span class="cg-line">vLLM {fmt(c.target, c.metric)}</span>{/if}
                    {#if c.versus}<span class="cg-line cg-{c.versus.side}">{versusText(c.versus)}</span>{/if}
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/each}
</article>

<style>
  .cg {
    display: grid;
    gap: 1rem;
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
  }
  .cg-table th[scope='row'] {
    color: var(--t1);
    white-space: nowrap;
  }
  .cg-value {
    display: block;
    color: var(--t1);
    font-family: var(--font-mono);
  }
  .cg-over {
    color: var(--amber);
  }
  .cg-line,
  .cg-flag {
    display: block;
    font-size: 0.8rem;
  }
  .cg-flag {
    color: var(--amber);
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
