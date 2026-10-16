<script>
  // "About these targets": the notes the caveat marks of one table link to
  // (target-notes.js), verbatim and collapsed beneath it.
  import { noteId } from '$lib/target-notes.js';

  let { notes, scope } = $props();
</script>

{#if notes.length > 0}
  <details class="tn">
    <summary>About these targets</summary>
    {#each notes as n (n.gate)}
      <p class="av-small tn-note" id={noteId(scope, n.gate)}><span class="tn-gate">{n.gate}</span> {n.note}</p>
    {/each}
  </details>
{/if}

<style>
  .tn summary {
    cursor: pointer;
    color: var(--accent);
    font-size: 0.85rem;
  }
  .tn-note {
    color: var(--t2);
    overflow-wrap: anywhere;
  }
  .tn-gate {
    font-family: var(--font-mono);
    color: var(--t1);
  }
</style>
