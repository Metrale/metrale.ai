<script>
  // The one line above the hero, in the front page's pattern. Renders nothing
  // when the copy is empty, so a notice is taken down in data.js, not here.
  import { announcement } from '$lib/data.js';
</script>

{#if announcement.text}
  <div class="av av-announce">
    <div class="av-announce-in">
      <span class="av-chip av-chip-violet">{announcement.tag}</span>
      <span>{announcement.text}</span>
      <a href={announcement.href}>{announcement.cta} →</a>
    </div>
  </div>
{/if}
