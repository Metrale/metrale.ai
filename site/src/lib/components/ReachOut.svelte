<script>
  // The closing band, the front page's pattern: the ask, the primary action,
  // then the three doors in. Copy from `reachout` in data.js; the demo route
  // from the site's route table, so the two pages cannot point at different
  // forms.
  import { reachout, discordUrl } from '$lib/data.js';
  import { routes } from '$lib/content/brand.js';
  import DiscordIcon from './DiscordIcon.svelte';
</script>

<section id="reach" class="av av-section av-section-tight av-sx-gold">
  <div class="av-container">
    <div class="av-band">
      <div class="av-band-grid">
        <div>
          <p class="av-eyebrow">{reachout.label}</p>
          <h2 class="av-h2">{reachout.title}</h2>
          <p class="av-lede">{reachout.sub}</p>
        </div>
        <div class="av-row eg-reach-actions">
          <a class="av-btn av-btn-primary av-btn-lg" href={routes.demoForm}>{reachout.primaryCta} <span class="av-arrow">→</span></a>
          {#each reachout.emails as e}
            <a class="av-btn av-btn-secondary av-btn-lg eg-reach-mail" href={`mailto:${e}`}>{e}</a>
          {/each}
          <a class="av-link eg-reach-discord" href={discordUrl} target="_blank" rel="noopener">
            <DiscordIcon size={16} />
            {reachout.discordCta} ↗
          </a>
        </div>
      </div>
      <div class="av-grid av-grid-3 eg-reach-doors">
        {#each reachout.cards as c}
          <div class="eg-reach-door">
            <span class="av-card-icon" aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                {#if c.icon === 'briefcase'}
                  <rect x="3" y="7" width="18" height="13" rx="2" />
                  <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
                {:else if c.icon === 'handshake'}
                  <path d="M2 9l4-4 5 3 3-2 4 3 4-1v8l-4 3-4-3-3 2-5-3-4 1z" />
                  <path d="M11 8l3 3M8 11l3 3" />
                {:else}
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                  <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
                {/if}
              </svg>
            </span>
            <h3 class="av-h4">{c.title}</h3>
            <p class="av-body">{c.body}</p>
          </div>
        {/each}
      </div>
    </div>
  </div>
</section>

<style>
  .eg-reach-actions {
    justify-content: flex-end;
  }
  .eg-reach-mail {
    font-family: var(--font-mono);
    font-size: 0.92rem;
    font-weight: 500;
  }
  .eg-reach-discord {
    width: 100%;
    justify-content: flex-end;
    font-size: 0.92rem;
  }
  .eg-reach-doors {
    margin-top: 2.5rem;
    padding-top: 2rem;
    border-top: 1px solid var(--border);
  }
  .eg-reach-door {
    display: grid;
    gap: 0.35rem;
    align-content: start;
  }
  .eg-reach-door .av-card-icon {
    margin-bottom: 0.6rem;
  }
  @media (max-width: 900px) {
    .eg-reach-actions,
    .eg-reach-discord {
      justify-content: flex-start;
    }
  }
  @media (max-width: 480px) {
    .eg-reach-actions .av-btn {
      width: 100%;
    }
    .eg-reach-mail {
      font-size: 0.84rem;
    }
  }
</style>
