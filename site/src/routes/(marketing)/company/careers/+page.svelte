<!--
  /company/careers. How the work is done, the fastest way in, the planned first
  hires, and a way to raise a hand. Copy is `careers` in
  src/lib/content/company.js. The roles are `src/lib/content/positions.jsonl`,
  one per line, read here through the JSON the build generates from it; the
  search and the team chips narrow them in the page. The form is the site's one
  form component, and its role list is the same file.
-->
<script>
  import PageShell from '$lib/components/avarok/PageShell.svelte';
  import PageHero from '$lib/components/avarok/PageHero.svelte';
  import CtaBand from '$lib/components/avarok/CtaBand.svelte';
  import DemoForm from '$lib/components/avarok/DemoForm.svelte';
  import { careers as c } from '$lib/content/company.js';
  import { routes, links, contacts } from '$lib/content/brand.js';
  import { filterPositions, statusLabel, teamsOf } from '$lib/content/positions.js';
  import generated from '$lib/positions.generated.json';

  const all = generated.positions;
  const teams = ['All', ...teamsOf(all)];
  const hues = ['violet', 'cyan', 'green', 'gold'];
  const statusHue = { planned: 'gold', open: 'green', filled: '' };
  const mailFor = (role) => `mailto:${contacts.careers}?subject=${encodeURIComponent(role)}`;
  // The form offers the roles from the same file, so a role added there is in
  // the select without a second edit.
  const form = {
    ...c.form,
    fields: c.form.fields.map((f) => (f.name === 'role' ? { ...f, options: [...all.map((p) => p.title), c.roleOther] } : f)),
  };

  let q = $state('');
  let team = $state('All');
  const shown = $derived(filterPositions(all, { q, team }));
  const clear = () => {
    q = '';
    team = 'All';
  };
</script>

<PageShell path={routes.careers}>
  <PageHero
    eyebrow={c.eyebrow}
    title={c.title}
    lede={c.lede}
    primary={c.apply}
    secondary={{ text: 'The repository', href: links.github, external: true }}
    color="gold"
  />

  <section class="av-section av-section-alt">
    <div class="av-container">
      <div class="av-split av-split-wide av-reveal" style="align-items:start">
        <div>
          <p class="av-eyebrow av-sx-gold">{c.culture.eyebrow}</p>
          <h2 class="av-creed">
            {#each c.culture.lines as line}<span>{line}</span>{/each}
          </h2>
          <p class="av-body" style="margin-top:1.4rem;max-width:52ch">{c.culture.body}</p>
        </div>
        <div class="av-grid av-grid-2">
          {#each c.benefits as b, i}
            <div class="av-card av-lively av-sx-{hues[i]}">
              <span class="av-lively-n av-mono" aria-hidden="true">0{i + 1}</span>
              <h3>{b.title}</h3>
              <p>{b.body}</p>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </section>

  <section class="av-section av-section-tight">
    <div class="av-container">
      <div class="av-band av-reveal">
        <div class="av-band-grid">
          <div>
            <p class="av-eyebrow">{c.fastTrack.eyebrow}</p>
            <h2 class="av-h2">{c.fastTrack.title}</h2>
            <p class="av-lede">{c.fastTrack.body}</p>
          </div>
          <div class="av-row" style="justify-content:flex-end">
            <a class="av-btn av-btn-primary av-btn-lg" href={c.fastTrack.primary.href} target="_blank" rel="noopener"
              >{c.fastTrack.primary.text} <span class="av-arrow">↗</span></a
            >
            <a class="av-btn av-btn-ghost av-btn-lg" href={c.fastTrack.secondary.href} target="_blank" rel="noopener"
              >{c.fastTrack.secondary.text}</a
            >
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="av-section" id="roles">
    <div class="av-container">
      <div class="av-head-split av-reveal">
        <div>
          <p class="av-eyebrow">{c.rolesTitle}</p>
          <h2 class="av-h2">{c.rolesHeading}</h2>
        </div>
        <p class="av-lede" style="max-width:40ch">{c.how}</p>
      </div>

      <div class="av-roles-filter av-reveal" role="search" aria-label="Roles">
        <div class="av-field av-roles-search">
          <label for="roles-q">{c.search.label}</label>
          <input id="roles-q" type="search" bind:value={q} placeholder={c.search.placeholder} autocomplete="off" />
        </div>
        <div class="av-roles-teams" role="group" aria-label={c.search.teams}>
          {#each teams as t}
            <button
              type="button"
              class="av-chip av-roles-chip"
              class:is-on={team === t}
              aria-pressed={team === t}
              onclick={() => (team = t)}>{t}</button
            >
          {/each}
        </div>
        <p class="av-roles-count" aria-live="polite">{shown.length} of {all.length} {all.length === 1 ? 'role' : 'roles'}</p>
      </div>

      {#if shown.length}
        <div class="av-accordion av-reveal">
          {#each shown as r (r.id)}
            <details id={r.id}>
              <summary
                ><span class="av-role-head"
                  >{r.title}
                  <span class="av-small av-role-meta">{r.location} · {r.team}</span>
                  <span class="av-chip av-chip-{statusHue[r.status]} av-role-status">{statusLabel(r.status)}</span></span
                ><span class="av-plus" aria-hidden="true">+</span></summary
              >
              <div class="av-answer">
                <p>{r.summary}</p>
                <div class="av-role-more">
                  <div>
                    <p class="av-card-tag">{c.search.work}</p>
                    <ul class="av-list-check av-sx-green">
                      {#each r.does as d}<li>{d}</li>{/each}
                    </ul>
                  </div>
                  <div>
                    <p class="av-card-tag">{c.search.requirements}</p>
                    <ul class="av-list-check av-sx-violet">
                      {#each r.requirements as d}<li>{d}</li>{/each}
                    </ul>
                  </div>
                </div>
                <div class="av-row" style="margin-top:1.1rem">
                  <a class="av-btn av-btn-secondary av-btn-sm" href={mailFor(r.title)}>Apply by email</a>
                  <a class="av-btn av-btn-ghost av-btn-sm" href={c.apply.href}>Or use the form</a>
                </div>
              </div>
            </details>
          {/each}
        </div>
      {:else}
        <p class="av-body av-roles-none av-reveal">
          {c.search.none} <button type="button" class="av-link-btn" onclick={clear}>{c.search.clear}</button>
        </p>
      {/if}
    </div>
  </section>

  <section class="av-section av-section-alt" id="apply" style="scroll-margin-top:80px">
    <div class="av-container av-narrow av-reveal">
      <DemoForm {form} source="careers" to={contacts.careers} subject={(v) => `Metrale careers, ${v.role || ''}, ${v.name || ''}`} />
    </div>
  </section>

  <CtaBand
    title="Do not see your role?"
    body="Send the note anyway. A pull request against the engine is the best introduction there is."
    primary={c.apply}
    secondary={{ text: 'Good first issues', href: `${links.github}/labels/good%20first%20issue`, external: true }}
  />
</PageShell>

<style>
  /* The creed: four short lines, set large, each a step quieter than the last. */
  .av-creed {
    display: grid;
    gap: 0.35rem;
    font-size: clamp(1.5rem, 2.6vw, 2.15rem);
    line-height: 1.16;
    letter-spacing: -0.03em;
  }
  .av-creed span:nth-child(2) {
    color: var(--t2);
  }
  .av-creed span:nth-child(3) {
    color: var(--t2);
    opacity: 0.85;
  }
  .av-creed span:nth-child(4) {
    color: var(--ch-gold-text);
  }

  /* The search and the team chips over the roles. One row on a desk, stacked
     on a phone; the count sits under both and reads out to a screen reader
     when it changes. */
  .av-roles-filter {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.9rem 1.4rem;
    align-items: end;
    margin: 1.6rem 0 1.2rem;
  }
  .av-roles-search input {
    min-height: 44px;
  }
  .av-roles-teams {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    padding-bottom: 0.2rem;
  }
  .av-roles-chip {
    cursor: pointer;
    transition:
      border-color 0.15s,
      color 0.15s,
      background 0.15s;
  }
  .av-roles-chip:hover {
    border-color: var(--accent);
  }
  .av-roles-chip.is-on {
    color: var(--ch-violet-text);
    border-color: color-mix(in srgb, var(--ch-violet) 40%, transparent);
    background: color-mix(in srgb, var(--ch-violet) 12%, transparent);
  }
  .av-roles-chip:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .av-roles-count {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--t3);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .av-role-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.6rem;
  }
  .av-role-meta {
    font-weight: 500;
  }
  .av-role-status {
    font-size: 0.6rem;
    padding: 0.14rem 0.45rem;
  }
  .av-roles-none {
    padding: 1.4rem 0;
  }
  .av-link-btn {
    background: none;
    border: 0;
    padding: 0;
    font: inherit;
    color: var(--accent);
    text-decoration: underline;
    cursor: pointer;
  }
  .av-link-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  details {
    scroll-margin-top: 90px;
  }
  .av-role-more {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: 1.5rem;
    margin-top: 1.1rem;
    padding-top: 1.1rem;
    border-top: 1px dashed var(--border-strong);
  }
  @media (max-width: 720px) {
    .av-roles-filter {
      grid-template-columns: minmax(0, 1fr);
    }
    .av-role-more {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
