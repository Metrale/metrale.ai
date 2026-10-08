<!--
  A section heading with a copper chevron in the rail, the reading column's
  marker for where a section starts.
-->
<script>
  let { id, children } = $props();
</script>

<h2 {id}>
  <svg class="chev" viewBox="0 0 396 636" fill="none" stroke-width="76" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M38 38L358 318L38 598" stroke="var(--sx)" />
  </svg>{@render children()}
</h2>
