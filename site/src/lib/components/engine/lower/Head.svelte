<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script>
  // The head every section in the lower half of /engine opens with: the
  // homepage's eyebrow, title and lede, plus an optional aside that sits to
  // the right on a wide screen and under the lede on a phone. One place for
  // that grammar, so the five sections cannot drift from each other.
  let { eyebrow, title, lede, maxCh = 24, aside = undefined } = $props();
</script>

<div class="eg-head" class:has-aside={!!aside}>
  <div>
    <p class="av-eyebrow">{eyebrow}</p>
    <h2 class="av-h2" style="max-width:{maxCh}ch">{title}</h2>
    <p class="av-lede">{lede}</p>
  </div>
  {#if aside}
    <div class="eg-aside">{@render aside()}</div>
  {/if}
</div>

<style>
  .eg-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 2rem;
    align-items: end;
    margin-bottom: 2.75rem;
  }
  .eg-head.has-aside {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .eg-aside {
    display: grid;
    justify-items: end;
    gap: 0.6rem;
  }
  @media (max-width: 900px) {
    .eg-head.has-aside {
      grid-template-columns: minmax(0, 1fr);
    }
    .eg-aside {
      justify-items: start;
    }
  }
</style>
