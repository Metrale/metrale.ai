<script>
  import PageShell from '$lib/components/marketing/PageShell.svelte';
  import PageHero from '$lib/components/marketing/PageHero.svelte';
  import PaybackCalculator from '$lib/components/marketing/PaybackCalculator.svelte';
  import FaqList from '$lib/components/marketing/FaqList.svelte';
  import CtaBand from '$lib/components/marketing/CtaBand.svelte';
  import { pricingHero, tiers, metering, paybackCopy, pricingCta } from '$lib/content/pricing.js';
  import { faqFor } from '$lib/content/faq.js';
  import { routes } from '$lib/content/brand.js';
</script>

<PageShell path={routes.pricing}>
  <PageHero eyebrow={pricingHero.eyebrow} title={pricingHero.title} lede={pricingHero.lede}>
    <p class="av-kicker" style="margin-top:1.4rem"><span class="av-dot"></span> {pricingHero.stamp}</p>
  </PageHero>

  <section class="av-section av-section-alt av-section-tight" id="tiers">
    <div class="av-container">
      <div class="av-grid av-grid-4 av-reveal av-tiers">
        {#each tiers as t}
          <div class="av-card av-tier" class:is-featured={t.featured}>
            <p class="av-card-tag">
              {#if t.featured}<span class="av-chip av-chip-accent av-tier-flag">Most fleets start here</span><br />{/if}{#if t.badge}<span
                  class="av-chip av-chip-accent av-tier-flag">{t.badge}</span
                ><br />{/if}{t.name}
            </p>
            <div class="av-tier-price"><span class="av-num av-num-plain">{t.price}</span><span class="av-small">{t.per}</span></div>
            <p>{t.blurb}</p>
            <ul class="av-list-check" style="margin-top:1rem">
              {#each t.includes as i}<li>{i}</li>{/each}
            </ul>
            <a class="av-btn {t.featured ? 'av-btn-primary' : 'av-btn-secondary'}" style="margin-top:1.2rem;width:100%" href={t.cta.href}
              >{t.cta.text}</a
            >
          </div>
        {/each}
      </div>
    </div>
  </section>

  <section class="av-section av-section-tight" id="metering">
    <div class="av-container">
      <div class="av-head av-reveal">
        <p class="av-eyebrow">{metering.eyebrow}</p>
        <h2 class="av-h2">{metering.title}</h2>
        <p class="av-lede">{metering.body}</p>
      </div>
      <div class="av-grid av-grid-4 av-reveal">
        {#each metering.items as m}
          <div class="av-card av-card-accent">
            <h3>{m.title}</h3>
            <p>{m.body}</p>
          </div>
        {/each}
      </div>
    </div>
  </section>
  <section class="av-section av-section-alt" id="payback-section">
    <div class="av-container">
      <div class="av-head av-reveal">
        <p class="av-eyebrow">{paybackCopy.eyebrow}</p>
        <h2 class="av-h2">{paybackCopy.title}</h2>
        <p class="av-lede">{paybackCopy.lede}</p>
      </div>
      <div class="av-reveal"><PaybackCalculator /></div>
    </div>
  </section>

  <FaqList items={faqFor('pricing')} />
  <CtaBand
    eyebrow={pricingCta.eyebrow}
    title={pricingCta.title}
    body={pricingCta.body}
    primary={pricingCta.primary}
    secondary={pricingCta.secondary}
  />
</PageShell>

<style>
  .av-tier {
    display: flex;
    flex-direction: column;
  }
  .av-tier p:not(.av-card-tag) {
    flex: 0 0 auto;
  }
  .av-tier .av-list-check {
    flex: 1 0 auto;
  }
  .av-tier.is-featured {
    border-color: var(--accent);
    box-shadow:
      0 0 0 1px var(--accent),
      var(--av-shadow);
  }
  .av-tier-flag {
    display: inline-flex;
    margin-bottom: 0.6rem;
  }
  .av-tier-price {
    display: grid;
    gap: 0.2rem;
    margin: 0.4rem 0 0.9rem;
  }
  .av-tier-price .av-num {
    font-size: 2.2rem;
  }
  @media (max-width: 1080px) {
    .av-tiers {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 640px) {
    .av-tiers {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
