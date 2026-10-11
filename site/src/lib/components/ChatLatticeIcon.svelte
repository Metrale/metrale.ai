<script>
  // Hand-drawn neural lattice glyph (2-3-2 layers, fully connected): the
  // "Ask the codebase" button on /engine. House icon convention (see
  // GithubIcon.svelte).
  let { size = 20 } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
  <path
    d="M4.5 7.5 12 4M4.5 7.5 12 12M4.5 7.5 12 20M4.5 16.5 12 4M4.5 16.5 12 12M4.5 16.5 12 20M12 4 19.5 7.5M12 12 19.5 7.5M12 20 19.5 7.5M12 4 19.5 16.5M12 12 19.5 16.5M12 20 19.5 16.5"
    stroke="currentColor"
    stroke-width="1.2"
    stroke-linecap="round"
    opacity="0.6"
  />
  <g fill="currentColor">
    <circle cx="4.5" cy="7.5" r="2" />
    <circle cx="4.5" cy="16.5" r="2" />
    <circle cx="12" cy="4" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="20" r="2" />
    <circle cx="19.5" cy="7.5" r="2" />
    <circle cx="19.5" cy="16.5" r="2" />
  </g>
</svg>
