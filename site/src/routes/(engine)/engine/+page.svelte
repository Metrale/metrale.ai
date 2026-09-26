<script>
  // The engine page, in the front page's language. The marketing stylesheet is
  // imported HERE, not in the group layout, so /control and /diligence pay
  // nothing for it: it is scoped to `.av`, and each section of this page
  // carries that scope on its own root. The dashboard modal, the launch dialog
  // and the code chat stay on app.css. src/lib/route-groups.js still holds:
  // this is a developer route and never loads the marketing components
  // (e2e/page-weight.spec.js).
  import '../../../styles/metrale.css';
  import JumpBar from '$lib/components/engine/lead/JumpBar.svelte';
  import AnnouncementBanner from '$lib/components/AnnouncementBanner.svelte';
  import Hero from '$lib/components/Hero.svelte';
  import Proof from '$lib/components/Proof.svelte';
  import Verified from '$lib/components/Verified.svelte';
  import ModelSlider from '$lib/components/ModelSlider.svelte';
  import GetRunning from '$lib/components/GetRunning.svelte';
  import Community from '$lib/components/Community.svelte';
  import Contribute from '$lib/components/Contribute.svelte';
  import Mission from '$lib/components/Mission.svelte';
  import Faq from '$lib/components/Faq.svelte';
  import ReachOut from '$lib/components/ReachOut.svelte';
  import LaunchDialog from '$lib/components/LaunchDialog.svelte';
</script>

<svelte:head>
  <title>Metrale Engine, pure Rust inference for DGX Spark</title>
</svelte:head>

<JumpBar />
<AnnouncementBanner />
<Hero />
<Proof />
<Verified />
<ModelSlider />
<GetRunning />
<Community />
<Contribute />
<Mission />
<Faq />
<ReachOut />

<!-- Rendered at the page root on purpose: nested in a recipe card, any hover
     transform on an ancestor would become the containing block for the
     dialog's `position: fixed`. -->
<LaunchDialog />
