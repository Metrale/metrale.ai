<script>
  // Ledger entry 07. The repository and the Discord, as one band: where the work
  // happens, and where to join it.
  import { stars as copy, community, githubUrl, discordUrl } from '$lib/data.js';
  import GithubIcon from './GithubIcon.svelte';
  import DiscordIcon from './DiscordIcon.svelte';
  import SectionHead from './SectionHead.svelte';
</script>

<section id="community" class="section-alt sx-gold">
  <div class="container">
    <SectionHead label={copy.label} title={copy.title} sub={copy.sub} prov="the repository" provUrl={githubUrl} />

    <div class="star-cta-row">
      <a class="btn btn-primary" href={githubUrl} target="_blank" rel="noopener">
        <GithubIcon size={16} />
        {copy.cta}
      </a>
    </div>

    <div class="community-band">
      <div class="community-copy">
        <div class="slabel">{community.label}</div>
        <h3 class="community-title">{community.title}</h3>
        <p class="community-body">{community.body}</p>
      </div>
      <div class="community-cta">
        <a class="btn btn-discord btn-lg" href={discordUrl} target="_blank" rel="noopener">
          <DiscordIcon size={20} />
          {community.cta}
        </a>
        <span class="community-sub">{community.sub}</span>
      </div>
    </div>
  </div>
</section>
