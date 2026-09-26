<!--
  A post in beats. Each beat pins one line of the essay under the header and,
  as the reader scrolls, turns it into the measurement under it, with the
  records the number is read from. Svelte rather than markdown because the
  scroll is the form. With reduced motion, or without JavaScript, both lines of
  every beat read in order, one after the other.
-->
<script module>
  import { HISTORY } from '$shared/sources.mjs';
  import { MAIN_SITE } from '$lib/content.js';

  /** A record in the history the engine builds on, by number. */
  const pull = (n) => ({ n, path: `pull/${n}`, label: `Pull request ${n}` });
  const issue = (n) => ({ n, path: `issues/${n}`, label: `Issue ${n}` });

  /**
   * `line` is the essay as written; `under` is what the week measured, and
   * `cites` the records each figure is read from. Both are lists of runs, a
   * run being text or `{ text, href }`, so a link cannot drift from its words.
   */
  const beats = [
    {
      line: [
        'Where governance layers become differentiators in the field of observability, token problems become ',
        { text: 'infrastructure problems at scale', href: '/posts/from-desktop-to-hyperscaler' },
        '.'
      ],
      under: [
        'Workloads in agentic sessions dropped from 10.30 seconds per turn to 5.56 inside the week, on two GB10s. ' +
          'That is the capability this implies for customers who run one desk.'
      ],
      cites: [pull(1063)]
    },
    {
      line: [
        'Prefill, decode, two-box parallelism, cache, ',
        { text: 'speculation', href: '/posts/dflash2-single-spark-record' },
        ', DeepSeek on one Spark fit in the first half of a week at ',
        { text: "the repository we're growing", href: '/posts/seven-tenets-powering-metrale-inference' },
        '.'
      ],
      under: [
        'Qwen3.8-Flash-Next on two GB10s is #1063. Lookup drafts #1026. K-row decode #1060. The two-box gate #1066. ' +
          'DeepSeek V4.1 Flash, first generate on one Spark, #1099, scoped by #1059. The tracking idea #974. EXL3 under it, #834.'
      ],
      cites: [pull(1063), pull(1026), pull(1060), pull(1066), pull(1099), issue(1059), issue(974), pull(834)]
    },
    {
      line: [
        'There is a stark difference between generating what you need and balancing those needs across what you can now generate.'
      ],
      under: [
        'A 475 GiB DeepSeek on a Q2_K, generating on one 128 GiB Spark by streaming 2.86 GiB of experts per token. ' +
          'Two GB10s balancing one model, +9.1% on single-stream decode.'
      ],
      cites: [pull(1099), pull(1063)]
    },
    {
      line: [
        'The difference is a mode of operation. When it used to take you 10 hours to do a task you can leverage your stack ' +
          'into completing in four, you may ask, who do I pay?'
      ],
      under: [
        'Video passed 14 of 14, the Marconi disagreement resolved, and wide lookups at width seven sat next to width three ' +
          'on seconds per turn once fresh text stopped paying for them. The copy task is where agentic seconds are not the ' +
          'clock: 55.28 to 74.65 tok/s.'
      ],
      cites: [pull(1063), pull(1026), pull(1060)]
    },
    {
      line: ['But what if that was a savings, not a cost?'],
      under: [
        'Prefill held from 8K to 32K, 1953 and 1920 tok/s, and time to first token on 100K came down to 75.7 s from 102.2 s.'
      ],
      cites: [pull(1063)]
    },
    {
      line: [
        'Another difference is a talent of trade. When you used to bargain with an expert artist, and you can now leverage ' +
          'advanced image generation, are you really competing with artists?'
      ],
      under: [
        'Concurrent threads this week ran C=1 to C=4, not ',
        { text: 'the published C=128 ladder', href: `${MAIN_SITE}/benchmarks` },
        '. Agentic turns, from tool calls to loops to waits and reads, turn around at a faster and faster rate.'
      ],
      cites: [pull(1063)]
    },
    {
      line: [
        'Being in the trenches, building, is not a function of who you are disrupting, even if that is your own inefficient workflow.'
      ],
      under: [
        'History lookups, from retypes to tool quotes, propose the tokens already in history. The real model still verifies, ' +
          'so the output does not move: nine of nine runs byte-identical to the same binary with lookups off.'
      ],
      cites: [pull(1026), pull(1060)]
    },
    {
      line: [
        "Being in the trenches, building, is a function of frontier, even if you don't have all the skills and experiences."
      ],
      under: [
        'Controls on fresh text kept seconds per turn at width seven next to width three, 7.31 against 7.00. ' +
          'Once the guess was right, the verifier payment went wide only on lookup hits.'
      ],
      cites: [pull(1060)]
    },
    {
      line: [
        'Experts are not being replaced, tasks are not being automated. Instead, the system outside your problem, which ' +
          'typically was outside of your control, is now directly addressable.'
      ],
      under: [
        'The file already in context, the tool result already quoted, the prefix already cached. ' +
          'Marconi restores matched on both ranks, 35 and 35, with zero anchor disagreements.'
      ],
      cites: [pull(1026), pull(1066)]
    },
    {
      line: [
        'The address, or answer to the problem, now incorporates more and more of what interfaces with the system outside your problem.'
      ],
      under: ['TP=2 × EP=2, vision across ranks, KV 639K to 1.55M tokens (2.4x), still one serve.'],
      cites: [pull(1063), pull(1066)]
    },
    {
      line: [
        'The result of addressing the system outside your problem, typically outside your control, is a decrease in ' +
          'unexpected events. When the expectation to a problem was an answer but the answer exceeded the problem by ' +
          'addressing the system outside it, even if you lacked the skills and experience to build the answer without ' +
          'your leverage stack, your predictive capacity has increased.'
      ],
      under: [
        'Vision concurrency read 0/3, then 2/3, and 3/3 only with all three fixes in; the model had read HARBOR as Superman ' +
          'while every shape check passed. Speed as an outcome of the correct process: fixing one row defect took C=4 ' +
          'from 28.2 to 50.2 tok/s.'
      ],
      cites: [pull(1066), pull(1063)]
    },
    {
      line: [
        'An increase in predictive capacity, if it only reduced unexpected events, would be an infrastructure platform to ' +
          'determine your course.'
      ],
      under: [
        'A serve preset and a gate anyone can run, for a model that had none: vision, video and agentic-webserver, three runs. ' +
          'The agentic gate already produced its 3 of 3, 0 errors.'
      ],
      cites: [pull(1066), pull(1063)]
    },
    {
      line: [
        'If a reduction in unexpected events was only the first result of an increase in predictive capacity, then the ' +
          "future, the frontier, was really more yours than it was the author's."
      ],
      under: [
        'DeepSeek V4.1 Flash on one Spark: a per-layer checksum trace found a race in the expert path. After the fix, four ' +
          'greedy runs bit-identical, 97 of 100 tokens matching teacher-forced prefill, 10.6 to 10.9 tok/s warm, on a box ' +
          'we already own.'
      ],
      cites: [pull(1099), issue(1059)]
    }
  ];

  const text = (runs) => runs.map((r) => (typeof r === 'string' ? r : r.text)).join('');
  // Counted the way postmd.js counts a markdown post: words, at 220 a minute.
  const words = beats
    .flatMap((b) => [text(b.line), text(b.under)])
    .join(' ')
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w)).length;

  export const meta = {
    format: 'svelte',
    title: 'Wholistic services dealing locally',
    dek: 'How can that be?',
    description:
      'Thirteen lines on leverage, each turning as you scroll into the Metrale Engine work under it: agentic turns ' +
      'from 10.30 to 5.56 seconds on two GB10s, and a 475 GiB DeepSeek generating on one Spark.',
    date: '2026-09-18',
    tag: 'engineering',
    categories: ['engineering', 'design'],
    keywords: [
      'leverage stack',
      'agentic inference',
      'lookup decoding',
      'speculative decoding',
      'prefix caching',
      'expert parallelism',
      'dgx spark',
      'gb10',
      'deepseek v4.1 flash',
      'metrale inference'
    ],
    ogImage: '',
    author: 'alexi-derkatsch',
    readingMinutes: Math.max(1, Math.round(words / 220)),
    hasMath: false,
    draft: false
  };
</script>

<script>
  import { onMount } from 'svelte';

  let root = $state(null);

  onMount(() => {
    const els = [...root.querySelectorAll('.beat')];
    const clamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
    // The turn happens between 28% and 50% of a beat's travel, eased at both
    // ends, so a line holds still before it gives way and after it arrives.
    const ease = (t) => {
      const u = clamp((t - 0.28) / 0.22);
      return u * u * (3 - 2 * u);
    };
    let frame = 0;

    const paint = () => {
      frame = 0;
      const vh = window.innerHeight || 1;
      const pin = vh * 0.16;
      // Every read before any write: a write between two reads forces a
      // layout per beat.
      const turn = els.map((el) => {
        const travel = Math.max(1, el.offsetHeight - vh * 0.42);
        return ease((pin - el.getBoundingClientRect().top) / travel);
      });
      els.forEach((el, i) => {
        el.style.setProperty('--m', turn[i].toFixed(3));
        el.dataset.face = turn[i] < 0.5 ? 'line' : 'under';
      });
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };

    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue, { passive: true });
    paint();
    return () => {
      removeEventListener('scroll', queue);
      removeEventListener('resize', queue);
      cancelAnimationFrame(frame);
    };
  });
</script>

<div class="beats" bind:this={root}>
  {#each beats as beat, i (i)}
    <div class="beat" data-face="line">
      <div class="stage">
        <p class="face line">{#each beat.line as run}{#if typeof run === 'string'}{run}{:else}<a href={run.href}>{run.text}</a>{/if}{/each}</p>
        <p class="face under">{#each beat.under as run}{#if typeof run === 'string'}{run}{:else}<a href={run.href}>{run.text}</a>{/if}{/each}<span class="cites">{#each beat.cites as c}<a class="cite" href="{HISTORY}/{c.path}" aria-label={c.label}>#{c.n}</a>{/each}</span></p>
      </div>
    </div>
  {/each}
</div>

<style>
  .beats { margin-top: 8px; }

  /* A beat is taller than the screen so its stage can stay pinned while the
     reader scrolls; the two faces share one grid cell and trade places. */
  .beat { position: relative; min-height: 165vh; }
  .stage {
    position: sticky; top: calc(var(--header-h) + 18vh);
    min-height: 9.5rem; display: grid; align-items: start;
  }
  .face { grid-area: 1 / 1; margin: 0; font-size: 22px; line-height: 1.55; letter-spacing: -.012em; }
  .line {
    color: var(--text-1);
    opacity: calc(1 - var(--m, 0));
    transform: translateY(calc(var(--m, 0) * -8px));
  }
  .under {
    color: var(--text-2);
    opacity: var(--m, 0);
    transform: translateY(calc((1 - var(--m, 0)) * 10px));
    pointer-events: none;
  }
  /* Only the face in front takes a click. The later face sits on top in the
     cell, so it is the one that has to let clicks through. */
  .beat[data-face='under'] .under { pointer-events: auto; }
  .beat[data-face='under'] .line { pointer-events: none; }

  /* A keyboard reader tabbing onto a link sees the face it lives on. */
  .beat:has(.under a:focus-visible) { --m: 1 !important; }
  .beat:has(.line a:focus-visible) { --m: 0 !important; }

  .cites { display: inline; }
  .cite {
    display: inline-block; margin-left: .55em;
    font-family: var(--mono); font-size: 12.5px; letter-spacing: .04em;
    color: var(--ch-cyan-text); text-decoration: none;
    border-bottom: 1px solid color-mix(in srgb, var(--ch-cyan-text) 45%, transparent);
  }
  .cite:hover { color: var(--text-1); border-bottom-color: var(--text-1); }

  @media (max-width: 720px) {
    .beat { min-height: 155vh; }
    .stage { top: calc(var(--header-h) + 12vh); min-height: 11rem; }
    .face { font-size: 19px; line-height: 1.5; }
  }

  /* Reduced motion, or no script to drive the turn: the beats stack and both
     faces read in order, the measurement set under its line. */
  @media (prefers-reduced-motion: reduce), (scripting: none) {
    .beat { min-height: 0; margin: 0 0 34px; }
    .stage { position: static; min-height: 0; display: block; }
    .face { opacity: 1 !important; transform: none !important; pointer-events: auto !important; }
    .line { margin-bottom: 12px; }
    .under { padding-left: 16px; border-left: 2px solid var(--line); font-size: 17px; }
  }
</style>
