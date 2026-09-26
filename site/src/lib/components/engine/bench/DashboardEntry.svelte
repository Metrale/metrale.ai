<script>
  // The dashboard's entry point inside the Verified section: one control per
  // benchmark family, each opening the hero's dashboard on that family's tab
  // through its deep link, and one that opens it as a click on the receipt
  // would. Copy is `verified.dashboard` in data.js.
  import { verified } from '$lib/data.js';
  import { DASHBOARD_ENTRIES, entryHash } from './entries.js';
  import { openDashboard } from './open-dashboard.js';

  const copy = verified.dashboard;
</script>

<div class="eg-entry">
  <div class="eg-entry-copy">
    <p class="av-kicker"><span class="av-dot"></span> {copy.kicker}</p>
    <h3 class="av-h3">{copy.title}</h3>
    <p class="av-body">{copy.body}</p>
  </div>
  <div class="eg-entry-actions">
    <div class="eg-entry-tabs" role="group" aria-label={copy.groupLabel}>
      {#each DASHBOARD_ENTRIES as e (e.id)}
        <button type="button" class="eg-entry-tab" onclick={() => openDashboard(entryHash(e.id))} aria-haspopup="dialog">
          {e.label}
        </button>
      {/each}
    </div>
    <button type="button" class="av-btn av-btn-secondary eg-entry-open" onclick={() => openDashboard('')} aria-haspopup="dialog">
      {copy.cta} <span class="av-arrow">→</span>
    </button>
  </div>
</div>

<style>
  .eg-entry {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 2rem 3rem;
    align-items: center;
    margin-top: 3rem;
    padding: 2rem 2.2rem;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--av-radius);
    box-shadow: var(--av-shadow);
  }
  .eg-entry-copy .av-h3 {
    margin-top: 0.9rem;
  }
  .eg-entry-copy .av-body {
    margin-top: 0.6rem;
    max-width: 48ch;
  }
  .eg-entry-actions {
    display: grid;
    gap: 1.1rem;
    justify-items: start;
  }
  .eg-entry-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }
  /* The same pill the dashboard's subject strip wears, so the page teaches
     the modal's vocabulary before it opens. */
  .eg-entry-tab {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.5rem 0.95rem;
    border-radius: 999px;
    border: 1px solid var(--border-strong);
    background: var(--bg);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--t2);
    cursor: pointer;
    transition:
      border-color 0.18s,
      color 0.18s,
      background 0.18s;
  }
  .eg-entry-tab::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--border-strong);
    transition: background 0.18s;
  }
  .eg-entry-tab:hover {
    border-color: color-mix(in srgb, var(--sx) 45%, transparent);
    background: color-mix(in srgb, var(--sx) 12%, transparent);
    color: var(--sx-text);
  }
  .eg-entry-tab:hover::before {
    background: var(--sx);
  }
  @media (max-width: 900px) {
    .eg-entry {
      grid-template-columns: minmax(0, 1fr);
      padding: 1.6rem 1.4rem;
      gap: 1.5rem;
    }
  }
  @media (pointer: coarse) {
    .eg-entry-tab {
      min-height: 42px;
    }
  }
</style>
