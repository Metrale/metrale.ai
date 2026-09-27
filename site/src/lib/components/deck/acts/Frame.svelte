<script>
  // Act I — what is claimed, what is not, and the result. The scope slide
  // comes before the chart because a claim whose edges are stated first is
  // read differently from one whose edges have to be dug out.
  import Slide from '../Slide.svelte';
  import Kv from '../Kv.svelte';
  import ConcurrencyLadder from '../../ConcurrencyLadder.svelte';
  import { claim, fragile, proof, stamp } from '$lib/deck/content.js';
</script>

<Slide act="violet">
  <div class="cover">
    <div class="cover-copy">
      <p class="cover-kicker mono">Verification steps</p>
      <h1 class="cover-title">Reproduce the ladder<br />before you believe it.</h1>
      <p class="cover-sub">
        The concurrency claim on the front page, restated as commands you can run on your own box, with every axis it depends on named so it
        can be falsified.
      </p>
    </div>
    <dl class="cover-facts">
      <div>
        <dt>rungs won</dt>
        <dd class="mono">{claim.won} / {claim.rungs}</dd>
      </div>
      <div>
        <dt>margin</dt>
        <dd class="mono">{claim.min} – {claim.max}</dd>
      </div>
      <div>
        <dt>checkpoint</dt>
        <dd class="mono">{claim.checkpoint}</dd>
      </div>
      <div>
        <dt>hardware</dt>
        <dd class="mono">{claim.box}</dd>
      </div>
      <div>
        <dt>baseline</dt>
        <dd class="mono">{claim.baseline}, {claim.baselineVersion}</dd>
      </div>
      <div>
        <dt>build</dt>
        <dd class="mono">{stamp}</dd>
      </div>
    </dl>
    <blockquote class="claim">
      <p>
        <strong>{claim.engine}</strong> sustains higher mean decode throughput than <strong>{claim.baseline}</strong>
        ({claim.baselineVersion}) on <span class="dk-code">{claim.checkpoint}</span>, served on one {claim.box}, at <strong>every</strong>
        concurrency C = {claim.concurrencies}
        — ISL {claim.isl}, OSL {claim.osl}, temperature {claim.temperature}, seed {claim.seed}, {claim.aggregate}. Margins run {claim.min} to
        {claim.max}.
      </p>
    </blockquote>
  </div>
</Slide>

<Slide
  act="violet"
  eyebrow="Scope"
  title="What is claimed, and what is not"
  lede="Every noun in the claim is a knob someone could have turned. The fastest way to waste a week is to test something we never said."
>
  <div class="dk-cols">
    <Kv
      rows={[
        ['measured on', claim.box, `${claim.boxName}. Every figure here was taken there, not extrapolated from it.`],
        [
          'one checkpoint',
          claim.checkpoint,
          `${claim.checkpointNote}. MoE and long-context models behave differently and are not claimed.`,
        ],
        ['single box', 'no multi-node', 'No TP, PP or EP story is being told here.'],
        ['best baseline', `${claim.baseline}, fp8 KV`, `${claim.unmatchedLabel} is published beside it, plotted and not scored.`],
        [
          'durability',
          'gated, not asserted',
          'Absolute per-rung floors are committed in the engine and every pull request must clear them.',
        ],
      ]}
    />
    <aside class="dk-card dk-card-warn">
      <p class="dk-card-h">Fragile rungs, named</p>
      <p>
        {fragile.count} of {claim.rungs} rungs are won by margins inside plausible run-to-run drift: {fragile.rungs} sit between {fragile.min}
        and {fragile.max}. We flag them rather than rounding them into the headline, and they are the rungs we re-measure first when
        anything changes.
      </p>
    </aside>
  </div>
</Slide>

<Slide
  act="violet"
  eyebrow="Result"
  title="{claim.won} of {claim.rungs} rungs, {claim.min} to {claim.max}"
  lede="Aggregate decode tokens per second, both engines, every rung. Log2 X because the rungs double; the table carries the exact figures and the spread the chart only implies."
>
  <div class="dk-stats result-stats">
    <div><b>{proof.topRatio}</b><span>at C={proof.topC}: {proof.topEngine} vs {proof.topBaseline} tok/s</span></div>
    <div><b>{proof.firstRatio}</b><span>at C={proof.firstC}: {proof.firstEngine} vs {proof.firstBaseline} tok/s</span></div>
    <div><b>{claim.reps}×</b><span>timed reps per rung, {claim.warmup} warmup discarded</span></div>
  </div>
  <div class="chart">
    <ConcurrencyLadder embedded compact />
  </div>
</Slide>

<style>
  .cover {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1.5rem 3rem;
    padding-top: clamp(0.5rem, 4vh, 3rem);
    align-items: start;
  }
  @media (min-width: 1100px) {
    .cover {
      grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
    }
    .cover-facts {
      grid-row: 1 / span 2;
      grid-column: 2;
      margin-top: 0.4rem;
    }
  }
  .cover-copy {
    display: grid;
    gap: 1rem;
    min-width: 0;
  }
  .cover-facts {
    display: grid;
    gap: 0;
    min-width: 0;
    border-top: 1px solid var(--border-strong);
  }
  .cover-facts > div {
    display: grid;
    grid-template-columns: 11ch minmax(0, 1fr);
    gap: 0.8rem;
    padding: 0.55rem 0;
    border-bottom: 1px solid var(--border);
    align-items: baseline;
  }
  .cover-facts dt {
    overflow-wrap: anywhere;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--t3);
  }
  .cover-facts dd {
    font-size: 0.86rem;
    color: var(--t1);
    overflow-wrap: anywhere;
  }
  .cover-kicker {
    font-size: 0.74rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--sx-text);
  }
  .cover-title {
    font-size: clamp(2rem, 1.3rem + 3vw, 3.6rem);
    font-weight: 600;
    letter-spacing: -0.035em;
    line-height: 1.04;
    text-wrap: balance;
  }
  .cover-sub {
    font-size: clamp(1rem, 0.95rem + 0.35vw, 1.2rem);
    color: var(--t2);
    max-width: 58ch;
    line-height: 1.6;
  }
  .claim {
    grid-column: 1;
    border-left: 3px solid var(--sx);
    background: var(--card);
    padding: 1rem 1.25rem;
    border-radius: 0 10px 10px 0;
    max-width: 78ch;
    min-width: 0;
  }
  .claim p {
    font-size: 0.98rem;
    line-height: 1.65;
    color: var(--t2);
    overflow-wrap: anywhere;
  }
  .claim strong {
    color: var(--t1);
    font-weight: 600;
  }
  .result-stats {
    margin-bottom: 1.25rem;
  }

  /* The ladder component stacks chart over table, which is a page layout. On
     a wide slide they sit side by side; the table keeps its own scroll box. */
  .chart {
    min-width: 0;
  }
  .chart :global(.cl-embed-inner) {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem 1.5rem;
    align-items: start;
    max-width: none;
  }
  @media (min-width: 1100px) {
    .chart :global(.cl-embed-inner) {
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    }
  }
  .chart :global(.cl-panel) {
    margin: 0;
    min-width: 0;
  }
  .chart :global(.cl-table),
  .chart :global(.cl-caption) {
    font-size: 0.78rem;
  }
  .chart :global(.cl-tablewrap) {
    margin: 0;
    min-width: 0;
  }
</style>
