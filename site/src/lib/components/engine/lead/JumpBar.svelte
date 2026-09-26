<script>
  // The jump bar under the global header: one link per section of /engine and
  // the two neighbouring pages, from `nav.links` in data.js, which the /control
  // bar and drawer render too. The site's sector bar pattern (/solutions).
  //
  // A div with the navigation role, not a <nav>: app.css pins every <nav> that
  // is not the global header to the top of the viewport for the /control bar.
  import { nav } from '$lib/data.js';
</script>

<div class="av av-sectorbar" role="navigation" aria-label="On this page">
  <div class="av-container av-sectorbar-in">
    {#each nav.links as l}
      <a
        class="av-sectorbar-link av-sx-{l.hue}"
        href={l.href}
        target={l.href.startsWith('http') ? '_blank' : undefined}
        rel={l.href.startsWith('http') ? 'noopener' : undefined}><i aria-hidden="true"></i>{l.text}</a
      >
    {/each}
  </div>
</div>
