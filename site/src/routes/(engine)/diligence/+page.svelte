<script>
  // The deck is composed, not configured: each act contributes its slides in
  // DOM order and the engine numbers them. Adding a slide means adding markup
  // to an act, and there is no manifest to keep in sync.
  //
  // Twelve slides, four movements: the claim and the result (Frame), the
  // walkthrough that reproduces it (Reproduce), what turns a run into a
  // record and why the margin holds (Certify), and the evidence behind all of
  // it (Evidence).
  import '../../../styles/deck.css';
  import Deck from '$lib/components/deck/Deck.svelte';
  import Frame from '$lib/components/deck/acts/Frame.svelte';
  import Reproduce from '$lib/components/deck/acts/Reproduce.svelte';
  import Certify from '$lib/components/deck/acts/Certify.svelte';
  import Evidence from '$lib/components/deck/acts/Evidence.svelte';
  import { stamp } from '$lib/deck/content.js';
</script>

<svelte:head>
  <meta name="robots" content="noindex" />
  <meta
    name="description"
    content="Reproduction steps for the Metrale concurrency ladder: fingerprint, parity, commands, and the artifacts behind the vLLM comparison."
  />
</svelte:head>

<Deck title="Verification steps" {stamp}>
  <Frame />
  <Reproduce />
  <Certify />
  <Evidence />
</Deck>
