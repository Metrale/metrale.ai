<!--
  A post that decodes. Each beat pins one line of the essay under the header;
  as the reader scrolls, a scanline sweeps down it and the line decodes into
  the record under it, set in the engine's own type: a pull request or a
  signed gate record in Metrale Engine's public repository. The piece ends on
  the record itself, the thirteen results in one list, and where to take them.
  With reduced motion, or without script, each line and its record read in
  order.
-->
<script module>
  import { ENGINE_REPO } from '$shared/sources.mjs';
  import { MAIN_SITE, discordUrl } from '$lib/content.js';

  /** The certified commit the 2026-09-27 gate records name. */
  const CERT = 'aa5d059438';
  const pr = (n, title) => ({ label: `#${n}`, href: `${ENGINE_REPO}/pull/${n}`, name: `Pull request ${n}: ${title}` });
  const record = (gate) => ({
    label: gate,
    href: `${ENGINE_REPO}/blob/main/.benchmarks/${gate}/2026-09-27-${CERT}.json`,
    name: `The ${gate} gate record of 2026-09-27`
  });
  const readme = (id, label, name) => ({ label, href: `${ENGINE_REPO}#${id}`, name });

  const TTFT = pr(39, 'Prefill: MoE and dense 32k TTFT ahead of vLLM');

  /**
   * `line` is the essay as written; `record` is what the repository measured,
   * read from `cites`; `short` is the record in the closing list. `line` and
   * `record` are lists of runs, a run being text or `{ text, href }`, so a link
   * cannot drift from its words.
   */
  const beats = [
    {
      line: [
        'Where governance layers become differentiators in the field of observability, token problems become ',
        { text: 'infrastructure problems at scale', href: '/posts/from-desktop-to-hyperscaler' },
        '.'
      ],
      record: [
        "One DGX Spark, 128 streams at once: 459.31 tok/s against 358.57 for vLLM with its own speculative decoding, " +
          'and ahead at every concurrency from 1 to 128, on a signed, dated gate record.'
      ],
      short: 'Ahead of vLLM at every concurrency from 1 to 128 on one DGX Spark: 459.31 tok/s at 128.',
      cites: [pr(35, 'the README reads the 2026-09-27 certification'), record('concurrency-sweep')]
    },
    {
      line: [
        'Prefill, decode, mixture of experts, speculation, energy and Hopper fit in the first five days of ',
        { text: "the repository we're growing", href: '/posts/seven-tenets-powering-metrale-inference' },
        '.'
      ],
      record: [
        'Decode #1, #14, #18. Speculation #2. Mixture of experts #4, #34. Signed records #12. Hopper #25. ' +
          'Recipes #31. Prefill #39. Energy beside vLLM #45. Thirty-one pull requests merged between the 24th and the 28th.'
      ],
      short: "Thirty-one merged pull requests in the repository's first five days.",
      cites: [
        pr(1, 'energy-efficient small-batch decode on GB10'),
        pr(14, 'activation-reuse W4A4 GEMV'),
        pr(18, 'persistent activation-staged GEMV'),
        pr(2, 'weight-only NVFP4 MTP head'),
        pr(4, 'grouped FP8 MoE decode'),
        pr(34, 'MoE: canonical row tiers, grouped FP8 experts'),
        pr(12, 'bootstrap certified records'),
        pr(25, 'Hopper C1 measured wins'),
        pr(31, 'launch recipes live in recipes/'),
        TTFT,
        pr(45, 'vLLM energy leg for the MoE ladder')
      ],
      ledger: [{ label: 'merged', href: `${ENGINE_REPO}/pulls?q=is%3Apr+is%3Amerged`, name: 'Every merged pull request' }]
    },
    {
      line: [
        'There is a stark difference between generating what you need and balancing those needs across what you can now generate.'
      ],
      record: [
        "The 35B mixture of experts generates at 1.63 times vLLM's rate for one stream and holds a narrow lead at eight. " +
          'At sixteen, vLLM is 6% ahead, and the record says so.'
      ],
      short: 'The 35B MoE: 1.63× vLLM at one stream, a narrow lead at eight, 6% behind at sixteen.',
      cites: [readme('moe-vs-vllm', 'README', 'The MoE ladder against vLLM'), record('concurrency-sweep-moe')]
    },
    {
      line: [
        'The difference is a mode of operation. When it used to take you 10 hours to do a task you can leverage your stack ' +
          'into completing in four, you may ask, who do I pay?'
      ],
      record: [
        'The opening of Moby-Dick, 32,772 tokens, into the 27B dense model, cold: the first token took 45.0 seconds and ' +
          'now takes 17.3 to 18.0, where vLLM takes 24.1. Warm, 12.4 seconds became a quarter of one.'
      ],
      short: 'A 32k-token prompt, cold: the first token in 17.3 to 18.0 s, down from 45.0 (vLLM: 24.1).',
      cites: [TTFT]
    },
    {
      line: ['But what if that was a savings, not a cost?'],
      record: [
        'The same 32k prefill now costs about half the energy: 1,159 joules down to 600 on the mixture of experts, ' +
          'about 3.2 kilojoules down to 1.6 on the dense model.'
      ],
      short: 'Half the energy for the same 32k prefill: 1,159 J down to 600 on the MoE.',
      cites: [TTFT]
    },
    {
      line: [
        'Another difference is a talent of trade. When you used to bargain with an expert artist, and you can now leverage ' +
          'advanced image generation, are you really competing with artists?'
      ],
      record: [
        'The Hopper work came from a contributor, Tom Turney, rebased with every commit still his. On an H200, an exact ' +
          'greedy tie had turned 17+25 into 25. It returns 42 now, and 9 of 9 semantic prompts pass.'
      ],
      short: "A contributor's Hopper work, every commit still his: 17+25 is 42 again.",
      cites: [pr(25, 'Hopper C1 measured wins')]
    },
    {
      line: [
        'Being in the trenches, building, is not a function of who you are disrupting, even if that is your own inefficient workflow.'
      ],
      record: [
        'The small-batch W4A4 kernel re-read its whole activation matrix for every 16-row weight tile, about three times ' +
          'the weight bytes at 32 rows. Reused from registers, energy per token fell 9.1% at sixteen streams, and 0 of ' +
          '1,856 cases changed a bit.'
      ],
      short: 'Energy per token down 9.1% at sixteen streams; 0 of 1,856 kernel cases changed a bit.',
      cites: [pr(14, 'activation-reuse W4A4 GEMV, bit-identical')]
    },
    {
      line: [
        "Being in the trenches, building, is a function of frontier, even if you don't have all the skills and experiences."
      ],
      record: [
        'The kernel roadmap counts 15 model families served, 34 more that existing kernels could reach, starting with the ' +
          'dense loader for Llama 3.x, and 11 that need a kernel family the engine does not have yet.'
      ],
      short: '15 model families served, 34 within reach, 11 that need a new kernel family.',
      cites: [pr(46, 'KERNEL_ARCH_ROADMAP.md')]
    },
    {
      line: [
        'Experts are not being replaced, tasks are not being automated. Instead, the system outside your problem, which ' +
          'typically was outside of your control, is now directly addressable.'
      ],
      record: [
        'Mixture-of-experts decode now gives each active expert one block, which reads its weights once for every row ' +
          "routed to it. Sixteen streams went from 108 to 309 tok/s, and a row's bits no longer depend on how many rows " +
          'share the launch.'
      ],
      short: 'MoE decode at sixteen streams: 108 to 309 tok/s, with bits that do not depend on batch width.',
      cites: [pr(34, 'MoE: canonical row tiers, grouped FP8 experts')]
    },
    {
      line: [
        'The address, or answer to the problem, now incorporates more and more of what interfaces with the system outside your problem.'
      ],
      record: [
        'Ten agentic runs, each building a working Axum web server with tools: 10 of 10 working, 10 of 10 followed ' +
          'directions, 4.211 seconds a turn against a limit of 8.5.'
      ],
      short: '10 of 10 agentic runs built a working web server, at 4.211 s a turn.',
      cites: [record('agentic-webserver')]
    },
    {
      line: [
        'The result of addressing the system outside your problem, typically outside your control, is a decrease in ' +
          'unexpected events. When the expectation to a problem was an answer but the answer exceeded the problem by ' +
          'addressing the system outside it, even if you lacked the skills and experience to build the answer without ' +
          'your leverage stack, your predictive capacity has increased.'
      ],
      record: [
        'The same sample gets the same answer whatever ran before it: 257 samples byte-identical across two request ' +
          'orders, and 12 of 12 replayed conversations byte-identical to the reference.'
      ],
      short: '257 samples identical in any request order; 12 of 12 replays identical.',
      cites: [record('kat-equality-gate'), record('ssm-state-poisoning-gate')]
    },
    {
      line: [
        'An increase in predictive capacity, if it only reduced unexpected events, would be an infrastructure platform to ' +
          'determine your course.'
      ],
      record: [
        "A merge needs a passing, signed record for each of 17 gates. The four newest time the first token against vLLM's " +
          'own time on the same box, so a pass means at least as fast.'
      ],
      short: "17 signed gates per merge; the four newest are set at vLLM's own time to first token.",
      cites: [TTFT, pr(30, 'stamp and seal status, auto-enqueue')]
    },
    {
      line: [
        'If a reduction in unexpected events was only the first result of an increase in predictive capacity, then the ' +
          "future, the frontier, was really more yours than it was the author's."
      ],
      record: [
        'MIT or Apache-2.0, at your option. The engine, its kernels, its recipes and its dated, signed records are yours ' +
          'to run, check and change.'
      ],
      short: 'MIT or Apache-2.0: yours to run, check and change.',
      cites: [readme('licence', 'licence', 'The Metrale Engine licence')]
    }
  ];

  const text = (runs) => runs.map((r) => (typeof r === 'string' ? r : r.text)).join('');
  const pad = (n) => String(n).padStart(2, '0');
  // Counted the way postmd.js counts a markdown post: words, at 220 a minute.
  const words = beats
    .flatMap((b) => [text(b.line), text(b.record)])
    .join(' ')
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w)).length;

  export const meta = {
    format: 'svelte',
    title: 'Wholistic services dealing locally',
    dek: 'How can that be?',
    description:
      "Thirteen lines on leverage that decode, as you scroll, into Metrale Engine's own record: ahead of vLLM at every " +
      "concurrency from 1 to 128 on one DGX Spark, a first token on 32k prompts faster than vLLM's, and every number " +
      'linked to its pull request or signed record.',
    date: '2026-09-28',
    tag: 'engineering',
    categories: ['engineering', 'design'],
    keywords: [
      'rust inference engine',
      'vllm alternative',
      'dgx spark',
      'gb10',
      'mixture of experts',
      'time to first token',
      'energy per token',
      'open source llm inference',
      'metrale engine'
    ],
    ogImage: '/images/og/leveraging-the-stack.png',
    author: 'alexi-derkatsch',
    readingMinutes: Math.max(1, Math.round(words / 220)),
    hasMath: false,
    draft: false
  };
</script>

<script>
  import H2 from '$lib/components/H2.svelte';
  import { beats as turn } from '$lib/scroll.js';
</script>

<div class="beats" use:turn>
  {#each beats as beat, i (i)}
    <div class="beat" data-beat data-face="line">
      <div class="stage">
        <p class="kicker" aria-hidden="true">
          <span>{pad(i + 1)} / {pad(beats.length)}</span><span class="state"><span class="s-line">essay</span><span class="s-record">record</span></span>
        </p>
        <div class="faces">
          <p class="face line">{#each beat.line as run}{#if typeof run === 'string'}{run}{:else}<a href={run.href}>{run.text}</a>{/if}{/each}</p>
          <p class="face record">{#each beat.record as run}{#if typeof run === 'string'}{run}{:else}<a href={run.href}>{run.text}</a>{/if}{/each}<span class="cites">{#each beat.cites as c}<a class="cite" href={c.href} aria-label={c.name}>{c.label}</a>{/each}</span></p>
          <span class="scan" aria-hidden="true"></span>
        </div>
      </div>
    </div>
  {/each}
</div>

<section class="ledger" aria-labelledby="the-record">
  <H2 id="the-record" index={0}>The record</H2>
  <p class="lede">
    Every line above decoded into one of these. Each links to the pull request or the signed gate record it came from,
    in Metrale Engine's public repository.
  </p>
  <ol>
    {#each beats as beat, i (i)}
      <li>
        <span class="n" aria-hidden="true">{pad(i + 1)}</span>
        <span class="t">{beat.short}<span class="cites">{#each beat.ledger ?? beat.cites as c}<a class="cite" href={c.href} aria-label={c.name}>{c.label}</a>{/each}</span></span>
      </li>
    {/each}
  </ol>
  <div class="cta">
    <a class="btn primary" href={ENGINE_REPO}>Star Metrale Engine on GitHub</a>
    <a class="btn" href="{MAIN_SITE}/engine#run">Run it on your DGX Spark</a>
    <a class="btn" href={discordUrl}>Join the Discord</a>
  </div>
</section>

<style>
  .beats { margin-top: 8px; }

  /* A beat is taller than the screen so its stage can stay pinned while the
     reader scrolls. The essay line and its record share one grid cell; a
     scanline at `--m` of the cell's height divides them, the record above it
     and what is left of the essay below. */
  .beat { position: relative; min-height: 165vh; }
  .stage { position: sticky; top: calc(var(--header-h) + 16vh); }
  .kicker {
    display: flex; gap: 12px; margin: 0 0 14px;
    font-family: var(--mono); font-size: 11.5px; letter-spacing: .1em; text-transform: uppercase;
    color: var(--text-3);
  }
  .state { display: inline-grid; }
  .state > span { grid-area: 1 / 1; }
  /* One word hands over to the other at the midpoint; a crossfade would overprint them. */
  .s-line { opacity: clamp(0, 1 - var(--m, 0) * 2, 1); }
  .s-record { opacity: clamp(0, var(--m, 0) * 2 - 1, 1); color: var(--ch-cyan-text); }

  .faces { position: relative; display: grid; }
  .face { grid-area: 1 / 1; margin: 0; }
  .line {
    font-size: 22px; line-height: 1.55; letter-spacing: -.012em; color: var(--text-1);
    clip-path: inset(calc(var(--m, 0) * 100%) -24px -12px -24px);
    opacity: calc(1 - var(--m, 0) * .35);
  }
  .record {
    font-family: var(--mono); font-size: 16.5px; line-height: 1.75; color: var(--text-2);
    clip-path: inset(-12px -24px calc((1 - var(--m, 0)) * 100%) -24px);
  }
  /* Only the face in front takes a click. The record sits on top in the cell,
     so it is the one that has to let clicks through. */
  .record { pointer-events: none; }
  .beat[data-face='record'] .record { pointer-events: auto; }
  .beat[data-face='record'] .line { pointer-events: none; }

  /* The scanline, lit only while it moves, with a few rows of phosphor above
     it: the part of the record that has just been decoded. */
  .scan {
    position: absolute; left: -16px; right: -16px; top: calc(var(--m, 0) * 100%); height: 1px;
    background: var(--ch-cyan);
    box-shadow: 0 0 14px 2px color-mix(in srgb, var(--ch-cyan) 55%, transparent);
    opacity: clamp(0, min(var(--m, 0) * 14, (1 - var(--m, 0)) * 14), 1);
    pointer-events: none;
  }
  .scan::before {
    content: ''; position: absolute; left: 0; right: 0; bottom: 1px; height: 30px;
    background: repeating-linear-gradient(
      to bottom,
      color-mix(in srgb, var(--ch-cyan) 10%, transparent) 0 1px,
      transparent 1px 3px
    );
    -webkit-mask-image: linear-gradient(to top, #000, transparent);
    mask-image: linear-gradient(to top, #000, transparent);
  }

  /* A keyboard reader tabbing onto a link sees the face it lives on. */
  .beat:has(.record a:focus-visible) { --m: 1 !important; }
  .beat:has(.line a:focus-visible) { --m: 0 !important; }

  .cites { display: inline; }
  .cite {
    display: inline-block; margin-left: .6em;
    font-family: var(--mono); font-size: 12.5px; letter-spacing: .02em;
    color: var(--ch-cyan-text); text-decoration: none;
    border-bottom: 1px solid color-mix(in srgb, var(--ch-cyan-text) 45%, transparent);
  }
  .cite:hover { color: var(--text-1); border-bottom-color: var(--text-1); }

  /* The record, all of it, as a list a crawler and a skimmer can both read. */
  .ledger { margin-top: 24px; }
  .lede { color: var(--text-2); }
  .ledger ol { list-style: none; padding: 0; margin: 0 0 36px; border-top: 1px solid var(--line-soft); }
  .ledger li {
    display: grid; grid-template-columns: 2.4em 1fr; gap: 10px; margin: 0; padding: 12px 0;
    border-bottom: 1px solid var(--line-soft);
    font-family: var(--mono); font-size: 14px; line-height: 1.6; color: var(--text-2);
  }
  .ledger .n { color: var(--ch-cyan-text); }
  .ledger .cite { margin-left: .5em; font-size: 12px; }

  .cta { display: flex; flex-wrap: wrap; gap: 12px; margin: 0 0 12px; }
  .btn {
    display: inline-flex; align-items: center; min-height: 44px; padding: 0 18px; border-radius: 10px;
    font-family: var(--sans); font-size: 15px; font-weight: 560; text-decoration: none;
    color: var(--text-1); border: 1px solid var(--line-hard); background: var(--bg-1);
    transition: border-color var(--dur) var(--ease);
  }
  .btn:hover { border-color: var(--accent); }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: var(--bg-0); }
  .btn.primary:hover { filter: brightness(1.08); }

  @media (max-width: 720px) {
    .beat { min-height: 155vh; }
    .stage { top: calc(var(--header-h) + 10vh); }
    .line { font-size: 19px; line-height: 1.5; }
    .record { font-size: 14.5px; line-height: 1.7; }
    .ledger li { font-size: 13px; }
  }

  /* Reduced motion, or no script to drive the turn: the beats stack and both
     faces read in order, the record set under its line. */
  @media (prefers-reduced-motion: reduce), (scripting: none) {
    .beat { min-height: 0; margin: 0 0 34px; }
    .stage { position: static; }
    .kicker { display: none; }
    .faces { display: block; min-height: 0; }
    .face { clip-path: none !important; opacity: 1 !important; pointer-events: auto !important; }
    .line { margin-bottom: 12px; }
    .record { padding-left: 16px; border-left: 2px solid var(--line); }
    .scan { display: none; }
  }
</style>
