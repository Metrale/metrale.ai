<script>
  import PageShell from '$lib/components/marketing/PageShell.svelte';
  import PageHero from '$lib/components/marketing/PageHero.svelte';
  import CtaBand from '$lib/components/marketing/CtaBand.svelte';
  import { solutionsIndex as s, solutions, solutionCta } from '$lib/content/solutions.js';
  import { routes, sectors, industryBySlug, solutionHref } from '$lib/content/brand.js';
  const hues = ['violet', 'cyan', 'green', 'gold'];
</script>

<PageShell path={routes.solutions}>
  <PageHero eyebrow={s.eyebrow} title={s.title} lede={s.lede} color="cyan" />
  <!-- The sectors, as a bar that stays under the header while the page scrolls,
       the way the developer pages keep their own bar. Each link jumps to its
       sector's cards below; the menu in the header lists the same four. -->
  {#if sectors.length > 1}
    <nav class="av-sectorbar" aria-label="Sectors">
      <div class="av-container av-sectorbar-in">
        {#each sectors as sec, k}
          <a class="av-sectorbar-link av-sx-{hues[k % 4]}" href={`#${sec.id}`}><i aria-hidden="true"></i>{sec.label}</a>
        {/each}
      </div>
    </nav>
  {/if}
  {#each sectors as sec, k}
    <section class="av-section {k % 2 === 0 ? 'av-section-alt' : ''}" id={sec.id}>
      <div class="av-container">
        <div class="av-head av-reveal">
          <p class="av-eyebrow">{sec.label}</p>
          <h2 class="av-h2">{sec.blurb}</h2>
        </div>
        <div class="av-grid av-grid-{Math.min(3, sec.industries.length)} av-reveal">
          {#each sec.industries as slug, j}
            {@const i = industryBySlug(slug)}
            <a class="av-card av-card-accent av-sx-{hues[(k + j) % 4]}" href={solutionHref(slug)}>
              <h3>{i.name}</h3>
              <p>{solutions[slug].title}</p>
              <span class="av-link">Read the solution <span class="av-arrow">→</span></span>
            </a>
          {/each}
        </div>
      </div>
    </section>
  {/each}
  <CtaBand
    eyebrow={solutionCta.eyebrow}
    title={solutionCta.title}
    body={solutionCta.body}
    primary={solutionCta.primary}
    secondary={solutionCta.secondary}
  />
</PageShell>
