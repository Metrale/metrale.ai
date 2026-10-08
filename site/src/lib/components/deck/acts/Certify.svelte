<script>
  // Act III — what turns a measurement into evidence, and why the margin is a
  // mechanism rather than a configuration artefact. The floors are read from
  // the gate limits the engine commits; nothing here is a typed number.
  import Slide from '../Slide.svelte';
  import Cmd from '../Cmd.svelte';
  import { claim, floors, gateFacts, kLadder, proof, qualityGates } from '$lib/deck/content.js';

  const fmt = (v, digits = 0) => (v === null || v === undefined ? '—' : Number(v).toFixed(digits));
</script>

<Slide
  eyebrow="Step 6"
  title="Mint a record: the command that gates every pull request"
  lede="The same subcommand in its other mode. It serves the benchmark's own recipe on a free port, waits for a cold NVFP4 load, measures, tears down, and writes a signed record; --url and --pull-request-gate are mutually exclusive by design, so an experiment can never become evidence by accident."
>
  <div class="dk-cols">
    <div class="stack">
      <Cmd
        label="one gate, then every gate the commit still owes"
        lines={[
          `./target/release/met benchmark run concurrency-sweep \\`,
          `    --pull-request-gate --yes`,
          ``,
          `./target/release/met benchmark certify --dry-run    # the plan`,
          `./target/release/met benchmark certify --yes`,
          ``,
          `met benchmark --pull-request-gate-check    # what CI then runs`,
        ]}
        note="certify runs every gate the commit still owes and says whether the tree is certified when they are done; it stops on a failed verdict unless given --keep-going. Each run writes .benchmarks/<id>/<date>-<sha>.json carrying the metrics, the verdict, the hardware fingerprint, the exact command and the commit sha, with a .sig beside it. A record is voided by content: a change under crates/, kernels/, Cargo.toml, Cargo.lock, vendor/, 3rdparty_patches/, rust-toolchain.toml or jinja-templates/ invalidates it, a dirty tree fails, and an entry declaring no thresholds fails rather than passes."
      />
      <div class="dk-stats">
        <div><b>{gateFacts.registered}</b><span>benchmarks registered</span></div>
        <div><b>{gateFacts.signed}</b><span>signed records of {gateFacts.committed} committed</span></div>
        <div><b>{gateFacts.concurrencyPass}/{gateFacts.concurrencyRecords}</b><span>concurrency records passing</span></div>
      </div>
    </div>
    <div>
      <p class="dk-card-h">Floors CI holds for {claim.checkpoint}</p>
      {#if floors.declared}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div class="dk-scroll" tabindex="0">
          <table class="dk-table floors">
            <thead>
              <tr><th>rung</th><th>min tok/s</th><th>max J/token, GPU rail</th></tr>
            </thead>
            <tbody>
              {#each floors.rows as f}
                <tr><td class="mono">C={f.c}</td><td class="mono">{fmt(f.tokS)}</td><td class="mono">{fmt(f.jPerTok, 2)}</td></tr>
              {/each}
              <tr><td class="mono">peak</td><td class="mono">{fmt(floors.peak)}</td><td class="mono">—</td></tr>
              <tr><td class="mono">completion tokens</td><td class="mono">≥ {fmt(floors.minCompletion)}</td><td class="mono">—</td></tr>
              <tr><td class="mono">vacuous cells</td><td class="mono">≤ {fmt(floors.vacuous)}</td><td class="mono">—</td></tr>
            </tbody>
          </table>
        </div>
      {:else}
        <p class="dk-prose">No floors are declared for this checkpoint in the gate limits the site was built against.</p>
      {/if}
      <p class="dk-note">
        Absolute per-metric bounds committed beside the kernels, not a percentage band, re-cut only from fresh reps on the same instrument.
        The same certify command also runs the gates that judge something other than speed — {qualityGates.join(', ')} — whose records are charted
        on the benchmarks page.
      </p>
    </div>
  </div>
</Slide>

<Slide
  eyebrow="Mechanism"
  title="Where the margin comes from"
  lede="Ask this before the numbers. A speedup with no stated mechanism and no known ceiling is a configuration artefact waiting to be found."
>
  <div class="dk-mech">
    <article>
      <h3>Speculation, width-laddered</h3>
      <p>
        {claim.speculation}. The draft width is chosen per concurrency (<span class="dk-code">{kLadder}</span>) rather than fixed, so
        verification cost never exceeds the win.
      </p>
    </article>
    <article>
      <h3>Prefill co-dispatch and fp8 row-wise</h3>
      <p>
        Prefill overlaps decode rather than stalling it, and row-wise fp8 moves fewer bytes on the bandwidth-bound path. Decode at this
        scale is a memory-traffic problem, so this is where a real win has to come from.
      </p>
    </article>
    {#if proof.baselineFallsAtTop}
      <article>
        <h3>Why C={proof.topC} is the widest rung</h3>
        <p>
          The baseline's C={proof.topC} ({proof.topBaseline} tok/s) falls below its own C={proof.prevC} when speculation stays on at high concurrency;
          the subject has already switched it off. The margin is a scheduling decision, which is why it reproduces.
        </p>
      </article>
    {/if}
    <article>
      <h3>The pin that is load-bearing</h3>
      <p>
        Batch cap 128 on both engines at every rung, independent of the concurrency driven. A matched cap-32 pair inverted the ordering on
        the same box the same day; re-measured at cap 128 the ordering held with non-overlapping distributions. If you re-cap to survive a
        hazard, say so beside the number and re-pin both engines.
      </p>
    </article>
  </div>
</Slide>

<style>
  .stack {
    display: grid;
    gap: 1rem;
    min-width: 0;
  }
  .floors {
    min-width: 22rem;
  }
  .dk-mech {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1.25rem 1.75rem;
  }
  @media (min-width: 720px) {
    .dk-mech {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }
  .dk-mech article {
    min-width: 0;
    border-top: 2px solid var(--sx);
    padding-top: 0.8rem;
  }
  .dk-mech h3 {
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin-bottom: 0.45rem;
  }
  .dk-mech p {
    color: var(--t2);
    line-height: 1.6;
    font-size: 0.9rem;
  }
</style>
