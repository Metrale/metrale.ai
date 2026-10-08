<!-- Wraps a table so it scrolls inside its own box instead of widening the
     reading column on a phone. -->
<script>
  let { caption = '', label = '', children } = $props();
</script>

<!-- The wrapper scrolls sideways on a phone, so it takes focus and a keyboard
     can scroll it (WCAG 2.1.1), named by its columns or its caption. -->
<figure>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="tbl-wrap" tabindex="0" role="region" aria-label={label || caption || 'Table'}>
    <table>{@render children()}</table>
  </div>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>
