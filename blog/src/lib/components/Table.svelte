<!-- Wraps a table so it scrolls inside its own box instead of widening the
     reading column on a phone. -->
<script>
  import { scrollRegion } from '$shared/scroll-region.js';

  let { caption = '', label = '', children } = $props();
</script>

<!-- The wrapper scrolls sideways on a phone: while it does, it is a focusable
     region named by its columns or its caption (web-shared/scroll-region.js). -->
<figure>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="tbl-wrap" tabindex="0" role="region" aria-label={label || caption || 'Table'} use:scrollRegion={{ label: label || caption || 'Table' }}>
    <table>{@render children()}</table>
  </div>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>
