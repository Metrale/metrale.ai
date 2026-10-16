<script>
  // One named battle of one model (the engine's bench/battles.toml): each cell
  // is the newest record against the vLLM figure the model's BENCH.toml
  // declares, with the verdict, the margin, the cell's own regression limit and
  // the margin over the model's records. Which cells exist and how they are
  // judged is decided in battle-grid.js; this component renders what it is
  // handed and adds nothing.
  import { columnLabel, unitOf } from '$lib/battle-grid.js';
  import { contextLabel } from '$lib/context-grid.js';
  import { fmtLimit } from '$lib/gate-limits.js';
  import { fmtDate, shortModel } from '$lib/gates.js';
  import { scrollRegion } from '$shared/scroll-region.js';

  let { battle, checkpoint, onselect } = $props();

  // The last few margins are enough to read a direction; older ones stay in the records.
  const TREND_SHOWN = 6;

  const fmt = (v, metric) => {
    const unit = unitOf(metric);
    return `${fmtLimit(v)}${unit ? ` ${unit}` : ''}`;
  };
  const pct = (m) => `${m > 0 ? '+' : m < 0 ? '−' : ''}${Math.abs(m).toFixed(1)}%`;
  const rowLabel = (r) =>
    [r.mode, r.context !== null && r.context !== undefined ? contextLabel(r.context) : null].filter(Boolean).join(' · ');
  const VERDICT = { win: 'Win', loss: 'Loss', tie: 'Tie', 'no-record': 'No record', 'not-reported': 'Not reported' };
  const RATCHET = { within: 'within its own limit', breach: 'over its own limit', unbounded: 'no limit yet', 'no-value': null };
  const direction = $derived(battle.better.length === 1 ? (battle.better[0] === 'lower' ? 'lower is better' : 'higher is better') : null);
  const title = $derived(`${battle.name}, ${shortModel(checkpoint)}`);
</script>

<article class="bp" aria-labelledby="bp-{battle.id}-{checkpoint}">
  <div class="bp-head">
    <h4 class="bp-title" id="bp-{battle.id}-{checkpoint}">{battle.name}</h4>
    <span class="av-chip {battle.all_cells_win ? 'av-chip-ok' : 'av-chip-warn'}">
      {battle.all_cells_win ? 'Every cell wins' : 'Not every cell wins'}
    </span>
  </div>
  <p class="av-small">
    {battle.counts.win} of {battle.counts.cells} cells win, {battle.counts.loss} lose{battle.counts.tie > 0
      ? `, ${battle.counts.tie} tie`
      : ''}{battle.counts.open > 0 ? `, ${battle.counts.open} have no value yet` : ''}{direction ? `; ${direction}` : ''}. The margin is
    ours against vLLM, negative when behind. A cell can be within its own regression limit and still lose.
  </p>
  {#if battle.note}<p class="av-small bp-note">{battle.note}</p>{/if}
  <!-- The table scrolls sideways on a phone: while it does, its wrapper is a named, focusable region (web-shared/scroll-region.js). -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="bp-scroll" role="region" aria-label={title} tabindex="0" use:scrollRegion={{ label: title }}>
    <table class="av-table bp-table">
      <caption class="bp-sr">{title}</caption>
      <thead>
        <tr>
          <th scope="col">Served</th>
          {#each battle.columns as column}<th scope="col">{columnLabel(battle, column)}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each battle.rows as row (`${row.mode}-${row.context}`)}
          <tr>
            <th scope="row">{rowLabel(row)}</th>
            {#each row.cells as c, i (i)}
              <td>
                {#if c === null}
                  <span class="bp-muted">not in this battle</span>
                {:else}
                  <span class="bp-verdict bp-{c.verdict}">{VERDICT[c.verdict]}</span>
                  {#if c.value !== null}<span class="bp-value">{fmt(c.value, c.metric)}</span>{/if}
                  <span class="bp-line">vLLM {fmt(c.target, c.metric)}</span>
                  {#if c.margin_pct !== null}<span class="bp-line">margin {pct(c.margin_pct)}</span>{/if}
                  {#if RATCHET[c.ratchet]}<span class="bp-line" class:bp-over={c.ratchet === 'breach'}>{RATCHET[c.ratchet]}</span>{/if}
                  {#if c.trend.length > 1}
                    <span class="bp-line bp-trend"
                      >trend {c.trend
                        .slice(-TREND_SHOWN)
                        .map((t) => pct(t.margin_pct))
                        .join(' → ')}</span
                    >
                  {/if}
                  {#if c.record}
                    <button type="button" class="bp-receipt" onclick={() => onselect?.(c.record)}
                      >{fmtDate(c.record.recorded_at)}<span class="bp-sr"> record of {c.gate}</span></button
                    >
                  {/if}
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</article>

<style>
  .bp {
    display: grid;
    gap: 0.5rem;
    min-width: 0;
  }
  .bp-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .bp-title {
    margin: 0;
    font-size: 1rem;
    color: var(--t1);
  }
  .bp-note {
    color: var(--t3);
  }
  /* Relative, so the visually hidden labels inside are clipped with the table and never widen the page. */
  .bp-scroll {
    position: relative;
    overflow-x: auto;
  }
  .bp-table td {
    white-space: nowrap;
    vertical-align: top;
  }
  .bp-table th[scope='row'] {
    color: var(--t1);
    white-space: nowrap;
  }
  .bp-verdict {
    display: block;
    font-weight: 600;
  }
  .bp-win {
    color: var(--green);
  }
  .bp-loss {
    color: var(--amber);
  }
  .bp-tie {
    color: var(--t1);
  }
  .bp-no-record,
  .bp-not-reported,
  .bp-muted {
    color: var(--t3);
  }
  .bp-value {
    display: block;
    color: var(--t1);
    font-family: var(--font-mono);
  }
  .bp-line {
    display: block;
    font-size: 0.8rem;
  }
  .bp-over {
    color: var(--amber);
  }
  .bp-receipt {
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
  .bp-sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
