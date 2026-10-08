<!--
  The guide's glyph is the brand mark itself, in the kit's compact cut: it is
  drawn at 16 to 26 px, and the kit draws the compact cut for 48 px and below.
  It uses the definitions the root layout renders once per document
  (MetraleLockup kind="defs"), so it costs no artwork of its own. The guide is
  named in type beside it; the kit draws no mark of its own for it.
-->
<script>
  import { ART } from '../../../../web-shared/brand-art.js';

  let { size = 24, class: klass = '' } = $props();
  const [x, y, w, h] = ART.compact.viewBox;
  const height = $derived(Math.round((size * h) / w));
</script>

<svg class={klass} width={size} {height} viewBox={`${x} ${y} ${w} ${h}`} aria-hidden="true" focusable="false">
  <use href="#m-compact" />
</svg>
