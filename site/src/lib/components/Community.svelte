<script>
  // Where the work happens: the repository, the Discord, the discussions. One
  // card each, every one a door into something that exists.
  import { stars as copy, community, githubUrl } from '$lib/data.js';
  import starsData from '$lib/stars.generated.json';
  import GithubIcon from './GithubIcon.svelte';
  import DiscordIcon from './DiscordIcon.svelte';
  import Head from './engine/lower/Head.svelte';

  // The count is a generated fact. The generator's offline fallback carries 0,
  // which is not a number worth printing, so the line is absent rather than
  // wrong.
  const starCount = starsData.count > 0 ? starsData.count.toLocaleString('en-US') : '';
</script>

<section id="community" class="av av-section av-sx-gold">
  <div class="av-container">
    <Head eyebrow={copy.label} title={copy.title} lede={copy.sub} maxCh={20}>
      {#snippet aside()}
        <a class="av-btn av-btn-primary" href={githubUrl} target="_blank" rel="noopener"><GithubIcon size={16} /> {copy.cta} ↗</a>
        {#if starCount}<span class="av-kicker">{starCount} {copy.starsLabel}</span>{/if}
      {/snippet}
    </Head>

    <div class="av-grid av-grid-3">
      {#each community.cards as c}
        <article class="av-card av-lively eg-card">
          <div class="av-card-icon">
            {#if c.icon === 'github'}
              <GithubIcon size={20} />
            {:else if c.icon === 'discord'}
              <DiscordIcon size={20} />
            {:else}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path
                  d="M4 5.5A2.5 2.5 0 0 1 6.5 3h8A2.5 2.5 0 0 1 17 5.5v5a2.5 2.5 0 0 1-2.5 2.5H9l-4 3.5v-3.5A2.5 2.5 0 0 1 4 10.5v-5z"
                />
                <path d="M17 9h.5A2.5 2.5 0 0 1 20 11.5v5a2.5 2.5 0 0 1-2.5 2.5H17v3l-3.5-3H11" />
              </svg>
            {/if}
          </div>
          <h3>{c.title}</h3>
          <p>{c.body}</p>
          <a class="av-link" href={c.url} target="_blank" rel="noopener">{c.cta} ↗</a>
          {#if c.more}
            <p class="av-small eg-more">
              {#each c.more as m}
                <a class="av-link-quiet" href={m.url} target="_blank" rel="noopener">{m.text} ↗</a>
              {/each}
            </p>
          {/if}
        </article>
      {/each}
    </div>
  </div>
</section>

<style>
  .eg-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .eg-card > p {
    flex: 1;
  }
  .eg-more {
    flex: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 1rem;
    margin-top: 0.75rem;
  }
</style>
