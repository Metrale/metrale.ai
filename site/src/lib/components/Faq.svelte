<script>
  // Rendered from `faq` in data.js, the same export that feeds the FAQPage
  // structured data in +layout.svelte, so the markup can only ever claim
  // answers a visitor can actually read.
  //
  // <details>/<summary> rather than a JS accordion: keyboard and screen-reader
  // behaviour is native, it costs no runtime, and the answers are in the
  // prerendered HTML whether or not a crawler executes script.
  import { faq, discordUrl } from '$lib/data.js';
  import Head from './engine/lower/Head.svelte';
</script>

<section id="faq" class="av av-section av-sx-violet">
  <div class="av-container av-narrow">
    <Head eyebrow={faq.label} title={faq.title} lede={faq.sub} maxCh={22} />

    <div class="av-accordion">
      {#each faq.items as item}
        <details>
          <summary><span>{item.q}</span><span class="av-plus" aria-hidden="true">+</span></summary>
          <p class="av-answer">{item.a}</p>
        </details>
      {/each}
    </div>

    <p class="av-small eg-more">
      {faq.more}
      <a class="av-link" href="#reach">{faq.moreCta} <span class="av-arrow">→</span></a>
      {faq.moreAlt}
      <a class="av-link" href={discordUrl} target="_blank" rel="noopener">Discord ↗</a>
    </p>
  </div>
</section>

<style>
  .eg-more {
    margin-top: 1.25rem;
  }
</style>
