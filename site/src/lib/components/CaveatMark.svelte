<script>
  // The mark beside a flagged vLLM target (target-notes.js): the caveat, linked
  // to the entry's note. Following the link opens the collapsed disclosure that
  // holds the note, so the account is one activation away.
  import { noteId } from '$lib/target-notes.js';

  let { caveat, scope, gate } = $props();
  const id = $derived(noteId(scope, gate));
  const open = () => document.getElementById(id)?.closest('details')?.setAttribute('open', '');
</script>

<a class="cm" href="#{id}" onclick={open}><span aria-hidden="true">†</span> {caveat}<span class="cm-sr">, about this target</span></a>

<style>
  .cm {
    display: block;
    font-size: 0.8rem;
    color: var(--accent);
    text-decoration: underline;
    white-space: normal;
  }
  .cm-sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
