<script>
  // The developer routes: /engine, /control, /diligence. The ledger design
  // system in app.css and its companions.
  // Load order matters. app.css is the desktop-first design system,
  // dashboard.css then chat.css add the two modals (chat
  // reuses dashboard pieces so it loads after), ladder.css styles the
  // concurrency section (it reuses dashboard's chart primitives, so it loads
  // after those), mobile.css is the SSOT for every viewport rule and lands last.
  import '../../app.css';
  import '../../styles/dashboard.css';
  import '../../styles/chat.css';
  import '../../styles/ladder.css';
  import '../../styles/control.css';
  import '../../styles/bridge.css';
  import '../../styles/stage.css';
  import '../../styles/overlays.css';
  import '../../styles/mobile.css';
  import '../../styles/engine-shell.css';
  import SiteNav from '$lib/components/marketing/SiteNav.svelte';
  import SiteFooter from '$lib/components/marketing/SiteFooter.svelte';
  let { children } = $props();
</script>

<!-- The page's own layer: the nav, the route and the footer. -->
<div class="page engine-shell">
  <SiteNav />
  {@render children()}
  <SiteFooter />
</div>
