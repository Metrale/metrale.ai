<script>
  // The one unnumbered statement on the page. Everything else here is
  // evidence; this is the position the evidence is collected for, said once,
  // at size.
  import { mission } from '$lib/data.js';
</script>

<section id="mission" class="av av-section eg-mission">
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
