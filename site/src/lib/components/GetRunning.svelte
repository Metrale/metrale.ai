<script>
  // The one section on /engine where code belongs: three commands, in the
  // order an operator runs them, and the two things a careful one checks
  // first. Every command restates the launcher's own README, and
  // engine-lower.test.js holds the two in lockstep.
  import vendors from '$lib/models.generated.json';
  import { flagshipRecipe, getRunning as copy, guideUrl, recipesUrl } from '$lib/data.js';
  import { links } from '$lib/content/brand.js';
  import { currentInstall } from '$lib/install/host.svelte.js';
  import { copyLabel, copyOrSelect } from '$lib/clipboard.js';
  import Head from './engine/lower/Head.svelte';

  // The command, the shell it goes in, and where it lands all move together:
  // a Windows visitor shown `bash` and `~/.local/bin` has been told three
  // things, none of which are true on their machine.
  const install = $derived(currentInstall());

  // The flagship's checkpoint is read off the registry tree, never typed. A
  // flagship that is not in the tree is a broken page, and the build says so.
  const flagship = vendors.flatMap((v) => v.subfamilies.flatMap((f) => f.recipes)).find((r) => r.recipeId === flagshipRecipe);
  if (!flagship) throw new Error(`GetRunning: ${flagshipRecipe} is not in models.generated.json`);

  const steps = $derived(
    copy.steps.map((s, i) => ({
      ...s,
      command: i === 0 ? install.command : s.command,
      note: s.note.replace('{installDir}', install.installDir).replace('{model}', flagship.hfId),
    }))
  );

  // One flash at a time, keyed by command: several rows are on screen and
  // only the one clicked may change.
  let copied = $state('');
  let copyState = $state('idle'); // idle | copied | manual | blocked
  let copyTimer;
  // The flash outlives the component on navigation without this.
  $effect(() => () => clearTimeout(copyTimer));

  async function copyCmd(cmd, el) {
    clearTimeout(copyTimer);
    copied = cmd;
    // A refusal is reported, not swallowed: an unchanged button reads as
    // success to the person who clicked it.
    copyState = await copyOrSelect(cmd, el);
    copyTimer = setTimeout(() => {
      if (copied === cmd) {
        copied = '';
        copyState = 'idle';
      }
    }, 2400);
  }
  const codeOf = (e) => e.currentTarget.parentElement?.querySelector('code');
</script>

<section id="run" class="av av-section av-section-alt av-sx-violet">
  <div class="av-container">
    <Head eyebrow={copy.label} title={copy.title} lede={copy.sub} maxCh={26} />

    <div class="eg-run">
      <div class="av-card eg-term">
        <div class="eg-term-head">
          <span class="av-kicker"><span class="av-dot"></span> {install.shell}</span>
          <span class="av-small av-mono">{install.installDir}</span>
        </div>
        <ol class="eg-steps">
          {#each steps as s, i}
            <li class="eg-step">
              <span class="eg-step-n av-mono" aria-hidden="true">0{i + 1}</span>
              <div class="eg-step-body">
                <h3>{s.title}</h3>
                <div class="eg-cmd" role="group" aria-label={s.title}>
                  <span class="eg-prompt av-mono" aria-hidden="true">{install.prompt}</span>
                  <code class="av-mono">{s.command}</code>
                  <button type="button" class="eg-copy" onclick={(e) => copyCmd(s.command, codeOf(e))} aria-label={`Copy ${s.command}`}>
                    {copied === s.command ? copyLabel(copyState) : 'Copy'}
                  </button>
                </div>
                <p class="av-small">{s.note}</p>
              </div>
            </li>
          {/each}
        </ol>
        <p class="eg-req av-small">{copy.requirements}</p>
      </div>

      <aside class="eg-side">
        <div class="av-card">
          <p class="av-card-tag">{copy.inspect.title}</p>
          <p class="av-body">{copy.inspect.body}</p>
          <ul class="eg-inspect">
            {#each copy.inspect.items as it}
              <li>
                <div class="eg-cmd eg-cmd-sm">
                  <code class="av-mono">{it.command}</code>
                  <button type="button" class="eg-copy" onclick={(e) => copyCmd(it.command, codeOf(e))} aria-label={`Copy ${it.command}`}>
                    {copied === it.command ? copyLabel(copyState) : 'Copy'}
                  </button>
                </div>
                <p class="av-small">{it.note}</p>
              </li>
            {/each}
          </ul>
        </div>
        <div class="av-card">
          <p class="av-card-tag">{copy.installer.title}</p>
          <ul class="av-list-check">
            {#each copy.installer.items as it}
              <li>{it}</li>
            {/each}
          </ul>
        </div>
        <p class="eg-links av-small">
          <a class="av-link" href={guideUrl} target="_blank" rel="noopener">{copy.docsCta} ↗</a>
          <a class="av-link" href={links.docs} target="_blank" rel="noopener">{copy.docsSiteCta} ↗</a>
          <a class="av-link" href={recipesUrl} target="_blank" rel="noopener">{copy.readmeCta} ↗</a>
        </p>
      </aside>
    </div>
  </div>
</section>

<style>
  .eg-run {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr);
    gap: 1.5rem;
    align-items: start;
  }
  .eg-term {
    padding: 0;
  }
  .eg-term-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 0.85rem 1.4rem;
    background: var(--bg2);
    border-bottom: 1px solid var(--border);
  }
  .eg-steps {
    display: grid;
  }
  .eg-step {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr);
    gap: 1rem;
    padding: 1.4rem;
    border-bottom: 1px solid var(--border);
  }
  .eg-step:last-child {
    border-bottom: 0;
  }
  .eg-step-n {
    padding-top: 0.15rem;
    font-size: 1.4rem;
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1;
    background: linear-gradient(120deg, var(--ch-violet), var(--ch-cyan));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .eg-step-body {
    display: grid;
    gap: 0.6rem;
    min-width: 0;
  }
  .eg-step-body h3 {
    margin: 0;
    font-size: 1.02rem;
  }
  .eg-cmd {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
    background: var(--sunk);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    padding: 0.55rem 0.55rem 0.55rem 0.9rem;
  }
  .eg-cmd-sm {
    padding: 0.4rem 0.4rem 0.4rem 0.7rem;
  }
  .eg-prompt {
    color: var(--sx-text);
    font-weight: 700;
    flex-shrink: 0;
  }
  .eg-cmd code {
    flex: 1;
    min-width: 0;
    font-size: 0.82rem;
    color: var(--t1);
    overflow-x: auto;
    white-space: nowrap;
    scrollbar-width: thin;
  }
  .eg-cmd-sm code {
    font-size: 0.76rem;
  }
  .eg-copy {
    flex-shrink: 0;
    border-radius: 999px;
    padding: 0.38rem 0.8rem;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: 1.2;
    cursor: pointer;
    background: var(--accent-soft);
    color: var(--accent-deep);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    transition:
      background 0.15s,
      color 0.15s;
  }
  .eg-copy:hover {
    background: var(--accent-fill);
    color: var(--on-accent);
  }
  .eg-req {
    padding: 0.9rem 1.4rem;
    border-top: 1px solid var(--border);
    background: var(--bg2);
  }
  .eg-side {
    display: grid;
    gap: 1rem;
  }
  .eg-inspect {
    display: grid;
    gap: 0.9rem;
    margin-top: 0.9rem;
  }
  .eg-inspect li {
    display: grid;
    gap: 0.35rem;
  }
  .eg-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.25rem;
    padding: 0 0.25rem;
  }
  @media (max-width: 900px) {
    .eg-run {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 720px) {
    .eg-step {
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 0.75rem;
      padding: 1.1rem 1rem;
    }
    .eg-step-n {
      font-size: 1.1rem;
    }
    .eg-term-head,
    .eg-req {
      padding-left: 1rem;
      padding-right: 1rem;
    }
    .eg-prompt {
      display: none;
    }
    .eg-cmd {
      flex-wrap: wrap;
    }
    .eg-cmd code {
      flex-basis: 100%;
    }
  }
</style>
