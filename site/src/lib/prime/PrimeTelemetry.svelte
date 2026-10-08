<!--
  Response times, this session. A sparkline of every answer's total time, the
  average as a dashed line, and the average as a number. Click for the table:
  first token, total, tokens and cost per answer, and the session's cost. The
  numbers come from the Worker's usage event, so they are what the visitor was
  actually served, not what the page measured.

  The table hangs from the panel's header (PrimePanel's .pr-head is its
  positioned ancestor), the header's full width, so the panel's own edges hold
  it. Hung from this button it was wider than the room to the button's left,
  and on a desk the panel cut its first columns off. Escape or a click outside
  closes it, before Escape closes the panel.
-->
<script>
  import { prime, summarize, cachedShare, tokensPerSecond } from './state.svelte.js';
  import { prime as copy } from './copy.js';
  import { CHART_POINTS } from './config.js';

  let open = $state(false);
  let root = $state(null);

  $effect(() => {
    if (!open) return;
    const away = (e) => {
      if (root && !root.contains(e.target)) open = false;
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  });
  function onKeydown(e) {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      open = false;
    }
  }
  const recent = $derived(prime.telemetry.slice(-CHART_POINTS));
  const sum = $derived(summarize(prime.telemetry));
  const W = 84,
    H = 22;
  const max = $derived(Math.max(1, ...recent.map((t) => t.total_ms ?? 0)));
  const x = (i) => (recent.length > 1 ? (i / (recent.length - 1)) * (W - 4) + 2 : W / 2);
  const y = (v) => H - 2 - (v / max) * (H - 6);
  const path = $derived(recent.map((t, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(t.total_ms ?? 0).toFixed(1)}`).join(' '));
  const avgY = $derived(y(sum.avgTotal));
  const secs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`);
  const usd = (n) => (n >= 0.01 ? `$${n.toFixed(3)}` : `$${n.toFixed(4)}`);
  const pct = (share) => (share === null || share === undefined ? '·' : `${Math.round(share * 100)}%`);
  const rate = (r) => (r === null || r === undefined ? '·' : String(Math.round(r)));
</script>

<div class="pr-tele" bind:this={root}>
  <button
    type="button"
    class="pr-tele-btn"
    aria-expanded={open}
    aria-label={`${copy.telemetry.heading}. ${sum.answers ? `${copy.telemetry.avg} ${secs(sum.avgTotal)}` : copy.telemetry.none}`}
    onclick={() => (open = !open)}
    onkeydown={onKeydown}
  >
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
      {#if recent.length > 0}
        <line x1="2" x2={W - 2} y1={avgY} y2={avgY} class="pr-tele-avg" />
        <path d={path} class="pr-tele-line" />
        <circle cx={x(recent.length - 1)} cy={y(recent.at(-1).total_ms ?? 0)} r="2.2" class="pr-tele-dot" />
      {:else}
        <line x1="2" x2={W - 2} y1={H / 2} y2={H / 2} class="pr-tele-avg" />
      {/if}
    </svg>
    <span class="pr-tele-num">{sum.answers ? secs(sum.avgTotal) : '·'}</span>
  </button>
  {#if open}
    <div class="pr-tele-pop" role="region" aria-label={copy.telemetry.heading}>
      <p class="pr-tele-title">{copy.telemetry.heading}</p>
      {#if sum.answers === 0}
        <p class="pr-tele-none">{copy.telemetry.none}</p>
      {:else}
        <div class="pr-tele-scroll">
          <table>
            <thead
              ><tr
                ><th>#</th><th>{copy.telemetry.first}</th><th>{copy.telemetry.total}</th><th>{copy.telemetry.tokens}</th><th
                  >{copy.telemetry.cached}</th
                ><th>{copy.telemetry.rate}</th><th>{copy.telemetry.cost}</th></tr
              ></thead
            >
            <tbody>
              {#each prime.telemetry.slice(-CHART_POINTS) as t, i}
                <tr
                  ><td>{prime.telemetry.length - Math.min(CHART_POINTS, prime.telemetry.length) + i + 1}</td><td>{secs(t.ttft_ms ?? 0)}</td
                  ><td>{secs(t.total_ms ?? 0)}</td><td>{(t.tokens ?? 0).toLocaleString('en-US')}</td><td>{pct(cachedShare(t))}</td><td
                    >{rate(tokensPerSecond(t))}</td
                  ><td>{usd(t.cost_usd ?? 0)}</td></tr
                >
              {/each}
            </tbody>
            <tfoot>
              <tr
                ><td>{copy.telemetry.avg}</td><td>{secs(sum.avgFirst)}</td><td>{secs(sum.avgTotal)}</td><td
                  >{sum.tokens.toLocaleString('en-US')}</td
                ><td>{pct(sum.cachedShare)}</td><td>{rate(sum.rate)}</td><td>{usd(sum.cost)}</td></tr
              >
            </tfoot>
          </table>
        </div>
        <!-- The session's token ledger: what was read from cache, what was spent
             thinking, what was written. A token company keeps its own accounts. -->
        <p class="pr-tele-ledger">
          <span><b>{sum.prompt.toLocaleString('en-US')}</b> prompt</span>
          <span><b>{sum.cached.toLocaleString('en-US')}</b> {copy.telemetry.cached}</span>
          <span><b>{sum.reasoning.toLocaleString('en-US')}</b> {copy.telemetry.thinking}</span>
          <span><b>{sum.completion.toLocaleString('en-US')}</b> written</span>
        </p>
        <p class="pr-tele-foot">
          {sum.answers}
          {copy.telemetry.answers}{prime.model ? ` · ${prime.model}${prime.effort ? ` · ${prime.effort}` : ''}` : ''}
        </p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .pr-tele-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.2rem 0.45rem;
    border-radius: 8px;
    border: 1px solid transparent;
    background: none;
    color: var(--t3);
    cursor: pointer;
    font: inherit;
  }
  .pr-tele-btn:hover,
  .pr-tele-btn[aria-expanded='true'] {
    border-color: var(--border-strong);
    background: var(--bg2);
    color: var(--t2);
  }
  .pr-tele-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .pr-tele-line {
    fill: none;
    stroke: var(--accent);
    stroke-width: 1.6;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .pr-tele-avg {
    stroke: var(--border-strong);
    stroke-width: 1;
    stroke-dasharray: 2 3;
  }
  .pr-tele-dot {
    fill: var(--accent);
  }
  .pr-tele-num {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    min-width: 2.6em;
    text-align: right;
  }
  .pr-tele-pop {
    position: absolute;
    left: 0.6rem;
    right: 0.6rem;
    top: calc(100% + 6px);
    z-index: 2;
    max-height: min(70dvh, 560px);
    overflow-y: auto;
    padding: 0.9rem 1rem;
    background: var(--card);
    border: 1px solid var(--border-strong);
    border-radius: 14px;
    box-shadow: var(--shadow-lg);
  }
  /* A header wraps before a number does ("first token" takes two lines on a
     390 px phone), and a screen narrower still scrolls the table sideways
     inside the card rather than past the panel's edge. */
  .pr-tele-scroll {
    overflow-x: auto;
  }
  .pr-tele-title {
    margin: 0 0 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--t3);
  }
  .pr-tele-none {
    margin: 0;
    font-size: 0.85rem;
    color: var(--t2);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    padding: 0.22rem 0.2rem;
    text-align: right;
  }
  th {
    color: var(--t3);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-size: 0.62rem;
    vertical-align: bottom;
  }
  td {
    color: var(--t1);
    white-space: nowrap;
  }
  th:first-child,
  td:first-child {
    text-align: left;
    color: var(--t3);
  }
  thead tr {
    border-bottom: 1px solid var(--border);
  }
  tfoot tr {
    border-top: 1px solid var(--border-strong);
  }
  tfoot td {
    color: var(--t2);
    font-weight: 600;
  }
  .pr-tele-foot {
    margin: 0.55rem 0 0;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    color: var(--t3);
  }
  .pr-tele-ledger {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 1rem;
    margin: 0.6rem 0 0;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    color: var(--t3);
    font-variant-numeric: tabular-nums;
  }
  .pr-tele-ledger b {
    color: var(--t1);
    font-weight: 600;
  }
</style>
