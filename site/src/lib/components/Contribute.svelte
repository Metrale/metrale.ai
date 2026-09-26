<script>
  // How to join, then what is being built. Two card rows in one section: they
  // share an audience and both end in a repository link.
  import { contribute, roadmap } from '$lib/data.js';
  import Head from './engine/lower/Head.svelte';

  const statusChip = (tone) => (tone === 'plain' ? 'av-chip' : `av-chip av-chip-${tone}`);
</script>

<section id="contribute" class="av av-section av-section-alt av-sx-gold">
  <div class="av-container">
    <Head eyebrow={contribute.label} title={contribute.title} lede={contribute.sub} maxCh={20}>
      {#snippet aside()}
        <div class="eg-licence">
          <span class="av-chip av-chip-gold">MIT OR Apache-2.0</span>
          <p class="av-small">
            {contribute.licence}
            {#each contribute.licences as l}
              <a class="av-link-quiet" href={l.url} target="_blank" rel="noopener">{l.text} ↗</a>
            {/each}
          </p>
        </div>
      {/snippet}
    </Head>

    <div class="av-grid av-grid-4">
      {#each contribute.paths as p}
        <a class="av-card av-card-link eg-path" href={p.url} target="_blank" rel="noopener">
          <p class="av-card-tag">{p.tag}</p>
          <h3>{p.title}</h3>
          <p>{p.body}</p>
          <span class="av-link">{p.cta} <span class="av-arrow">↗</span></span>
        </a>
      {/each}
    </div>

    <div class="eg-road" id="roadmap">
      <div class="eg-road-head">
        <p class="av-card-tag">{roadmap.label}</p>
        <h3 class="av-h3">{roadmap.rowTitle}</h3>
        <p class="av-body">{roadmap.rowSub}</p>
      </div>
      <div class="av-grid av-grid-2">
        {#each roadmap.items as item}
          <article class="av-card eg-road-card">
            <div class="eg-road-top">
              <h4>{item.title}</h4>
              <span class={statusChip(item.tone)}>{item.status}</span>
            </div>
            <p>{item.body}</p>
            <a class="av-link" href={item.url} target="_blank" rel="noopener">{item.cta} ↗</a>
          </article>
        {/each}
      </div>
    </div>
  </div>
</section>

<style>
  .eg-licence {
    display: grid;
    gap: 0.5rem;
    justify-items: end;
    max-width: 34ch;
    text-align: right;
  }
  .eg-licence p {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.25rem 0.75rem;
  }
  .eg-path {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .eg-path > p:not(.av-card-tag) {
    flex: 1;
  }
  .eg-road {
    margin-top: 3.5rem;
    padding-top: 2.5rem;
    border-top: 1px solid var(--border);
  }
  .eg-road-head {
    max-width: 62ch;
    margin-bottom: 1.75rem;
  }
  .eg-road-head .av-h3 {
    margin-bottom: 0.6rem;
  }
  .eg-road-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.6rem;
  }
  .eg-road-top h4 {
    font-size: 1.05rem;
    letter-spacing: -0.01em;
  }
  .eg-road-top .av-chip {
    white-space: nowrap;
  }
  .eg-road-card p {
    color: var(--t2);
    font-size: 0.94rem;
    line-height: 1.6;
  }
  .eg-road-card .av-link {
    margin-top: 1rem;
    font-size: 0.9rem;
  }
  @media (max-width: 900px) {
    .eg-licence {
      justify-items: start;
      text-align: left;
    }
    .eg-licence p {
      justify-content: flex-start;
    }
  }
</style>
