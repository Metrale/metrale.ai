<!--
  The guide's glyph is the brand mark itself: the M with the gold swash lifted
  over its right shoulder, which reads as M′. It draws from the definitions the
  root layout renders once per document (AtlasLockup kind="defs"), so it costs
  no artwork of its own and follows the kit and the theme.
-->
<script>
  import { ART } from '../../../../web-shared/brand-art.js';

  let { size = 24, class: klass = '' } = $props();
  const b = ART.boxes.mark;
  const h = $derived(Math.round((size * b.height) / b.width));
</script>

<svg class={klass} width={size} height={h} viewBox={`${b.x0} ${b.y0} ${b.width} ${b.height}`} aria-hidden="true" focusable="false">
  <use href="#m-mark" />
</svg>
