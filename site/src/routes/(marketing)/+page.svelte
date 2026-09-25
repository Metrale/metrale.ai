<script>
  // The front page. Sections in the order a buyer reads them; every section
  // reads its copy from src/lib/content/home.js and ends where the next one
  // starts. Old bookmarks into the developer sections (#faq, #hardware) still
  // resolve: the fragment is forwarded to /engine, the same way the previous
  // homepage did it.
  import { afterNavigate } from '$app/navigation';
  import { legacyEngineDestination } from '$lib/marketing.js';
  import { routes } from '$lib/content/brand.js';
  import { faqFor } from '$lib/content/faq.js';
  import { cta } from '$lib/content/home.js';
  import PageShell from '$lib/components/marketing/PageShell.svelte';
  import Announcement from '$lib/components/marketing/home/Announcement.svelte';
  import Hero from '$lib/components/marketing/home/Hero.svelte';
  import LogoWall from '$lib/components/marketing/LogoWall.svelte';
  import Problem from '$lib/components/marketing/home/Problem.svelte';
  import Solution from '$lib/components/marketing/home/Solution.svelte';
  import ValueBand from '$lib/components/marketing/home/ValueBand.svelte';
  import Proof from '$lib/components/marketing/home/Proof.svelte';
  import Tour from '$lib/components/marketing/home/Tour.svelte';
  import Recognition from '$lib/components/marketing/home/Recognition.svelte';
  import Differences from '$lib/components/marketing/home/Differences.svelte';
  import Chain from '$lib/components/marketing/home/Chain.svelte';
  import Deliveries from '$lib/components/marketing/home/Deliveries.svelte';
  import FaqList from '$lib/components/marketing/FaqList.svelte';
  import CtaBand from '$lib/components/marketing/CtaBand.svelte';

  function forward({ hash, search }) {
    const destination = legacyEngineDestination(hash, search);
    if (destination) window.location.replace(destination);
  }
  afterNavigate(({ to }) => {
    if (to) forward(to.url);
  });
</script>

<svelte:window onhashchange={() => forward(window.location)} />

<PageShell path={routes.home}>
  <Announcement />
  <Hero />
  <LogoWall />
  <Problem />
  <Solution />
  <ValueBand />
  <Proof />
  <Tour />
  <Recognition />
  <Differences />
  <Chain />
  <Deliveries />
  <FaqList items={faqFor('home')} />
  <CtaBand eyebrow={cta.eyebrow} title={cta.title} body={cta.body} primary={cta.primary} secondary={cta.secondary} />
</PageShell>
