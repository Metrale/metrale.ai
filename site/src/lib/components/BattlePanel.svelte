<script>
  // One named battle of one model (the engine's bench/battles.toml): each cell
  // is the newest record against the vLLM figure the model's BENCH.toml
  // declares, with the verdict, the margin, the cell's own regression limit and
  // the margin over the model's records. Which cells exist and how they are
  // judged is decided in battle-grid.js; this component renders what it is
  // handed and adds nothing.
  import { battleChip, columnLabel } from '$lib/battle-grid.js';
  import { limitText, withUnit } from '$lib/context-grid.js';
  import { contextLabel, vllmLabel } from '$lib/reference-serve.js';
  import { receiptDay, shortModel } from '$lib/gates.js';
  import { scrollRegion } from '$shared/scroll-region.js';
  import CaveatMark from './CaveatMark.svelte';
  import TargetNotes from './TargetNotes.svelte';

  let { battle, checkpoint, onselect } = $props();

  // The last few margins are enough to read a direction; older ones stay in the records.
  const TREND_SHOWN = 6;

  const pct = (m) => `${m > 0 ? '+' : m < 0 ? '−' : ''}${Math.abs(m).toFixed(1)}%`;
  const rowLabel = (r) =>
    [r.mode, r.context !== null && r.context !== undefined ? contextLabel(r.context) : null].filter(Boolean).join(' · ');
  const VERDICT = { win: 'Win', loss: 'Loss', tie: 'Tie', 'no-record': 'No record', 'not-reported': 'Not reported' };
  const direction = $derived(battle.better.length === 1 ? (battle.better[0] === 'lower' ? 'lower is better' : 'higher is better') : null);
  const title = $derived(`${battle.name}, ${shortModel(checkpoint)}`);
  const chip = $derived(battleChip(battle));
  const scope = $derived(`bp-${battle.id}-${checkpoint}`);
</script>

<article class="bp" aria-labelledby="bp-{battle.id}-{checkpoint}">
  <div class="bp-head">
    <h4 class="bp-title" id="bp-{battle.id}-{checkpoint}">{battle.name}</h4>
    <span class="av-chip {chip.won ? 'av-chip-ok' : 'av-chip-warn'}">{chip.text}</span>
  </div>
  <p class="av-small">
    {battle.counts.win} of {battle.counts.cells} cells win, {battle.counts.loss} lose{battle.counts.tie > 0
      ? `, ${battle.counts.tie} tie`
      : ''}{battle.counts.open > 0 ? `, ${battle.counts.open} not yet measured` : ''}{direction ? `; ${direction}` : ''}. Each cell is our
    newest value, the vLLM figure, the margin vs vLLM (negative when behind) and whether the value is within its own limit. A cell can also
    win against vLLM and still be over its own limit.
  </p>
  <ul class="av-small bp-legend">
    <li><strong>Served context</strong>: cold = empty prefix cache, warm = cached prefix; C = concurrent requests.</li>
    <li>
      <strong>No record</strong>: this gate has not run yet. <strong>Not reported</strong>: the gate ran but did not record this value.
    </li>
  </ul>
  {#if battle.note}<p class="av-small bp-note">{battle.note}</p>{/if}
  <p class="av-small bp-hint" aria-hidden="true">Scroll sideways for more →</p>
  <!-- The table scrolls sideways on a phone: while it does, its wrapper is a named, focusable region (web-shared/scroll-region.js). -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="bp-scroll" role="region" aria-label={title} tabindex="0" use:scrollRegion={{ label: title }}>
    <table class="av-table bp-table">
      <caption class="bp-sr">{title}</caption>
      <thead>
        <tr>
          <th scope="col" class="bp-corner">Served context</th>
          {#each battle.columns as column}<th scope="col">{columnLabel(battle, column)}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each battle.rows as row (`${row.mode}-${row.context}`)}
          <tr>
            <th scope="row">
              {rowLabel(row)}
              {#each row.qualifiers as q (q)}<span class="bp-qual">{q}</span>{/each}
            </th>
            {#each row.cells as c, i (i)}
              <td>
                {#if c === null}
                  <span class="bp-muted">no vLLM figure at this context</span>
                {:else}
                  <span class="bp-verdict bp-{c.verdict}">{VERDICT[c.verdict]}</span>
                  {#if c.value !== null}<span class="bp-value"><span class="bp-sr">ours</span> {withUnit(c.value, c.metric)}</span>{/if}
                  <span class="bp-line">{vllmLabel(c.target_context)} {withUnit(c.target, c.metric)}</span>
                  {#if c.caveat}<CaveatMark caveat={c.caveat} {scope} gate={c.gate} />{/if}
                  {#if c.margin_pct !== null}<span class="bp-line">margin vs vLLM {pct(c.margin_pct)}</span>{/if}
                  {#if c.ratchet === 'within' || c.ratchet === 'breach'}
                    <span class="bp-line" class:bp-over={c.ratchet === 'breach'}
                      >{#if c.ratchet === 'breach'}<span aria-hidden="true">▲</span> over{:else}within{/if} its own limit ({limitText(
                        c.limit,
                        c.metric
                      )})</span
                    >
                  {:else if c.ratchet === 'unbounded'}
                    <span class="bp-line">no own limit yet</span>
                  {/if}
                  {#if c.trend.length > 1}
                    <span class="bp-line bp-trend"
                      >trend, oldest → newest: {c.trend
                        .slice(-TREND_SHOWN)
                        .map((t) => pct(t.margin_pct))
                        .join(' → ')}</span
                    >
                  {/if}
                  {#if c.record}
                    {@const when = receiptDay(c.record.recorded_at)}
                    <button type="button" class="bp-receipt" onclick={() => onselect?.([c.record])}
                      >Record, {when.day}<span class="bp-sr"
                        >{` ${when.year}: ${title}, ${rowLabel(row)}, ${columnLabel(battle, c.column)}`}</span
                      ></button
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
  <TargetNotes notes={battle.notes} {scope} />
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
  .bp-legend {
    margin: 0;
    padding-left: 1.1rem;
    color: var(--t2);
  }
  /* The hint shows only while the table actually scrolls (scroll-region.js keeps tabindex only then). */
  .bp-hint {
    display: none;
    margin: 0;
    color: var(--t3);
  }
  .bp:has(.bp-scroll[tabindex]) .bp-hint {
    display: block;
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
  /* The row header stays in view while the cells scroll under it. */
  .bp-table th[scope='row'],
  .bp-corner {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--bg);
  }
  .bp-table th[scope='row'] {
    color: var(--t1);
    white-space: nowrap;
    vertical-align: top;
  }
  .bp-qual {
    display: block;
    max-width: 11rem;
    white-space: normal;
    font-size: 0.75rem;
    font-weight: 400;
    color: var(--t2);
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
    color: var(--red);
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
