<script>
  // The opener. Left, the platform's words for the engine; right, the benchmark
  // story inside the front page's signature frame: three figures, the receipt,
  // and the control that opens the dashboard. Every figure comes from the
  // generated ladder, never from copy.
  //
  // Styled by metrale.css (imported by the /engine route) on this section's
  // own `.av` scope. The dashboard modal below is rendered OUTSIDE the section,
  // so nothing under `.av` reaches its charts.
  import { modal } from '$lib/modal.js';
  import { hero, githubUrl } from '$lib/data.js';
  import ladder from '$lib/ladder.generated.json';
  import Receipt from './Receipt.svelte';

  const rows = [...ladder.rows].sort((a, b) => a.c - b.c);
  const top = rows[rows.length - 1];
  const best = top.baselines.find((b) => b.id === top.best_baseline_id);
  const s = ladder.summary;
  const x = (v) => v.toFixed(3);
  const won = s.won === s.rungs ? 'Every published rung won' : `${s.won} of ${s.rungs} published rungs won`;
  const claim = `${won}, C=${rows[0].c} to C=${top.c}, ${x(s.min_ratio)}× to ${x(s.max_ratio)}× against ${best.label}.`;
  const build = ladder.series.find((series) => series.role === 'subject')?.build_public ?? '';
  const hues = ['av-sx-violet', 'av-sx-cyan', 'av-sx-green'];

  // The frame's ring turns only while the frame is on screen, the way reveal.js
  // gates it on the marketing pages. reveal.js lives in the marketing chunk,
  // which a developer page may not load (e2e/page-weight.spec.js), so the one
  // observer it needs is here.
  let frame = $state(null);
  $effect(() => {
    if (!frame || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.classList.toggle('is-live', e.isIntersecting);
    });
    io.observe(frame);
    return () => io.disconnect();
  });

  let dashboardOpen = $state(false);

  // PRPL "lazy-load": the dashboard is on-click only, so its component (and the
  // gate-records JSON it pulls in) stays out of the initial bundle. Hovering or
  // focusing the trigger starts the fetch early, so by click time the module is
  // usually already here; the skeleton in dashboard.css covers the rest.
  let Dashboard = $state(null);
  let dashboardError = $state(false);
  let dashboardModule = null;
  function preloadDashboard() {
    dashboardModule ??= import('./BenchmarkDashboard.svelte');
    return dashboardModule;
  }
  async function openDashboard() {
    dashboardOpen = true;
    try {
      Dashboard = (await preloadDashboard()).default;
    } catch {
      dashboardModule = null; // allow retry on next open
      dashboardError = true;
    }
  }
  function closeDashboard() {
    dashboardOpen = false;
    dashboardError = false;
  }
</script>

<!-- The loaded dashboard handles Escape itself; this covers the skeleton phase. -->
<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape' && dashboardOpen && !Dashboard) closeDashboard();
  }}
/>

<section id="top" class="av av-hero av-sx-violet eg-hero">
  <div class="av-glow av-glow-a" aria-hidden="true"></div>
  <div class="av-glow av-glow-b" aria-hidden="true"></div>
  <div class="av-container">
    <div class="av-hero-grid">
      <div class="av-hero-copy">
        <p class="av-eyebrow av-hero-kicker">{hero.kicker}</p>
        <ul class="av-pillars" aria-label="What Metrale Engine is">
          {#each hero.pillars as p, i}
            <li class="av-pill {hues[i]}"><i aria-hidden="true"></i>{p}</li>
          {/each}
        </ul>
        <h1 class="av-h1">{hero.headline[0]}<br /><span class="av-soft">{hero.headline[1]}</span></h1>
        <p class="av-lede av-lede-lg">{hero.sub}</p>
        <div class="av-hero-actions">
          <a class="av-btn av-btn-primary av-btn-lg" href="#run">{hero.primaryCta} <span class="av-arrow">→</span></a>
          <a class="av-btn av-btn-ghost av-btn-lg" href="#reach">{hero.secondaryCta}</a>
          <a class="av-link av-link-quiet eg-hero-github" href={githubUrl} target="_blank" rel="noopener">{hero.githubCta} ↗</a>
        </div>
        <p class="av-hero-claim">
          <strong>{claim}</strong>
          <span>{hero.claim.conditions}</span>
          <a class="av-link" href={ladder.results_doc_url} target="_blank" rel="noopener"
            >{hero.claim.logCta} <span class="av-arrow">↗</span></a
          >
        </p>
      </div>

      <div class="av-hero-art">
        <div class="av-frame" bind:this={frame}>
          <div class="eg-proof">
            <div class="eg-proof-head">
              <span class="av-kicker"><span class="av-dot"></span> {hero.art.kicker}</span>
              {#if build}<span class="av-chip av-chip-green">build {build}</span>{/if}
            </div>
            <dl class="eg-proof-stats">
              <div>
                <dt class="av-small">{hero.art.stats.ratio}</dt>
                <dd class="av-num">{x(top.ratio_vs_best)}×</dd>
              </div>
              <div>
                <dt class="av-small">{hero.art.stats.throughput}</dt>
                <dd class="av-num av-num-plain">{top.engine.toFixed(2)}</dd>
              </div>
              <div>
                <dt class="av-small">{hero.art.stats.rungs}</dt>
                <dd class="av-num av-num-plain">{s.won}/{s.rungs}</dd>
              </div>
            </dl>
            <div class="receipt-hit">
              <Receipt compact={true} />
              <button
                type="button"
                class="receipt-open-hint"
                onclick={openDashboard}
                onpointerenter={preloadDashboard}
                onfocus={preloadDashboard}
                aria-haspopup="dialog"
              >
                <span class="rh-glyph" aria-hidden="true">⤢</span>
                {hero.art.dashboardCta}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

{#if dashboardOpen}
  {#if Dashboard}
    <Dashboard onclose={closeDashboard} />
  {:else}
    <!-- Same .bd-backdrop/.bd classes as the real dialog: identical dimensions,
         so the swap from skeleton to dashboard causes zero layout shift. -->
    <div class="bd-backdrop" onclick={closeDashboard} role="presentation">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- The click handler only stops a click inside the dialog reaching the
           backdrop's close handler; it is not an interaction. Keyboard dismissal
           is Escape, handled on the window. -->
      <div
        class="bd bd-skeleton"
        role="dialog"
        aria-modal="true"
        aria-label="Benchmark dashboard, loading"
        aria-busy="true"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
        use:modal
      >
        {#if dashboardError}
          <p class="bd-skeleton-error">Couldn’t load the dashboard (network?). Close and try again.</p>
        {:else}
          <div class="bd-skeleton-bar" style="width: 38%"></div>
          <div class="bd-skeleton-bar" style="width: 62%"></div>
          <div class="bd-skeleton-chart"></div>
          <div class="bd-skeleton-chart"></div>
        {/if}
        <button type="button" class="bd-close bd-skeleton-close" onclick={closeDashboard} aria-label="Close dashboard">✕</button>
      </div>
    </div>
  {/if}
{/if}

<style>
  /* Two sentences, not one: at the front page's size the pair ran to eight lines
     beside the frame and pushed the receipt under the fold on a laptop. */
  .eg-hero .av-h1 {
    font-size: clamp(2.3rem, 4vw, 3.4rem);
  }
  /* The frame's inside. `.av-frame > *` gives it the sunk ground and the radius;
     this lays the story out inside it. */
  .eg-proof {
    padding: 1.35rem 1.4rem 1.5rem;
    display: grid;
    gap: 1.2rem;
  }
  .eg-proof-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .eg-proof-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
    margin: 0;
  }
  .eg-proof-stats > div {
    display: grid;
    gap: 0.35rem;
    padding-top: 0.8rem;
    border-top: 1px solid var(--border-strong);
  }
  .eg-proof-stats dt {
    order: 2;
  }
  .eg-proof-stats dd {
    margin: 0;
    font-size: clamp(1.5rem, 2.4vw, 2rem);
  }
  /* The receipt is the page's signature element and keeps its own card. Inside
     the frame it takes the frame's width, so its corner chip stays on its corner. */
  .eg-proof :global(.receipt-hit),
  .eg-proof :global(.receipt) {
    max-width: none;
  }
  .eg-hero-github {
    padding: 0 0.4rem;
  }
  @media (max-width: 480px) {
    .eg-proof {
      padding: 1rem 1rem 1.15rem;
    }
    .eg-proof-stats {
      gap: 0.6rem;
    }
    .eg-proof-stats dd {
      font-size: 1.3rem;
    }
  }
</style>
