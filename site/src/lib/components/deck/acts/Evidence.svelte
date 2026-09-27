<script>
  // Act IV — everything that decides whether the number survives contact with
  // time: the self-audit, the artifact kit and the notebook, and the licence
  // and provenance posture behind them.
  import Slide from '../Slide.svelte';
  import Audit from '../Audit.svelte';
  import Kv from '../Kv.svelte';
  import { audit, claim, fragile, links } from '$lib/deck/content.js';
</script>

<Slide
  act="green"
  eyebrow="Self-audit"
  title="Ten ways to fake this, answered"
  lede="Heiser's benchmarking-crimes taxonomy, run against our own campaign. Three rows stay open, because a checklist with nothing open is marketing."
>
  <Audit rows={audit} />
</Slide>

<Slide
  act="gold"
  eyebrow="Evidence"
  title="The reproduction kit, and the notebook behind it"
  lede="A reproduction that needs a conversation with us is not one. Everything below is already in the repository, and the campaign log records what failed as well as what held."
>
  <div class="dk-cols">
    <Kv
      rows={[
        ['code', claim.engine, 'every gate record names the commit it measured, and its .sig binds the two'],
        ['baseline', 'container digest', 'sha256, not a tag; the same digest across every leg'],
        ['harness', 'sha256 in every output', 'the script hashes its own source into the JSON it writes'],
        ['weights', claim.checkpoint, 'HF repository, pinned revision'],
        ['seeds', `seed ${claim.seed}, temp ${claim.temperature}`, 'constants in the harness, not flags'],
        ['raw data', 'per-rung JSON', 'every rep, not the aggregate, under bench/ladder38/'],
        ['record', claim.resultsDoc, 'the lab notebook, including what failed'],
      ]}
    />
    <div class="stack">
      <ul class="dk-list">
        <li>
          <span class="dk-tag">retraction</span><span
            >A regression claim was withdrawn once it turned out to be a cross-box comparison; the withdrawal sits in the file above the
            claim it replaced.</span
          >
        </li>
        <li>
          <span class="dk-tag">negative</span><span
            >Hypotheses closed as negative results stay in the log, including the K-ladder A/B and a throughput metric rejected as a gate.</span
          >
        </li>
        <li>
          <span class="dk-tag">discarded</span><span
            >Completed runs measured on the wrong box were thrown away rather than kept as the better number.</span
          >
        </li>
        <li>
          <span class="dk-tag">excluded</span><span
            >Driver version excluded by measuring across boxes and drivers; thermals excluded by re-baselining after a physical move.</span
          >
        </li>
      </ul>
      <aside class="dk-card">
        <p class="dk-card-h">What we would ask of you</p>
        <p>
          Rent your own GB10 hour and run the two legs back to back. If a rung disagrees with our table by more than its published spread,
          that is a finding and we want it; the fragile rungs ({fragile.rungs}) are where to spend the budget first.
        </p>
      </aside>
    </div>
  </div>
</Slide>

<Slide
  act="gold"
  eyebrow="Provenance"
  title="Licence and invariants, enforced rather than declared"
  lede="The first question counsel asks about a serving engine is the licence; the second is what a machine refuses. Both, with the mechanism that keeps them honest."
>
  <div class="dk-cols">
    <Kv
      rows={[
        ['licence', 'MIT OR Apache-2.0', 'permissive, at the user’s option, the pair most of the Rust ecosystem ships under'],
        ['headers', 'SPDX line 1, every source file', 'CI-enforced against .licenserc.yaml'],
        ['dependencies', 'deny.toml allowlist', 'licence policy as a lockfile, not a policy document'],
        ['third party', 'THIRD_PARTY_NOTICES.md', 'vendored code keeps its own licence and is never restamped'],
        ['provenance', 'signed records, ancestry check', 'unrecorded history is rejected at merge'],
        ['structure', '500-line cap per source file', 'enforced in CI, alongside clippy at deny-warnings'],
        ['correctness', 'serve matrix per image', 'boot, coherence, greedy determinism and tool reliability before an image ships'],
      ]}
    />
    <div class="stack">
      <ul class="dk-links">
        <li><span>results</span><a href={links.results} target="_blank" rel="noopener">{claim.resultsDoc}</a></li>
        <li><span>source</span><a href={links.repo} target="_blank" rel="noopener">{links.repoLabel}</a></li>
        <li><span>gates</span><a href={links.gateDoc} target="_blank" rel="noopener">what “verified” means</a></li>
        <li><span>charts</span><a href="/benchmarks">every gate record, on the benchmarks page</a></li>
      </ul>
      <p class="dk-note">
        Every number in this deck is read from the same generated records the front page renders. If the ladder is re-run and a rung is
        lost, these slides say so on the next build.
      </p>
    </div>
  </div>
</Slide>

<style>
  .stack {
    display: grid;
    gap: 1rem;
    min-width: 0;
    align-content: start;
  }
</style>
