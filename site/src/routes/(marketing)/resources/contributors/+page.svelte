<script>
  import PageShell from '$lib/components/marketing/PageShell.svelte';
  import PageHero from '$lib/components/marketing/PageHero.svelte';
  import CtaBand from '$lib/components/marketing/CtaBand.svelte';
  import { contributors as c } from '$lib/content/resources.js';
  import { routes, links } from '$lib/content/brand.js';

  const person = (login) => ({ login, url: `https://github.com/${login}` });
  const core = c.people.filter((login) => c.core[login]).map(person);
  const rest = c.people.filter((login) => !c.core[login]).map(person);
  const initials = (login) =>
    login
      .replace(/[^a-z0-9]/gi, '')
      .slice(0, 2)
      .toUpperCase();
</script>

<PageShell path={routes.contributors}>
  <PageHero
    eyebrow={c.eyebrow}
    title={c.title}
    lede={c.lede}
    primary={c.cta}
    secondary={{ text: c.cta2.text, href: c.cta2.href, external: true }}
    color="gold"
  />
  <section class="av-section av-section-alt">
    <div class="av-container">
      <h2 class="av-sr">Core team and contributors</h2>
      <p class="av-eyebrow av-reveal">Core team</p>
      <div class="av-people av-reveal">
        {#each core as p}
          <a class="av-person" href={p.url} target="_blank" rel="noopener">
            <div class="av-avatar" aria-hidden="true">{initials(p.login)}</div>
            <h3 class="av-h4">{p.login}</h3>
            <p class="av-role">{c.core[p.login]}</p>
          </a>
        {/each}
      </div>
    </div>
  </section>
  <section class="av-section">
    <div class="av-container">
      <p class="av-eyebrow av-reveal">Everyone else who landed code</p>
      <ul class="av-contrib-grid av-reveal">
        {#each rest as p}
          <li>
            <a href={p.url} target="_blank" rel="noopener"><span class="av-mono">{p.login}</span></a>
          </li>
        {/each}
      </ul>
      <p class="av-small av-reveal" style="margin-top:1.5rem">{c.cla}</p>
    </div>
  </section>
  <CtaBand
    title="Your machine is the test fleet."
    body="Run the serve matrix on your own hardware and report what you see. Regressions and wins both get featured."
    primary={{ text: 'Install the engine', href: routes.openSource }}
    secondary={{ text: 'Discord', href: links.discord, external: true }}
  />
</PageShell>

<style>
  .av-contrib-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
    gap: 0.6rem;
  }
  .av-contrib-grid a {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.6rem;
    padding: 0.65rem 0.85rem;
    border: 1px solid var(--border);
    border-radius: var(--av-radius-xs);
    background: var(--card);
    font-size: 0.86rem;
    color: var(--t1);
  }
  .av-contrib-grid a:hover {
    border-color: var(--accent);
  }
</style>
