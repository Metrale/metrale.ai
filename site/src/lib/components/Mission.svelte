<script>
  // The one unnumbered statement on the page. Everything else here is
  // evidence; this is the position the evidence is collected for, said once,
  // at size, over the mark's chevrons.
  import { mission } from '$lib/data.js';
</script>

<section id="mission" class="av av-section av-sx-violet eg-mission">
  <svg class="eg-mission-mark" viewBox="0 0 956 636" width="956" height="636" aria-hidden="true">
    <g fill="none" stroke-width="76" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor">
      <path d="M38 38L358 318L38 598" />
      <path d="M318 38L638 318L318 598" />
      <path d="M598 38L918 318L598 598" />
    </g>
  </svg>
  <div class="av-container av-narrow av-center eg-mission-in">
    <p class="av-eyebrow" style="justify-content:center">{mission.title}</p>
    <h2 class="av-h2 eg-mission-statement">{mission.statement}</h2>
    <p class="av-lede">{mission.footnote}</p>
  </div>
</section>

<style>
  .eg-mission {
    overflow: clip;
    border-block: 1px solid var(--border);
    background: linear-gradient(180deg, var(--bg2), var(--bg));
  }
  .eg-mission-mark {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(620px, 78vw);
    height: auto;
    color: var(--sx-text);
    opacity: 0.05;
    pointer-events: none;
  }
  .eg-mission-in {
    position: relative;
  }
  .eg-mission-statement {
    max-width: 22ch;
    margin-inline: auto;
    font-size: clamp(2rem, 4.2vw, 3.2rem);
  }
  .eg-mission .av-lede {
    margin-top: 1.4rem;
  }
</style>
