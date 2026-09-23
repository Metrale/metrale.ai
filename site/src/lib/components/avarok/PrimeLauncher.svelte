<!--
  The one part of Metrale Prime that ships in a page's first paint: a pill in
  the corner with the M′ glyph. Everything else, the panel, the state, the
  markdown renderer, is a separate chunk that loads when the pointer or the
  focus reaches this button, and mounts on the click. A page whose build names
  no endpoint (brand.js `primeEndpoint`, or VITE_PRIME_ENDPOINT) renders
  nothing at all.

  It lives in components/avarok/ so the build folds it into the av-ui chunk;
  the page-weight budget in e2e/page-weight.spec.js allows no extra request.
  Anything on the page can open it with a question by dispatching
  `new CustomEvent('prime:ask', { detail: { question } })` on window.
-->
<script>
  import { onMount, tick } from 'svelte';
  import { CHAT_URL } from '$lib/prime/config.js';
  import { prime as copy } from '$lib/prime/copy.js';
  import PrimeMark from '$lib/prime/PrimeMark.svelte';

  let open = $state(false);
  let Panel = $state(null);
  let failed = $state(false);
  let initial = $state('');
  let chunk = null;

  function warm() {
    if (!chunk) {
      chunk = import('$lib/prime/PrimePanel.svelte').catch((err) => {
        chunk = null;
        throw err;
      });
    }
    return chunk;
  }
  async function show(question = '') {
    initial = question;
    open = true;
    failed = false;
    try {
      Panel = (await warm()).default;
    } catch {
      failed = true;
      open = false;
    }
  }
  // The button is re-created on close, so focus is handed to the new one by
  // hand: a keyboard visitor lands back where they left.
  async function hide() {
    open = false;
    await tick();
    document.querySelector('.pr-launch')?.focus();
  }
  onMount(() => {
    const onAsk = (e) => show(String(e.detail?.question ?? ''));
    window.addEventListener('prime:ask', onAsk);
    return () => window.removeEventListener('prime:ask', onAsk);
  });
</script>

{#if CHAT_URL}
  {#if !open}
    <button
      type="button"
      class="pr-launch"
      aria-label={copy.launcher.aria}
      aria-expanded="false"
      aria-haspopup="dialog"
      onpointerenter={warm}
      onfocus={warm}
      onclick={() => show()}
    >
      <PrimeMark size={22} class="pr-launch-mark" />
      <span class="pr-launch-label">{copy.launcher.label}</span>
    </button>
  {/if}
  {#if failed}
    <p class="pr-launch-fail" role="alert">{copy.errors.network}</p>
  {/if}
  {#if open && Panel}
    <Panel onclose={hide} {initial} />
  {/if}
{/if}

<style>
  .pr-launch {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 104;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    height: 46px;
    padding: 0 1rem 0 0.75rem;
    border-radius: 999px;
    border: 1px solid var(--border-strong);
    background: var(--card);
    color: var(--t1);
    font-family: var(--font-sans);
    font-weight: 650;
    font-size: 0.9rem;
    letter-spacing: -0.005em;
    cursor: pointer;
    box-shadow: var(--shadow);
    transition:
      transform 0.18s var(--av-ease, ease-out),
      border-color 0.18s,
      box-shadow 0.18s;
  }
  .pr-launch:hover {
    transform: translateY(-2px);
    border-color: var(--accent);
    box-shadow: var(--shadow-lg);
  }
  .pr-launch:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
  .pr-launch :global(.pr-launch-mark) {
    color: var(--t1);
  }
  .pr-launch-fail {
    position: fixed;
    right: 20px;
    bottom: 76px;
    z-index: 104;
    margin: 0;
    padding: 0.5rem 0.8rem;
    border-radius: 10px;
    background: var(--card);
    border: 1px solid var(--border-strong);
    font-size: 0.8rem;
    color: var(--red);
  }
  @media (max-width: 480px) {
    .pr-launch {
      right: 14px;
      bottom: calc(14px + env(safe-area-inset-bottom, 0px));
      height: 44px;
      padding: 0 0.9rem 0 0.7rem;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pr-launch {
      transition: none;
    }
  }
</style>
