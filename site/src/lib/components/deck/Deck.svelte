<script>
  // The deck engine. Slides register themselves through context in DOM order,
  // so an act can be split across files without a slide manifest to keep in
  // sync — the composition IS the manifest.
  //
  // No presentation library: a stage is a grid cell, slide-to-slide motion is
  // a CSS transition, and a command is a <pre>. Deep-linking goes through
  // $app/navigation rather than a bare history.replaceState, which would null
  // the history metadata SvelteKit stores there and break Back.
  //
  // The stage sits UNDER the site header, not behind it. The header is sticky
  // at z-index 100 and --nav-h tall (it declares the variable); the deck
  // starts where the header ends, so no slide's first line can sit beneath it
  // at any width. Inside the stage a slide that is taller than the window
  // scrolls vertically on its own; a component wider than the slide scrolls
  // horizontally inside itself. The document never scrolls in either axis.
  import { setContext } from 'svelte';
  import { browser } from '$app/environment';
  import { replaceState } from '$app/navigation';
  import MetraleLockup from '$shared/components/MetraleLockup.svelte';

  let { title = 'Verification steps', stamp = '', children } = $props();

  let index = $state(0);
  let total = $state(0);

  // Registration happens during child init, which Svelte runs in DOM order.
  let seq = 0;
  setContext('deck', {
    register() {
      const n = seq++;
      total = seq;
      return n;
    },
    current: () => index,
  });

  const pad = (n) => String(n).padStart(2, '0');

  // The hash, not a query param: this route is prerendered, and touching
  // url.searchParams during prerender is a build error. The hash never reaches
  // the prerenderer at all. Read at mount AND on every hashchange, so a link
  // to #7 works from inside the page as well as from outside it.
  function readHash() {
    const n = Number(location.hash.slice(1));
    if (Number.isInteger(n) && n >= 1 && n <= total) index = n - 1;
  }
  $effect(() => {
    if (!browser) return;
    readHash();
  });

  function go(n) {
    const next = Math.max(0, Math.min(total - 1, n));
    if (next === index) return;
    index = next;
    replaceState(`#${next + 1}`, {});
  }

  function onkeydown(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    // Up and Down are left to the slide, which may scroll; the deck moves on
    // the horizontal keys, the page keys and the space bar.
    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
      case ' ':
        go(index + 1);
        break;
      case 'ArrowLeft':
      case 'PageUp':
        go(index - 1);
        break;
      case 'Home':
        go(0);
        break;
      case 'End':
        go(total - 1);
        break;
      case 'f':
        document.documentElement.requestFullscreen?.();
        break;
      case 'Escape':
        document.exitFullscreen?.();
        break;
      default:
        return;
    }
    e.preventDefault();
  }
</script>

<svelte:window {onkeydown} onhashchange={readHash} />
<svelte:head><title>{title} · Metrale</title></svelte:head>

<div class="dk" data-slide={index + 1} data-total={total}>
  <p class="dk-live" aria-live="polite">Slide {index + 1} of {total}</p>

  <div class="dk-stage">
    {@render children()}
  </div>

  <button type="button" class="dk-edge dk-edge-prev" onclick={() => go(index - 1)} disabled={index === 0} aria-label="Previous slide">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
  </button>
  <button type="button" class="dk-edge dk-edge-next" onclick={() => go(index + 1)} disabled={index === total - 1} aria-label="Next slide">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
  </button>

  <footer class="dk-chrome">
    <a class="dk-mark" href="/" aria-label="Metrale home"><MetraleLockup kind="mark" /></a>
    <span class="dk-stamp mono">{stamp}</span>
    <div class="dk-nav">
      <button type="button" class="dk-btn" onclick={() => go(index - 1)} disabled={index === 0}>Previous</button>
      <span class="dk-count mono" aria-hidden="true">{pad(index + 1)} / {pad(total)}</span>
      <button type="button" class="dk-btn" onclick={() => go(index + 1)} disabled={index === total - 1}>Next</button>
    </div>
    <!-- One segment per slide, so the reader can see where they are in the deck. -->
    <div class="dk-rail" aria-hidden="true">
      {#each { length: total }, n}
        <i class="dk-seg" class:on={n <= index}></i>
      {/each}
    </div>
  </footer>
</div>

<style>
  /* The deck fills the window below the header. --nav-h is declared by the
     site header itself (SiteNav.svelte), so the two cannot disagree. The
     stage is a level of its own above the rest of the document: the footer
     comes after the deck in the page and would otherwise paint through. */
  .dk {
    position: fixed;
    top: var(--nav-h);
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    background: var(--bg);
    color: var(--t1);
    overflow: hidden;
    --dk-gutter: clamp(16px, 4vw, 24px);
    --dk-max: 1180px;
    --dk-chrome-h: 56px;
  }

  /* A wash of copper, low enough to read as depth rather than decoration. */
  .dk::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(110% 70% at 6% -10%, color-mix(in oklab, var(--sx) 12%, transparent), transparent 62%),
      radial-gradient(80% 60% at 100% 110%, color-mix(in oklab, var(--sx) 7%, transparent), transparent 60%);
    transition: background 620ms ease;
  }

  /* Every slide occupies the same cell; the active one is visible. */
  .dk-stage {
    position: relative;
    display: grid;
    min-height: 0;
  }
  .dk-stage > :global(*) {
    grid-area: 1 / 1;
  }

  /* Edge navigation, a chevron each side, on windows wide enough that they
     do not sit over the content. Quiet until the pointer is near. */
  .dk-edge {
    position: absolute;
    top: calc(50% - var(--dk-chrome-h) / 2);
    translate: 0 -50%;
    width: 44px;
    height: 72px;
    display: none;
    place-items: center;
    border: 0;
    border-radius: 10px;
    background: none;
    color: var(--t2);
    cursor: pointer;
    opacity: 0.35;
    transition: opacity 200ms ease;
  }
  .dk-edge svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .dk-edge-prev {
    left: 6px;
  }
  .dk-edge-next {
    right: 6px;
  }
  .dk-edge:hover:not(:disabled) {
    opacity: 1;
    color: var(--sx-text);
  }
  .dk-edge:disabled {
    opacity: 0.08;
    cursor: default;
  }
  .dk-edge:focus-visible {
    opacity: 1;
    outline: 2px solid var(--sx);
    outline-offset: -4px;
  }
  @media (min-width: 1400px) {
    .dk-edge {
      display: grid;
    }
  }

  /* The bar under every slide: the mark, the build stamp, the controls, the
     rail. It is the deck's own footer; the site footer is below the stage
     and never seen while the deck is open. */
  .dk-chrome {
    position: relative;
    z-index: 1;
    margin: 0;
    padding: 0 var(--dk-gutter);
    height: var(--dk-chrome-h);
    display: flex;
    align-items: center;
    gap: 1rem;
    border-top: 1px solid var(--border);
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    font-size: 0.78rem;
    color: var(--t3);
  }
  .dk-mark {
    display: block;
    width: 26px;
    flex-shrink: 0;
    opacity: 0.9;
  }
  .dk-mark :global(svg) {
    width: 100%;
    height: auto;
    display: block;
  }
  .dk-stamp {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    letter-spacing: 0.02em;
  }
  .dk-nav {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-shrink: 0;
  }
  .dk-btn {
    font: inherit;
    font-weight: 600;
    font-size: 0.8rem;
    color: var(--t1);
    background: var(--card);
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    padding: 0.4rem 0.9rem;
    cursor: pointer;
    transition:
      border-color 160ms ease,
      color 160ms ease;
  }
  .dk-btn:hover:not(:disabled) {
    border-color: var(--sx);
    color: var(--sx-text);
  }
  .dk-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .dk-btn:focus-visible {
    outline: 2px solid var(--sx);
    outline-offset: 2px;
  }
  .dk-count {
    color: var(--t2);
    letter-spacing: 0.06em;
    font-variant-numeric: tabular-nums;
  }
  .dk-rail {
    position: absolute;
    left: 0;
    right: 0;
    top: -1px;
    height: 2px;
    display: flex;
    gap: 2px;
  }
  .dk-seg {
    flex: 1;
    background: var(--border);
    transition: background 320ms ease;
  }
  .dk-seg.on {
    background: var(--sx);
  }

  .dk-live {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  @media (max-width: 600px) {
    .dk-stamp {
      display: none;
    }
    .dk-nav {
      flex: 1;
      justify-content: space-between;
    }
  }

  /* Print is the PDF export. Every slide is already in the DOM — that is the
     whole reason slides are hidden with visibility rather than {#if} — so this
     is a stylesheet, not a feature. */
  @media print {
    .dk {
      position: static;
      display: block;
      overflow: visible;
    }
    .dk-stage {
      display: block;
    }
    .dk::before,
    .dk-edge,
    .dk-chrome {
      display: none;
    }
  }
</style>
