<script>
  import MetraleLockup from '$shared/components/MetraleLockup.svelte';
  // Desktop bar + mobile drawer render from the SAME `nav.links` in data.js.
  // Below the drawer breakpoint (styles/mobile.css) the bar hides and the
  // toggle appears, so phones keep every link the desktop has.
  import { nav, githubUrl } from '$lib/data.js';
  import GithubIcon from './GithubIcon.svelte';
  import FleetPill from './FleetPill.svelte';
  import ThemeToggle from '$shared/components/ThemeToggle.svelte';

  let open = $state(false);

  // No body scroll lock on purpose. Measured on this page, body.overflow hidden
  // is a no-op because scrolling lives on the viewport and body already carries
  // overflow-x clip, so the page keeps scrolling anyway. The drawer is a short
  // panel pinned under the bar rather than a full screen sheet, so there is
  // nothing to lock. The scrim absorbs stray taps and closes the menu.
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') open = false;
  }}
/>

<nav>
  <div class="nav-inner">
    <a class="nav-logo" href="/" aria-label="Metrale home" data-sveltekit-reload>
      <MetraleLockup width={160} />
    </a>
    <div class="nav-links">
      {#each nav.links as l}
        <a href={l.href}>{l.text}</a>
      {/each}
      <a class="nav-star-btn" href={githubUrl} target="_blank" rel="noopener">
        <GithubIcon size={15} /> Star
      </a>
      <ThemeToggle />
      <!-- Fleet status chip. Last on purpose: status reads as chrome, not as a
           destination, so it anchors the far right of the bar instead of
           sitting between the links and the icons. Renders nothing for
           visitors without a paired local agent (see FleetPill.svelte). -->
      <FleetPill />
    </div>

    <button
      type="button"
      class="nav-toggle"
      aria-expanded={open}
      aria-controls="nav-drawer"
      aria-label={open ? nav.closeLabel : nav.menuLabel}
      onclick={() => (open = !open)}
    >
      <span class="nav-burger" class:is-x={open} aria-hidden="true"><span></span><span></span><span></span></span>
    </button>
  </div>

  <div id="nav-drawer" class="nav-drawer" class:is-open={open}>
    {#each nav.links as l}
      <a class="nav-drawer-link" href={l.href} tabindex={open ? 0 : -1} onclick={() => (open = false)}>{l.text}</a>
    {/each}
    <div class="nav-drawer-foot">
      <ThemeToggle />
      <a class="nav-star-btn" href={githubUrl} target="_blank" rel="noopener" tabindex={open ? 0 : -1}>
        <GithubIcon size={15} /> Star
      </a>
    </div>
  </div>
</nav>

<button
  type="button"
  class="nav-scrim"
  class:is-on={open}
  aria-label={nav.closeLabel}
  tabindex={open ? 0 : -1}
  onclick={() => (open = false)}
></button>
