<!--
  One turn in the conversation. A visitor's turn is a quiet line with a rule.
  The guide's turn is a print: the thinking strip first, live while the answer
  is being worked out (a stopwatch, the phase, what was searched, the model's
  own thinking streaming under it), which folds to one line when the answer
  starts; then the answer as markdown; then the sources, numbered to match the
  citations; then one line of telemetry, from the Worker's own usage figures.
  Passing `live` (prime.turn from state.svelte.js) renders the turn in flight.
-->
<script>
  import { renderMarkdown } from './markdown.js';
  import { prime as copy } from './copy.js';
  import { TICK_MS } from './config.js';
  import { cachedShare, tokensPerSecond } from './state.svelte.js';
  import PrimeMark from './PrimeMark.svelte';

  let { message = null, live = null } = $props();

  const reasoning = $derived(live ? live.reasoning : (message?.reasoning ?? ''));
  const answer = $derived(live ? live.answer : (message?.text ?? ''));
  const tools = $derived(live ? live.tools : (message?.tools ?? []));
  const sources = $derived(live ? live.sources : (message?.sources ?? []));
  const usage = $derived(live ? null : (message?.usage ?? null));
  const writing = $derived(answer.length > 0);
  const thinkMs = $derived(live ? 0 : (message?.thinkMs ?? 0));

  // The stopwatch. Ticks only while this turn is in flight and the answer has
  // not started, so an idle page runs nothing.
  let now = $state(0);
  $effect(() => {
    if (!live || writing) return;
    now = performance.now();
    const t = setInterval(() => (now = performance.now()), TICK_MS);
    return () => clearInterval(t);
  });
  const elapsed = $derived(
    live ? (writing && live.answerAt ? live.answerAt - live.startedAt : Math.max(0, now - live.startedAt)) : thinkMs
  );
  const secs = $derived((elapsed / 1000).toFixed(1));

  const phaseLabel = $derived.by(() => {
    if (!live) return '';
    if (live.phase === 'searching' && live.detail) return `${copy.phase.searching} ${live.detail}`;
    if (live.phase === 'tool' && live.detail) return live.detail;
    return copy.phase[live.phase] ?? copy.phase.reading;
  });

  // The trace streams open until the answer starts, then folds. A click after that pins the choice.
  let traceChoice = $state(null);
  const traceOpen = $derived(traceChoice ?? !writing);
  const hasTrace = $derived(Boolean(reasoning || tools.length));
  const steps = $derived(tools.length);

  let traceEl = $state(null);
  $effect(() => {
    void reasoning;
    if (live && traceEl) traceEl.scrollTop = traceEl.scrollHeight;
  });

  // A citation in the answer highlights its source below.
  let hot = $state(0);
  function onBodyClick(e) {
    const cite = e.target.closest?.('.pr-cite');
    if (!cite) return;
    const n = Number(cite.dataset.n);
    hot = hot === n ? 0 : n;
    const el = e.currentTarget.parentElement.querySelector(`[data-src="${n}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  const cited = $derived(sources.filter((s) => s.cited));
  const read = $derived(sources.filter((s) => !s.cited));

  let copied = $state(false);
  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(answer);
      copied = true;
      setTimeout(() => (copied = false), 1600);
    } catch {
      copied = false;
    }
  }
  const fmtMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`);
  const fmtUsd = (n) => (n >= 0.01 ? `$${n.toFixed(3)}` : `$${n.toFixed(4)}`);
  const host = (url) => {
    try {
      const u = new URL(url);
      return u.pathname === '/' ? u.host : `${u.host}${u.pathname}${u.hash}`;
    } catch {
      return url;
    }
  };
</script>

{#if message?.role === 'user'}
  <div class="pr-user"><p>{message.text}</p></div>
{:else}
  <article class="pr-print" class:is-live={Boolean(live)} class:is-error={Boolean(message?.error)} aria-live={live ? 'polite' : undefined}>
    <div class="pr-print-head">
      <PrimeMark size={16} class="pr-print-mark" />
      <span class="pr-print-name">{copy.mark}</span>
    </div>

    {#if live || hasTrace}
      <div class="pr-think" data-open={traceOpen}>
        {#if writing || !live}
          <button
            type="button"
            class="pr-think-toggle"
            aria-expanded={traceOpen}
            onclick={() => (traceChoice = !traceOpen)}
            disabled={!hasTrace}
          >
            <span class="pr-think-clock">{copy.thinking.took} {secs}s</span>
            {#if steps}<span class="pr-think-sep" aria-hidden="true">·</span><span>{steps} {copy.thinking.steps}</span>{/if}
            {#if hasTrace}<span class="pr-think-sep" aria-hidden="true">·</span><span class="pr-think-act"
                >{traceOpen ? copy.thinking.hide : copy.thinking.show}</span
              >{/if}
          </button>
        {:else}
          <p class="pr-think-line">
            <span class="pr-think-clock" aria-hidden="true">{secs}s</span>
            <span class="pr-think-phase">{phaseLabel}</span>
            <video
              class="pr-think-cube"
              src="/media/brand/mcube-96.webm"
              poster="/media/brand/mcube-96-poster.png"
              autoplay
              muted
              loop
              playsinline
              aria-hidden="true"><source src="/media/brand/mcube-96.mp4" type="video/mp4" /></video
            >
            <span class="pr-think-pulse" aria-hidden="true"></span>
          </p>
        {/if}
        {#if traceOpen && hasTrace}
          <div class="pr-think-body">
            {#if tools.length}
              <ol class="pr-steps">
                {#each tools as t, i (i)}
                  <li>
                    <span class="pr-step-name">{t.name.replace(/_/g, ' ')}</span> <span class="pr-step-sum">{t.summary}</span>
                    <span class="pr-step-ms">{t.ms}ms</span>
                  </li>
                {/each}
              </ol>
            {/if}
            {#if reasoning}
              <p class="pr-trace" bind:this={traceEl}>{reasoning}</p>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    {#if answer}
      <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- renderMarkdown escapes all input first (prime/markdown.js) -->
      <div class="pr-body" onclick={onBodyClick}>{@html renderMarkdown(answer)}</div>
    {:else if message?.error}
      <p class="pr-err" role="alert">{copy.errors[message.error.kind] ?? copy.errors.internal}</p>
    {/if}

    {#if !live && sources.length}
      <div class="pr-sources">
        <p class="pr-sources-h">{copy.sources.heading}</p>
        <ol>
          {#each cited as s (s.n)}
            <li data-src={s.n} class:is-hot={hot === s.n}>
              <span class="pr-src-n">[{s.n}]</span>
              {#if s.url}<a
                  href={s.url}
                  target={/^https?:\/\/(?!atlascybernetics\.ai)/.test(s.url) ? '_blank' : undefined}
                  rel={/^https?:/.test(s.url) ? 'noopener' : undefined}
                  >{s.title}{#if s.section}<span class="pr-src-sec"> · {s.section}</span>{/if}</a
                >{:else}<span
                  >{s.title}{#if s.section}<span class="pr-src-sec"> · {s.section}</span>{/if}</span
                >{/if}
              {#if s.tier === 'partner'}<span class="pr-src-tier">{copy.sources.partner}</span>{:else if s.url}<span class="pr-src-host"
                  >{host(s.url)}</span
                >{/if}
            </li>
          {/each}
        </ol>
        {#if read.length}
          <details class="pr-sources-more">
            <summary>{copy.sources.more} {read.length}</summary>
            <ol>
              {#each read as s (s.n)}
                <li data-src={s.n}>
                  <span class="pr-src-n">[{s.n}]</span>{#if s.url}<a href={s.url} rel="noopener"
                      >{s.title}{#if s.section}<span class="pr-src-sec"> · {s.section}</span>{/if}</a
                    >{:else}<span>{s.title}</span>{/if}
                </li>
              {/each}
            </ol>
          </details>
        {/if}
      </div>
    {/if}

    {#if !live && (usage || answer)}
      <div class="pr-meta">
        {#if usage}
          <span class="pr-meta-line"
            >{usage.model ?? ''}{usage.effort ? ` · ${usage.effort}` : ''} · {copy.telemetry.first}
            {fmtMs(usage.ttft_ms ?? 0)} · {copy.telemetry.total}
            {fmtMs(usage.total_ms ?? 0)} · {(usage.tokens ?? 0).toLocaleString('en-US')}
            {copy.telemetry.tokens}{cachedShare(usage) !== null
              ? ` · ${Math.round(cachedShare(usage) * 100)}% ${copy.telemetry.cached}`
              : ''}{tokensPerSecond(usage) !== null ? ` · ${Math.round(tokensPerSecond(usage))} ${copy.telemetry.rate}` : ''} · {fmtUsd(
              usage.cost_usd ?? 0
            )}</span
          >
        {/if}
        {#if answer}<button type="button" class="pr-copy" onclick={copyAnswer}>{copied ? copy.copied : copy.copy}</button>{/if}
      </div>
    {/if}
  </article>
{/if}

<style>
  .pr-user {
    display: flex;
    gap: 0.7rem;
    padding: 0.15rem 0 0.15rem 0.85rem;
    border-left: 2px solid var(--border-strong);
    min-width: 0;
  }
  .pr-user p {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--t1);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  /* min-width: 0 and overflow-wrap everywhere words can be long: a pasted URL
     must fold inside the column, never widen it. */
  .pr-print {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.6rem;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .pr-print-head {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    color: var(--t3);
  }
  .pr-print :global(.pr-print-mark) {
    color: var(--t2);
  }
  .pr-print.is-live .pr-print-head {
    color: var(--accent);
  }
  .pr-print.is-live :global(.pr-print-mark) {
    color: var(--accent);
  }

  /* the thinking strip */
  .pr-think {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--t3);
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg2);
    overflow: hidden;
  }
  .pr-think-line,
  .pr-think-toggle {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    margin: 0;
    padding: 0.5rem 0.7rem;
    width: 100%;
    text-align: left;
    background: none;
    border: 0;
    font: inherit;
    color: inherit;
  }
  .pr-think-toggle {
    cursor: pointer;
  }
  .pr-think-toggle:disabled {
    cursor: default;
  }
  .pr-think-toggle:not(:disabled):hover {
    color: var(--t2);
  }
  .pr-think-toggle:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .pr-think-clock {
    font-variant-numeric: tabular-nums;
    color: var(--t2);
    min-width: 3.2em;
  }
  .pr-think-phase {
    color: var(--t2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pr-think-act {
    color: var(--accent);
  }
  .pr-think-sep {
    opacity: 0.6;
  }
  /* While it thinks: the cube loop from the brand explorations (a placeholder, two
     files under static/media/brand to swap), and under reduced motion a still dot. */
  .pr-think-cube {
    margin-left: auto;
    width: 22px;
    height: 22px;
    border-radius: 5px;
    flex-shrink: 0;
    object-fit: cover;
    background: var(--sunk);
  }
  .pr-think-pulse {
    display: none;
    margin-left: auto;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
    flex-shrink: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .pr-think-cube {
      display: none;
    }
    .pr-think-pulse {
      display: inline-block;
      opacity: 0.8;
    }
  }
  .pr-think-body {
    border-top: 1px solid var(--border);
    padding: 0.5rem 0.7rem 0.6rem;
    display: grid;
    gap: 0.45rem;
  }
  .pr-steps {
    margin: 0;
    padding: 0 0 0 1.1rem;
    display: grid;
    gap: 0.2rem;
  }
  .pr-step-name {
    color: var(--t2);
  }
  .pr-step-sum {
    color: var(--t3);
  }
  .pr-step-ms {
    color: var(--t3);
    opacity: 0.7;
  }
  .pr-trace {
    margin: 0;
    max-height: 96px;
    overflow-y: auto;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    line-height: 1.5;
    color: var(--t3);
    font-size: 0.72rem;
  }
  .pr-print:not(.is-live) .pr-trace {
    max-height: 220px;
  }

  /* the answer */
  .pr-body {
    font-size: 0.95rem;
    line-height: 1.58;
    color: var(--t1);
    overflow-wrap: anywhere;
  }
  .pr-body :global(p) {
    margin: 0 0 0.7rem;
  }
  .pr-body :global(p:last-child) {
    margin-bottom: 0;
  }
  .pr-body :global(h3),
  .pr-body :global(h4) {
    margin: 0.9rem 0 0.35rem;
    font-size: 0.98rem;
    font-weight: 650;
    line-height: 1.3;
  }
  .pr-body :global(h3:first-child),
  .pr-body :global(h4:first-child) {
    margin-top: 0;
  }
  .pr-body :global(ul),
  .pr-body :global(ol) {
    margin: 0 0 0.7rem;
    padding-left: 1.25rem;
  }
  .pr-body :global(li) {
    margin: 0.2rem 0;
  }
  .pr-body :global(li ul),
  .pr-body :global(li ol) {
    margin: 0.2rem 0 0;
  }
  .pr-body :global(a) {
    color: var(--accent);
    font-weight: 600;
    text-decoration: none;
  }
  .pr-body :global(a:hover) {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .pr-body :global(code) {
    font-family: var(--font-mono);
    font-size: 0.84em;
    padding: 0.1em 0.35em;
    border-radius: 5px;
    background: var(--sunk);
    color: var(--t1);
  }
  .pr-body :global(pre.pr-fence) {
    margin: 0 0 0.7rem;
    padding: 0.7rem 0.8rem;
    border-radius: 10px;
    background: var(--sunk);
    border: 1px solid var(--border);
    overflow-x: auto;
  }
  .pr-body :global(pre.pr-fence code) {
    padding: 0;
    background: none;
    font-size: 0.78rem;
    line-height: 1.5;
  }
  .pr-body :global(blockquote) {
    margin: 0 0 0.7rem;
    padding: 0.2rem 0 0.2rem 0.8rem;
    border-left: 2px solid var(--border-strong);
    color: var(--t2);
  }
  .pr-body :global(hr) {
    border: 0;
    border-top: 1px solid var(--border);
    margin: 0.8rem 0;
  }
  .pr-body :global(.pr-table) {
    overflow-x: auto;
    margin: 0 0 0.7rem;
  }
  .pr-body :global(table) {
    border-collapse: collapse;
    font-size: 0.86rem;
    min-width: 100%;
  }
  /* Words in a cell never break mid-word: a name column read "Tho mas Brau n"
     once the column got narrow. A wide table scrolls inside .pr-table instead. */
  .pr-body :global(th),
  .pr-body :global(td) {
    overflow-wrap: normal;
    word-break: normal;
    hyphens: none;
  }
  .pr-body :global(td:first-child),
  .pr-body :global(th:first-child) {
    white-space: nowrap;
  }
  .pr-body :global(th),
  .pr-body :global(td) {
    padding: 0.35rem 0.6rem;
    border-bottom: 1px solid var(--border);
    text-align: left;
    vertical-align: top;
  }
  .pr-body :global(th) {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--t3);
    font-weight: 600;
  }
  .pr-body :global(td) {
    font-variant-numeric: tabular-nums;
  }
  .pr-body :global(strong) {
    font-weight: 650;
  }
  .pr-body :global(.pr-cite) {
    font-family: var(--font-mono);
    font-size: 0.66em;
    color: var(--accent);
    cursor: pointer;
    margin-left: 0.1em;
    vertical-align: super;
    line-height: 0;
  }
  .pr-body :global(.pr-cite:hover) {
    text-decoration: underline;
  }
  .pr-print.is-live .pr-body::after {
    content: '';
    display: inline-block;
    width: 0.5em;
    height: 1em;
    margin-left: 0.15em;
    vertical-align: text-bottom;
    background: var(--accent);
    animation: pr-caret 1s steps(2) infinite;
  }
  @keyframes pr-caret {
    50% {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pr-print.is-live .pr-body::after {
      animation: none;
    }
  }
  .pr-err {
    margin: 0;
    font-size: 0.9rem;
    color: var(--red);
  }

  /* the sources */
  .pr-sources {
    border-top: 1px dashed var(--border-strong);
    padding-top: 0.55rem;
    font-size: 0.8rem;
  }
  .pr-sources-h {
    margin: 0 0 0.3rem;
    font-family: var(--font-mono);
    font-size: 0.64rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--t3);
  }
  .pr-sources ol {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.2rem;
  }
  .pr-sources li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.2rem 0.5rem;
    padding: 0.15rem 0.3rem;
    margin: 0 -0.3rem;
    border-radius: 6px;
    transition: background 0.2s;
  }
  .pr-sources li.is-hot {
    background: var(--accent-soft);
  }
  .pr-src-n {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--t3);
  }
  .pr-sources a {
    color: var(--t1);
    font-weight: 600;
    text-decoration: none;
  }
  .pr-sources a:hover {
    color: var(--accent);
  }
  .pr-src-sec {
    color: var(--t2);
    font-weight: 400;
  }
  .pr-src-host,
  .pr-src-tier {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 0.64rem;
    color: var(--t3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 45%;
  }
  .pr-src-tier {
    color: var(--ch-gold-text);
  }
  .pr-sources-more {
    margin-top: 0.35rem;
  }
  .pr-sources-more summary {
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    color: var(--t3);
  }
  .pr-sources-more ol {
    margin-top: 0.3rem;
  }

  /* the telemetry line */
  .pr-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    color: var(--t3);
    font-variant-numeric: tabular-nums;
  }
  .pr-meta-line {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pr-copy {
    flex-shrink: 0;
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.15rem 0.5rem;
    font: inherit;
    color: var(--t3);
    cursor: pointer;
  }
  .pr-copy:hover {
    color: var(--t1);
    border-color: var(--border-strong);
  }
</style>
