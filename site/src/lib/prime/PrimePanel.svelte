<!--
  Metrale Prime's surface. One component, two shapes: above 860px it is a dock
  in the bottom right corner that leaves the page usable beside it (a visitor
  can read the pricing page while asking about it); below, it is a sheet that
  takes the screen, traps focus and locks the page behind it. The same state,
  the same log, the same composer, so nothing a visitor learns on a phone is
  different on a desk. Loaded on demand by PrimeLauncher; nothing here is in a
  page's first paint.
-->
<script>
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { prime, ask, stop, reset, restore, setAudience, setAccess } from './state.svelte.js';
  import { prime as copy } from './copy.js';
  import { SHEET_QUERY } from './config.js';
  import PrimeMessage from './PrimeMessage.svelte';
  import PrimeTelemetry from './PrimeTelemetry.svelte';
  import PrimeMark from './PrimeMark.svelte';

  let { onclose, initial = '' } = $props();

  let panelEl = $state(null);
  let logEl = $state(null);
  let inputEl = $state(null);
  let sheet = $state(false);
  let draft = $state('');
  let codeOpen = $state(false);
  let codeDraft = $state('');

  const path = $derived(page.url.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/');
  const busy = $derived(Boolean(prime.turn));
  const audience = $derived(copy.audiences.find((a) => a.id === prime.audience) ?? null);
  const starters = $derived((audience ?? copy.audiences[3]).starters);
  // The in-flight card takes the id the finished message will be pushed with,
  // so the keyed list updates in place instead of remounting when it settles.
  const rendered = $derived(prime.turn ? [...prime.messages, { id: prime.turn.id, role: 'assistant', live: prime.turn }] : prime.messages);

  onMount(() => {
    restore();
    const mq = window.matchMedia(SHEET_QUERY);
    const sync = () => (sheet = mq.matches);
    sync();
    mq.addEventListener('change', sync);
    const prev = document.activeElement;
    if (initial) draft = initial;
    inputEl?.focus();
    return () => {
      mq.removeEventListener('change', sync);
      if (prev instanceof HTMLElement) prev.focus();
    };
  });

  // The sheet is modal: the page behind it does not scroll. The dock is not.
  $effect(() => {
    if (!sheet) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  });

  // Keep the newest print in view: instantly while tokens stream, gently when
  // an answer settles.
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  $effect(() => {
    void prime.messages.length;
    void prime.turn?.answer;
    void prime.turn?.reasoning;
    void prime.turn?.tools.length;
    if (!logEl) return;
    if (!prime.turn && !reducedMotion()) logEl.scrollTo({ top: logEl.scrollHeight, behavior: 'smooth' });
    else logEl.scrollTop = logEl.scrollHeight;
  });

  function onKeydown(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onclose?.();
      return;
    }
    if (e.key !== 'Tab' || !sheet || !panelEl) return;
    const els = [...panelEl.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
    if (!els.length) return;
    const first = els[0];
    const last = els[els.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panelEl)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function send(text) {
    const q = (typeof text === 'string' ? text : draft).trim();
    if (!q || busy) return;
    draft = '';
    if (inputEl) inputEl.style.height = '';
    ask(q, { page: path });
  }
  function onComposerKey(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send();
    }
  }
  function grow(e) {
    const el = e.currentTarget;
    el.style.height = '';
    el.style.height = `${Math.min(160, el.scrollHeight)}px`;
  }
  function applyCode(e) {
    e.preventDefault();
    setAccess(codeDraft);
    codeDraft = '';
    codeOpen = false;
    inputEl?.focus();
  }
  const secs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`);
</script>

<svelte:window onkeydown={onKeydown} />

{#if sheet}<button type="button" class="pr-scrim" aria-label={copy.close} onclick={onclose}></button>{/if}
<section
  class="pr-panel"
  class:is-sheet={sheet}
  role={sheet ? 'dialog' : 'complementary'}
  aria-modal={sheet ? 'true' : undefined}
  aria-label={copy.name}
  tabindex="-1"
  bind:this={panelEl}
>
  {#if sheet}<div class="pr-handle" aria-hidden="true"></div>{/if}
  <header class="pr-head">
    <div class="pr-head-id">
      <PrimeMark size={26} class="pr-head-mark" />
      <div>
        <p class="pr-head-name">{copy.name}</p>
        <p class="pr-head-kicker">{copy.mark} · {copy.kicker}{prime.partner ? ` · ${copy.partner.on.toLowerCase()}` : ''}</p>
      </div>
    </div>
    <div class="pr-head-tools">
      <PrimeTelemetry />
      {#if prime.messages.length}<button type="button" class="pr-icon" title={copy.reset} aria-label={copy.reset} onclick={reset}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg></button>{/if}
      <button type="button" class="pr-icon" aria-label={copy.close} onclick={onclose}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
    </div>
  </header>

  <div class="pr-log" bind:this={logEl} role="log" aria-label={copy.name}>
    {#if prime.messages.length === 0 && !prime.turn}
      <div class="pr-welcome">
        <p class="pr-welcome-title">{copy.welcome.title}</p>
        <p class="pr-welcome-body">{copy.welcome.body}</p>
        <div class="pr-aud" role="group" aria-label="Who is asking">
          {#each copy.audiences as a (a.id)}
            <button type="button" class="pr-aud-chip" aria-pressed={prime.audience === a.id} onclick={() => setAudience(a.id)}>{a.label}</button>
          {/each}
        </div>
        <div class="pr-starters">
          {#each starters as s (s)}
            <button type="button" class="pr-starter" onclick={() => send(s)}>{s}<span aria-hidden="true"> →</span></button>
          {/each}
        </div>
      </div>
    {/if}
    {#each rendered as m (m.id)}
      <PrimeMessage message={m.live ? null : m} live={m.live ?? null} />
    {/each}
    {#if prime.error && !prime.turn && !prime.messages.at(-1)?.error}
      <p class="pr-notice" role="status">{copy.errors[prime.error.kind] ?? copy.errors.internal}</p>
    {/if}
  </div>

  <form class="pr-composer" onsubmit={(e) => { e.preventDefault(); send(); }}>
    {#if prime.messages.length > 0 && prime.audience}
      <p class="pr-composer-aud">{audience?.label}<button type="button" class="pr-composer-aud-x" onclick={() => setAudience(prime.audience)} aria-label="Clear who is asking">✕</button></p>
    {/if}
    <div class="pr-composer-row">
      <textarea class="pr-input" rows="1" bind:value={draft} bind:this={inputEl} placeholder={copy.composer.placeholder} aria-label={copy.composer.placeholder} onkeydown={onComposerKey} oninput={grow} autocomplete="off" spellcheck="true"></textarea>
      {#if busy}
        <button type="button" class="pr-send is-stop" onclick={stop} aria-label={copy.composer.stop}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" /></svg></button>
      {:else}
        <button type="submit" class="pr-send" disabled={!draft.trim()} aria-label={copy.composer.send}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg></button>
      {/if}
    </div>
    <div class="pr-foot">
      <span class="pr-fine">{copy.fine}{prime.model ? ` ${copy.runs} ${prime.model} ${copy.via}.` : ''}</span>
      <button type="button" class="pr-code-btn" aria-expanded={codeOpen} onclick={() => (codeOpen = !codeOpen)}>{prime.access ? copy.partner.on : copy.partner.label}</button>
    </div>
    {#if codeOpen}
      <div class="pr-code" role="group" aria-label={copy.partner.group}>
        {#if prime.access}
          <span class="pr-code-hint">{copy.partner.on}.</span>
          <button type="button" class="pr-code-apply" onclick={() => { setAccess(''); codeOpen = false; }}>{copy.partner.off}</button>
        {:else}
          <input class="pr-code-input" type="password" bind:value={codeDraft} placeholder={copy.partner.placeholder} aria-label={copy.partner.label} autocomplete="off" onkeydown={(e) => e.key === 'Enter' && applyCode(e)} />
          <button type="button" class="pr-code-apply" onclick={applyCode} disabled={!codeDraft.trim()}>{copy.partner.apply}</button>
          <span class="pr-code-hint">{copy.partner.hint}</span>
        {/if}
      </div>
    {/if}
  </form>
</section>

<style>
  .pr-scrim { position: fixed; inset: 0; z-index: 105; background: rgba(15, 18, 22, 0.45); border: 0; cursor: pointer; }
  .pr-panel {
    position: fixed; z-index: 106; right: 20px; bottom: 20px;
    width: min(440px, calc(100vw - 40px)); height: min(720px, calc(100dvh - 40px));
    display: flex; flex-direction: column;
    background: var(--card); color: var(--t1); border: 1px solid var(--border-strong); border-radius: 22px;
    box-shadow: var(--shadow-lg); font-family: var(--font-sans); overflow: hidden; outline: none;
    animation: pr-in 0.22s var(--av-ease, ease-out);
  }
  @keyframes pr-in { from { opacity: 0; transform: translateY(12px); } }
  .pr-panel.is-sheet {
    right: 0; bottom: 0; left: 0; width: 100%; height: calc(100dvh - 8dvh);
    border-radius: 22px 22px 0 0; border-bottom: 0;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  @media (prefers-reduced-motion: reduce) { .pr-panel { animation: none; } }
  .pr-handle { width: 40px; height: 4px; border-radius: 2px; background: var(--border-strong); margin: 8px auto 0; }

  .pr-head { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; padding: 0.85rem 0.9rem 0.75rem 1rem; border-bottom: 1px solid var(--border); }
  .pr-head-id { display: flex; align-items: center; gap: 0.65rem; min-width: 0; }
  .pr-head :global(.pr-head-mark) { color: var(--t1); flex-shrink: 0; }
  .pr-head-name { margin: 0; font-weight: 650; font-size: 0.98rem; line-height: 1.2; }
  .pr-head-kicker { margin: 0.1rem 0 0; font-family: var(--font-mono); font-size: 0.66rem; letter-spacing: 0.08em; color: var(--t3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pr-head-tools { display: flex; align-items: center; gap: 0.15rem; flex-shrink: 0; }
  .pr-icon { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 9px; border: 1px solid transparent; background: none; color: var(--t2); cursor: pointer; }
  .pr-icon:hover { background: var(--bg2); color: var(--t1); border-color: var(--border-strong); }
  .pr-icon:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  /* minmax(0, 1fr), not the implicit auto track: an auto track grows to the
     widest unbreakable thing in any answer (a long URL, a source title) and
     takes every line past the panel's edge with it. The column is the panel. */
  .pr-log { flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 1rem 1rem 0.5rem; display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.1rem; align-content: start; scrollbar-width: thin; }
  .pr-welcome { display: grid; gap: 0.7rem; }
  .pr-welcome-title { margin: 0; font-size: 1.15rem; font-weight: 650; letter-spacing: -0.01em; line-height: 1.25; text-wrap: balance; }
  .pr-welcome-body { margin: 0; font-size: 0.9rem; line-height: 1.55; color: var(--t2); }
  .pr-aud { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.25rem; }
  .pr-aud-chip { padding: 0.42rem 0.75rem; border-radius: 999px; border: 1px solid var(--border-strong); background: var(--bg2); color: var(--t2); font: inherit; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: border-color 0.15s, color 0.15s, background 0.15s; }
  .pr-aud-chip:hover { color: var(--t1); border-color: var(--accent); }
  .pr-aud-chip[aria-pressed='true'] { color: var(--accent); border-color: var(--accent); background: var(--accent-soft); }
  .pr-aud-chip:focus-visible, .pr-starter:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .pr-starters { display: grid; gap: 0.4rem; margin-top: 0.2rem; }
  .pr-starter { text-align: left; padding: 0.6rem 0.75rem; border-radius: 12px; border: 1px solid var(--border); background: var(--bg2); color: var(--t1); font: inherit; font-size: 0.86rem; line-height: 1.4; cursor: pointer; transition: border-color 0.15s, transform 0.15s; }
  .pr-starter:hover { border-color: var(--accent); transform: translateX(2px); }
  .pr-notice { margin: 0; font-size: 0.86rem; color: var(--t2); }

  .pr-composer { border-top: 1px solid var(--border); padding: 0.65rem 0.9rem 0.7rem; display: grid; gap: 0.45rem; background: var(--card); }
  .pr-composer-aud { margin: 0; display: inline-flex; align-items: center; gap: 0.4rem; font-family: var(--font-mono); font-size: 0.64rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent); }
  .pr-composer-aud-x { background: none; border: 0; color: var(--t3); cursor: pointer; font-size: 0.7rem; padding: 0 0.2rem; }
  .pr-composer-row { display: flex; align-items: flex-end; gap: 0.5rem; }
  .pr-input { flex: 1; resize: none; min-height: 44px; max-height: 160px; padding: 0.7rem 0.85rem; border-radius: 14px; border: 1px solid var(--border-strong); background: var(--bg2); color: var(--t1); font: inherit; font-size: 0.92rem; line-height: 1.45; outline: none; }
  .pr-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  .pr-input::placeholder { color: var(--t3); }
  .pr-send { flex-shrink: 0; width: 44px; height: 44px; border-radius: 50%; border: 0; background: var(--accent-fill); color: var(--on-accent); display: grid; place-items: center; cursor: pointer; transition: background 0.15s, transform 0.15s, opacity 0.15s; }
  .pr-send:hover:not(:disabled) { background: var(--accent-fill-hover); transform: translateY(-1px); }
  .pr-send:disabled { opacity: 0.4; cursor: default; }
  .pr-send.is-stop { background: var(--t1); color: var(--bg); }
  .pr-send:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .pr-foot { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; }
  .pr-fine { font-size: 0.68rem; line-height: 1.4; color: var(--t3); }
  .pr-code-btn { flex-shrink: 0; background: none; border: 0; padding: 0; font-family: var(--font-mono); font-size: 0.64rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--t3); cursor: pointer; }
  .pr-code-btn:hover, .pr-code-btn[aria-expanded='true'] { color: var(--accent); }
  .pr-code { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; }
  .pr-code-input { flex: 1; min-width: 120px; padding: 0.45rem 0.6rem; border-radius: 8px; border: 1px solid var(--border-strong); background: var(--bg2); color: var(--t1); font: inherit; font-size: 0.82rem; }
  .pr-code-apply { padding: 0.45rem 0.7rem; border-radius: 8px; border: 1px solid var(--border-strong); background: var(--card); color: var(--t1); font: inherit; font-size: 0.78rem; font-weight: 600; cursor: pointer; }
  .pr-code-apply:disabled { opacity: 0.5; cursor: default; }
  .pr-code-hint { flex-basis: 100%; font-size: 0.7rem; color: var(--t3); }

  @media (max-width: 480px) {
    .pr-head { padding: 0.7rem 0.6rem 0.6rem 0.9rem; }
    .pr-log { padding: 0.85rem 0.85rem 0.4rem; }
    .pr-composer { padding: 0.55rem 0.7rem calc(0.6rem + env(safe-area-inset-bottom, 0px)); }
  }
</style>
