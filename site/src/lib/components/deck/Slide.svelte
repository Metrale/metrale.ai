<script>
  // One slide. It takes its index from the deck at init, which means slides can
  // be written in whatever file the act lives in and reordered by moving the
  // markup — there is no numbering to maintain.
  //
  // A slide is a scroll container: taller content scrolls vertically inside
  // it, and the deck's stage never grows. Nothing here scrolls sideways; a wide
  // component (a command, a table, the chart) carries its own overflow-x box.
  import { getContext, untrack } from 'svelte';

  let { act = 'violet', eyebrow = '', title = '', lede = '', children } = $props();

  const deck = getContext('deck');
  const n = deck.register(untrack(() => act));
  const active = $derived(deck.current() === n);
</script>

<!-- A slide taller than the window scrolls; the keyboard reaches it through
     focus, which is why a section carries a tabindex here. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<section
  class="sl"
  class:sl-active={active}
  inert={!active}
  tabindex="0"
  aria-roledescription="slide"
  aria-label={title || `Slide ${n + 1}`}
  style="--sx: var(--ch-{act}); --sx-text: var(--ch-{act}-text)"
>
  <div class="sl-in">
    {#if eyebrow || title || lede}
      <header class="sl-head">
        {#if eyebrow}<p class="sl-eyebrow mono">{eyebrow}</p>{/if}
        {#if title}<h2 class="sl-title">{title}</h2>{/if}
        {#if lede}<p class="sl-lede">{lede}</p>{/if}
      </header>
    {/if}
    <div class="sl-body">
      {@render children?.()}
    </div>
  </div>
</section>

<style>
  /* app.css pads every <section> as a page section; a slide is not one. */
  .sl {
    position: relative;
    padding: 0;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    opacity: 0;
    visibility: hidden;
    translate: 1.5rem 0;
    transition:
      opacity 260ms ease,
      translate 320ms cubic-bezier(0.2, 0.7, 0.2, 1),
      visibility 0s linear 320ms;
  }
  .sl-active {
    opacity: 1;
    visibility: visible;
    translate: 0 0;
    transition:
      opacity 260ms ease 60ms,
      translate 320ms cubic-bezier(0.2, 0.7, 0.2, 1) 60ms,
      visibility 0s;
  }

  /* The same container the front page uses: 1180 wide, 24px gutters, 16px on
     a phone. Vertical padding is a share of the stage so a short slide sits
     a little above centre rather than hugging the header. */
  .sl-in {
    position: relative;
    width: min(100%, var(--dk-max));
    min-width: 0;
    margin: 0 auto;
    padding: clamp(1.5rem, 4.5vh, 3.25rem) var(--dk-gutter) clamp(1.5rem, 4vh, 2.5rem);
    display: grid;
    gap: clamp(1.25rem, 2.6vh, 2rem);
    align-content: start;
  }

  .sl-head {
    display: grid;
    gap: 0.6rem;
    max-width: 70ch;
  }
  .sl-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--sx-text);
  }
  .sl-eyebrow::before {
    content: '';
    width: 18px;
    height: 2px;
    background: var(--sx);
    border-radius: 2px;
  }
  .sl-title {
    font-size: clamp(1.55rem, 1.1rem + 1.7vw, 2.5rem);
    font-weight: 600;
    letter-spacing: -0.03em;
    line-height: 1.08;
    text-wrap: balance;
  }
  .sl-lede {
    font-size: clamp(0.98rem, 0.9rem + 0.3vw, 1.12rem);
    color: var(--t2);
    line-height: 1.6;
    max-width: 62ch;
  }

  .sl-body {
    min-width: 0;
    font-size: 0.95rem;
    line-height: 1.6;
  }

  @media (prefers-reduced-motion: reduce) {
    .sl,
    .sl-active {
      transition: none;
      translate: 0 0;
    }
  }

  @media print {
    .sl {
      opacity: 1 !important;
      visibility: visible !important;
      translate: 0 0 !important;
      overflow: visible;
      break-after: page;
      border-bottom: 1px solid var(--border);
    }
  }
</style>
