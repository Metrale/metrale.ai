<script>
  // The developer routes: /engine, /control, /diligence. The ledger design
  // system in app.css and its companions.
  // Load order matters. app.css is the desktop-first design system,
  // dashboard.css adds the dashboard modal, ladder.css styles the
  // concurrency section (it reuses dashboard's chart primitives, so it loads
  // after those), mobile.css is the SSOT for every viewport rule and lands last.
  // The codebase chat brings its own stylesheet when it is first wanted.
  import '../../app.css';
  import '../../styles/dashboard.css';
  import '../../styles/ladder.css';
  import '../../styles/control.css';
  import '../../styles/bridge.css';
  import '../../styles/stage.css';
  import '../../styles/overlays.css';
  import '../../styles/mobile.css';
  import '../../styles/engine-shell.css';
  import { page } from '$app/state';
  import SiteNav from '$lib/components/marketing/SiteNav.svelte';
  import SiteFooter from '$lib/components/marketing/SiteFooter.svelte';
  import AskRepoButton from '$lib/components/engine/lead/AskRepoButton.svelte';
  import { routes } from '$lib/content/brand.js';
  import { codeChat } from '$lib/data.js';
  let { children } = $props();

  // The codebase chat is offered on the engine page only, top right in the bar.
  const askRepo = $derived(codeChat.enabled && page.url.pathname.replace(/\.html$/, '').replace(/\/$/, '') === routes.openSource);
</script>

{#snippet askRepoAction()}<AskRepoButton />{/snippet}

<!-- The page's own layer: the nav, the route and the footer. -->
<div class="page engine-shell">
  <SiteNav actions={askRepo ? askRepoAction : undefined} />
  {@render children()}
  <SiteFooter />
</div>
