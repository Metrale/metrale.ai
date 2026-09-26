<script>
  // The proof section. The concurrency ladder is the strongest verified
  // artifact the project owns, so it is the section's centrepiece: a headline
  // comparison against the matched vLLM configuration, the chart itself
  // (ConcurrencyLadder, untouched), the conditions the claim holds under,
  // the entry point to the benchmark dashboard, and the trust signals beside
  // the release-gate receipt. Every figure is read from generated JSON.
  import { verified, verifiedAnchor, gateSrcUrl, issuesUrl } from '$lib/data.js';
  import bench from '$lib/benchmarks.generated.json';
  import ladder from '$lib/ladder.generated.json';
  import counts from '$lib/live.generated.json';
  import { headroom, signed } from '$lib/ladder.js';
  import Receipt from './Receipt.svelte';
  import ConcurrencyLadder from './ConcurrencyLadder.svelte';
  import DashboardEntry from './engine/bench/DashboardEntry.svelte';
  import { caveatsOf, fill, ladderFacts } from './engine/bench/ladder-facts.js';

  const facts = ladderFacts(ladder);
  const caveats = caveatsOf(ladder, verified.caveats);
  // Derived from the committed ladder, so regenerating it rewrites this
  // sentence rather than leaving prose asserting a gap that closed.
  const top = headroom(ladder.rows);
  const stamp = fill(verified.stamp, { sha: bench.generated_sha, date: bench.generated_date });
  const signedBody = fill(verified.trust.signed.body, {
    signed: counts.gates.signed,
    records: counts.gates.records,
    newest: counts.gates.newest,
  });
  const h = verified.headline;
</script>

<section id="verified" class="av av-section av-section-alt av-sx-green">
  <div class="av-container">
    <div class="av-head-split">
      <div>
        <p class="av-eyebrow">{verified.label}</p>
        <h2 class="av-h2" style="max-width:24ch">{verified.title}</h2>
        <p class="av-lede">{verified.sub}</p>
      </div>
      <a class="av-kicker eg-stamp" href={ladder.results_doc_url} target="_blank" rel="noopener">
        <span class="av-dot"></span>
        {stamp}
      </a>
    </div>

    <div class="av-grid av-grid-3 eg-headline">
      <div class="av-tile">
        <span class="av-tile-label">{fill(h.ratio.label, facts)}</span>
        <div class="av-num">{facts.ratio}×</div>
        <p>{fill(h.ratio.body, facts)}</p>
      </div>
      <div class="av-tile">
        <span class="av-tile-label">{fill(h.throughput.label, facts)}</span>
        <div class="av-num av-num-plain">{facts.engine}<small> {h.throughput.unit}</small></div>
        <p>{fill(h.throughput.body, facts)}</p>
      </div>
      <div class="av-tile">
        <span class="av-tile-label">{fill(h.rungs.label, facts)}</span>
        <div class="av-num av-num-plain">{facts.won}/{facts.rungs}</div>
        <p>{fill(h.rungs.body, facts)}</p>
      </div>
    </div>

    <div class="eg-ladder">
      <ConcurrencyLadder embedded />
    </div>

    <div class="eg-reading av-grid av-grid-2">
      {#if top}
        <div class="av-card av-card-accent">
          <h3>{verified.scale.title}</h3>
          <p>{verified.scale.lead}</p>
          <p class="eg-figure">
            From C={top.from} to C={top.to}, Metrale Engine adds
            <strong class="eg-up">{signed(top.engine)}</strong> throughput while
            {top.label} adds <strong class="eg-flat">{signed(top.baseline)}</strong>.
          </p>
          <p>{verified.scale.tail}</p>
        </div>
      {/if}
      <div class="eg-caveats">
        <p class="av-kicker">{verified.caveats.kicker}</p>
        <dl>
          {#each caveats as c (c.label)}
            <div>
              <dt>{c.label}</dt>
              <dd>{c.text}</dd>
            </div>
          {/each}
        </dl>
      </div>
    </div>

    <DashboardEntry />

    <div class="av-split av-split-wide eg-trust">
      <div class="eg-trust-list">
        <article class="eg-trust-item">
          <h3>{verified.trust.signed.title}</h3>
          <p>{signedBody}</p>
          <a class="av-link" href={verified.trust.signed.url} target="_blank" rel="noopener"
            >{verified.trust.signed.cta} <span class="av-arrow">↗</span></a
          >
        </article>
        <article class="eg-trust-item">
          <h3>{verified.trust.gate.title}</h3>
          <p>{bench.methodology}</p>
          <p class="eg-mech">{verified.mechanism}</p>
          <p class="eg-links">
            <a class="av-link" href={verifiedAnchor} target="_blank" rel="noopener"
              >{verified.trust.gate.cta} <span class="av-arrow">↗</span></a
            >
            <a class="av-link" href={gateSrcUrl} target="_blank" rel="noopener"
              >{verified.trust.gate.ctaSource} <span class="av-arrow">↗</span></a
            >
          </p>
        </article>
        <article class="eg-trust-item">
          <h3>{verified.trust.reproduce.title}</h3>
          <p>{verified.trust.reproduce.body}</p>
          <p class="eg-links">
            <a class="av-link" href={ladder.results_doc_url} target="_blank" rel="noopener"
              >{verified.trust.reproduce.cta} <span class="av-arrow">↗</span></a
            >
          </p>
          <p class="av-small eg-challenge">
            {verified.challengeLine}
            <a class="av-link" href={issuesUrl} target="_blank" rel="noopener">{verified.challengeCta} <span class="av-arrow">↗</span></a>
          </p>
        </article>
      </div>
      <div class="eg-receipt">
        <Receipt source="gate" />
      </div>
    </div>
  </div>
</section>

<style>
  .eg-stamp {
    align-self: flex-start;
    margin-top: 0.4rem;
    text-decoration: none;
    white-space: nowrap;
    padding: 0.45rem 0.85rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--card);
    transition: border-color 0.18s;
  }
  .eg-stamp:hover {
    border-color: var(--accent);
    color: var(--t2);
  }
  .eg-headline small {
    margin-left: 0.4rem;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--t3);
    letter-spacing: 0;
  }
  .eg-headline .av-num {
    white-space: nowrap;
  }
  /* The embedded ladder brings its own h3 and subtitle; size them to this
     section's scale so the chart reads as the section's figure. Its chart,
     table and provenance are untouched. */
  .eg-ladder {
    margin-top: 2.5rem;
  }
  .eg-ladder :global(.cl-embed) {
    margin-top: 0;
  }
  .eg-ladder :global(.cl-h) {
    font-size: clamp(1.25rem, 2vw, 1.6rem);
    letter-spacing: -0.02em;
    line-height: 1.2;
  }
  .eg-ladder :global(.cl-sub) {
    margin: 0.8rem 0 1.4rem;
    color: var(--t2);
  }
  .eg-ladder :global(.cl-panel) {
    border-radius: var(--av-radius);
    box-shadow: var(--av-shadow);
  }
  .eg-ladder :global(.cl-toggle) {
    border-radius: 999px;
    padding: 0.55rem 1rem;
  }
  .eg-reading {
    margin-top: 2.5rem;
    align-items: start;
  }
  .eg-reading .av-card h3 {
    font-size: 1.12rem;
  }
  .eg-reading .av-card p + p {
    margin-top: 0.8rem;
  }
  .eg-reading .av-card p.eg-figure {
    color: var(--t1);
    border-left: 3px solid var(--sx);
    padding-left: 0.9rem;
  }
  .eg-up {
    color: var(--sx-text);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
  /* Deliberately not red. The baseline flattening is a measurement, not a
     failure, and colouring it as an error reads as a taunt rather than a result. */
  .eg-flat {
    color: var(--t3);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
  .eg-caveats {
    padding: 0.25rem 0 0 0.25rem;
  }
  .eg-caveats dl {
    margin: 1.1rem 0 0;
    display: grid;
    gap: 0.85rem;
  }
  .eg-caveats dl > div {
    display: grid;
    grid-template-columns: 9.5rem minmax(0, 1fr);
    gap: 0.9rem;
    padding-top: 0.85rem;
    border-top: 1px solid var(--border);
  }
  .eg-caveats dt {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--sx-text);
    padding-top: 0.2rem;
  }
  .eg-caveats dd {
    margin: 0;
    font-size: 0.92rem;
    color: var(--t2);
    line-height: 1.55;
    overflow-wrap: anywhere;
  }
  .eg-trust {
    margin-top: 3rem;
    align-items: start;
  }
  .eg-trust-list {
    display: grid;
    gap: 1.5rem;
  }
  .eg-trust-item {
    padding-top: 1.4rem;
    border-top: 1px solid var(--border-strong);
  }
  .eg-trust-item h3 {
    font-size: 1.05rem;
    letter-spacing: -0.01em;
    margin-bottom: 0.5rem;
  }
  .eg-trust-item p {
    font-size: 0.94rem;
    color: var(--t2);
    line-height: 1.6;
  }
  .eg-trust-item .av-link,
  .eg-links {
    margin-top: 0.7rem;
    font-size: 0.9rem;
  }
  .eg-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.4rem;
  }
  .eg-links .av-link {
    margin-top: 0;
  }
  .eg-trust-item p.eg-mech {
    margin-top: 0.7rem;
    font-weight: 600;
    color: var(--t1);
    border-left: 3px solid var(--sx);
    padding-left: 0.9rem;
  }
  .eg-challenge {
    margin-top: 0.9rem;
  }
  .eg-challenge .av-link {
    font-size: 0.84rem;
    margin: 0 0 0 0.3rem;
  }
  .eg-receipt {
    justify-self: end;
    width: 100%;
    max-width: 460px;
    position: sticky;
    top: 90px;
  }
  @media (max-width: 900px) {
    .eg-stamp {
      white-space: normal;
    }
    .eg-caveats dl > div {
      grid-template-columns: minmax(0, 1fr);
      gap: 0.3rem;
    }
    .eg-receipt {
      justify-self: start;
      position: static;
      max-width: none;
    }
  }
</style>
