<script>
  import { copyLabel, copyOrSelect } from '$lib/clipboard.js';
  // A command an analyst is expected to paste. Copy is the point of the
  // component: a step someone has to retype by eye is a step they will get
  // wrong and then report as a failure to reproduce.
  let { label = '', lines = [], note = '' } = $props();

  let state = $state('idle'); // idle | copied | manual | blocked
  let preEl = $state(null);
  let timer;
  const text = $derived(lines.join('\n'));

  // A slide can advance while the flash is pending; without this the timeout
  // fires against a component that is gone.
  $effect(() => () => clearTimeout(timer));

  async function copy() {
    clearTimeout(timer);
    // A refusal is reported, never rendered as success (see clipboard.js).
    state = await copyOrSelect(text, preEl);
    timer = setTimeout(() => (state = 'idle'), 2400);
  }
</script>

<figure class="dk-cmd">
  <figcaption>
    {#if label}<span class="dk-cmd-label mono">{label}</span>{/if}
    <button type="button" class="dk-cmd-copy mono" onclick={copy}>{copyLabel(state, 'copy').toLowerCase()}</button>
  </figcaption>
  <!-- The block scrolls sideways rather than wrapping: a wrapped command is a
       different command once pasted. A scroll region has to be reachable from
       the keyboard, which is the one case a tabindex on a non-interactive
       element is for. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <pre class="mono" tabindex="0" bind:this={preEl}>{#each lines as line}<span class="dk-cmd-line">{line}</span>{/each}</pre>
  {#if note}<p class="dk-cmd-note">{note}</p>{/if}
</figure>

<style>
  .dk-cmd {
    min-width: 0;
    max-width: 100%;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--sunk);
    overflow: hidden;
  }
  figcaption {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 0.9rem;
    border-bottom: 1px solid var(--border);
    background: var(--card);
  }
  .dk-cmd-label {
    flex: 1;
    min-width: 0;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--t3);
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
  .dk-cmd-label::before {
    content: '';
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--sx);
    margin-right: 0.55rem;
    vertical-align: 0.05em;
  }
  .dk-cmd-copy {
    flex-shrink: 0;
    background: none;
    border: 1px solid var(--border-strong);
    color: var(--t2);
    border-radius: 999px;
    font-size: 0.7rem;
    padding: 0.2rem 0.65rem;
    cursor: pointer;
  }
  .dk-cmd-copy:hover {
    border-color: var(--sx);
    color: var(--sx-text);
  }
  .dk-cmd-copy:focus-visible,
  pre:focus-visible {
    outline: 2px solid var(--sx);
    outline-offset: -2px;
  }
  pre {
    margin: 0;
    padding: 0.8rem 1rem;
    font-size: 0.8rem;
    line-height: 1.7;
    color: var(--t1);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    white-space: pre;
    tab-size: 4;
  }
  .dk-cmd-line {
    display: block;
  }
  /* A blank line in a command block is a paragraph break between stages, so it
     has to occupy a line rather than collapsing to nothing. */
  .dk-cmd-line:empty::before {
    content: '\00a0';
  }
  .dk-cmd-note {
    padding: 0.6rem 1rem 0.8rem;
    border-top: 1px solid var(--border);
    font-size: 0.8rem;
    line-height: 1.55;
    color: var(--t3);
  }
</style>
