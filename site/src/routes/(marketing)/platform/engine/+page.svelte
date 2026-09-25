<script>
  import PlatformPage from '$lib/components/marketing/PlatformPage.svelte';
  import { enginePage } from '$lib/content/platform.js';
  import { routes } from '$lib/content/brand.js';
</script>

<PlatformPage path={routes.engine} page={enginePage} color="violet" />
