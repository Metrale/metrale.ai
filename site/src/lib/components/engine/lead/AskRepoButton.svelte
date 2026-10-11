<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script>
  // "Ask the codebase": the copper lattice at the top right of /engine. It
  // opens AutoRepoRAG's website-chat library, served from this origin at the
  // release in chat/pin.js, with the configuration chat/config.js builds.
  //
  // Nothing of the chat is in the page's bundle. Hover or focus imports the
  // library and lets it link its stylesheet and prefetch the wasm at idle; a
  // click imports it if that has not happened yet (the button says it is busy
  // meanwhile) and opens the dialog, which downloads the corpus. The model ids
  // come from the build (virtual:metrale-chat-models, see chat/models-env.js).
  // When the dialog closes, focus comes back here: the library returns it to
  // whatever held focus when it mounted, and in WebKit a clicked button never
  // takes focus, so this does it itself.
  import { tick } from 'svelte';
  import ChatLatticeIcon from '$lib/components/ChatLatticeIcon.svelte';
  import { codeChat } from '$lib/data.js';
  import { REPO_CHAT_MODULE_URL, repoChatConfig } from '$lib/chat/config.js';
  import { removeLegacyCache } from '$lib/chat/legacy-cache.js';
  import { chatModel, rerankModel } from 'virtual:metrale-chat-models';

  /** @type {'idle' | 'loading' | 'open' | 'error'} */
  let phase = $state('idle');
  /** @type {HTMLButtonElement | undefined} */
  let button = $state();
  /** @type {HTMLButtonElement | undefined} */
  let retryButton = $state();

  let library = null;
  let failures = 0;
  function load() {
    // Memoized. A browser remembers a module that failed to load under its URL
    // and fails every later import of that URL at once (measured in Chromium),
    // so an attempt after a failure asks under a fresh query. Nothing ran from
    // the failed one, so there is still only one copy of the library.
    const url = failures === 0 ? REPO_CHAT_MODULE_URL : `${REPO_CHAT_MODULE_URL}?attempt=${failures}`;
    library ??= import(/* @vite-ignore */ url).catch((err) => {
      library = null;
      failures += 1;
      throw err;
    });
    return library;
  }

  function closed() {
    phase = 'idle';
    button?.focus();
  }

  const config = (lib) =>
    repoChatConfig({ mount: document.body, copyEn: lib.COPY_EN, models: { chatModel, rerankModel }, onClose: closed });

  async function warm() {
    if (phase !== 'idle') return;
    try {
      const lib = await load();
      lib.warmRepoChat(config(lib));
    } catch {
      // Not the visitor's concern yet: the click loads again and reports a failure there.
    }
  }

  let legacyCleared = false;
  function clearLegacy() {
    if (legacyCleared) return;
    legacyCleared = true;
    // No private file system (a private window, an old browser) holds no old corpus either.
    const dir = navigator.storage?.getDirectory ? navigator.storage.getDirectory().catch(() => null) : Promise.resolve(null);
    dir.then((d) => removeLegacyCache({ dir: d, caches: globalThis.caches ?? null })).catch((err) => console.warn(err));
  }

  // The load-failure note stays until the visitor retries, dismisses it, presses
  // Escape or clicks elsewhere.
  function dismiss() {
    if (phase !== 'error') return;
    phase = 'idle';
    button?.focus();
  }
  function onWindowKey(e) {
    if (e.key === 'Escape') dismiss();
  }
  function onDocClick(e) {
    if (phase === 'error' && !e.target.closest?.('.arb')) phase = 'idle';
  }

  async function open() {
    if (phase === 'loading' || phase === 'open') return;
    phase = 'loading';
    try {
      const lib = await load();
      lib.openRepoChat(config(lib));
      phase = 'open';
      clearLegacy();
    } catch (err) {
      console.error(err);
      phase = 'error';
      // A retry from the note removed the button that held focus while it
      // loaded; put focus on the note's "Try again" rather than leave it on <body>.
      if (document.activeElement === document.body) {
        await tick();
        retryButton?.focus();
      }
    }
  }
</script>

<svelte:window onkeydown={onWindowKey} />
<svelte:document onclick={onDocClick} />

<div class="arb">
  <button
    bind:this={button}
    type="button"
    class="arb-btn"
    data-phase={phase}
    aria-label={codeChat.copy.navLabel}
    title={codeChat.copy.navLabel}
    aria-haspopup="dialog"
    aria-expanded={phase === 'open'}
    aria-busy={phase === 'loading'}
    aria-describedby={phase === 'error' ? 'arb-error' : undefined}
    onpointerenter={warm}
    onfocus={warm}
    onclick={open}
  >
    <ChatLatticeIcon size={20} />
  </button>
  <!-- The alert region is always in the page, empty until there is something
       to say, so a screen reader announces the message when it is written. -->
  <div class="arb-pop" class:is-open={phase === 'error'}>
    <p id="arb-error" class="arb-pop-text" role="alert">{phase === 'error' ? codeChat.loadFail : ''}</p>
    {#if phase === 'error'}
      <div class="arb-pop-actions">
        <button bind:this={retryButton} type="button" class="arb-pop-retry" onclick={open}>{codeChat.retry}</button>
        <button type="button" class="arb-pop-dismiss" onclick={dismiss}>{codeChat.dismiss}</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .arb {
    display: inline-flex;
  }
  /* Nothing to open without script, so no button either. */
  @media (scripting: none) {
    .arb {
      display: none;
    }
  }
  .arb-btn {
    display: inline-grid;
    place-items: center;
    width: 42px;
    height: 42px;
    flex-shrink: 0;
    cursor: pointer;
    border-radius: 10px;
    border: 1px solid var(--border-strong);
    background: var(--card);
    color: var(--accent);
    transition: border-color 0.15s;
  }
  .arb-btn:hover {
    border-color: var(--accent);
  }
  .arb-btn:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .arb-btn[data-phase='loading'] {
    cursor: progress;
  }
  .arb-btn[data-phase='loading'] :global(svg) {
    animation: arb-pulse 0.9s ease-in-out infinite alternate;
  }
  @keyframes arb-pulse {
    to {
      opacity: 0.35;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .arb-btn[data-phase='loading'] :global(svg) {
      animation: none;
      opacity: 0.55;
    }
  }
  /* Closed: out of sight but still in the accessibility tree, empty. */
  .arb-pop:not(.is-open) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  /* Open: pinned under the sticky header at the right gutter, so it is inside
     the viewport at every width whatever sits right of the button. */
  .arb-pop.is-open {
    position: fixed;
    z-index: 105;
    top: calc(var(--nav-h, 68px) + 8px);
    right: 16px;
    width: min(20rem, calc(100vw - 32px));
    padding: 0.75rem 0.85rem;
    border-radius: 10px;
    border: 1px solid var(--border-strong);
    background: var(--card);
    color: var(--t1);
    box-shadow: var(--shadow);
    font-size: 0.88rem;
    line-height: 1.45;
  }
  .arb-pop-text {
    margin: 0;
  }
  .arb-pop-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.6rem;
  }
  .arb-pop-actions button {
    min-height: 36px;
    padding: 0 0.85rem;
    border-radius: 999px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .arb-pop-retry {
    border: 1px solid var(--accent-fill);
    background: var(--accent-fill);
    color: var(--on-accent);
  }
  .arb-pop-dismiss {
    border: 1px solid var(--border-strong);
    background: transparent;
    color: var(--t1);
  }
  .arb-pop-actions button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
</style>
