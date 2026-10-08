<!--
  The Metrale logo and mark, drawn from the brand kit's own files.

  ../brand-art.js is written by site/scripts/brand/kit.mjs from the kit's SVGs
  (assets/brand/svg, metrale-assets pinned in assets/brand.pin), and
  src/lib/brand-kit.test.js fails when it is behind them. Nothing here is
  redrawn or recoloured: every piece carries the kit's own ink.

  Kinds:
    defs     the definitions, rendered once per document by the root layout
    logo     mark, rule, METRALE. Minimum 160 px wide. The kit draws two cuts,
             one per ground, and they are never swapped: with ground="theme"
             (the default) both are referenced and the page's theme shows the
             one for its ground; ground="dark" or "light" pins a cut for a
             surface whose ground does not follow the theme
    mark     the folded copper M. At 48 px and below the kit's compact cut is
             drawn instead, its fold gap widened so it survives small sizes

  Sizing is by width, because the kit's minimums are widths. Clear space is
  one stem (53 units) on every side, as CSS margin in proportion to the width
  rather than viewBox padding, which would shrink the artwork below the minimum.

  The file keeps its name so the imports across two apps did not move with the
  artwork.
-->
<script>
  import { ART } from '../brand-art.js';

  let { kind = 'logo', width = null, ground = 'theme', label = 'Metrale', class: klass = '' } = $props();
  const DEFAULT_WIDTH = { logo: ART.minWidth.logo, mark: 32 };
  const w = $derived(width ?? DEFAULT_WIDTH[kind]);
  const art = $derived(kind === 'logo' ? ART.logo.dark : w <= ART.compactMaxWidth ? ART.compact : ART.mark);
  const ref = $derived(kind === 'logo' ? null : w <= ART.compactMaxWidth ? 'm-compact' : 'm-mark');
  const viewBox = $derived(art.viewBox.join(' '));
  const style = $derived(`width:${w}px;margin:${((w * ART.clear) / art.viewBox[2]).toFixed(2)}px`);
</script>

{#snippet draw(nodes)}
  {#each nodes as n, i (i)}
    {#if n.tag === 'g'}
      <g {...n.a}>{@render draw(n.children)}</g>
    {:else if n.tag === 'rect'}
      <rect {...n.a} />
    {:else}
      <path {...n.a} />
    {/if}
  {/each}
{/snippet}

{#if kind === 'defs'}
  <svg class="metrale-defs" width="0" height="0" aria-hidden="true" focusable="false">
    <defs>
      <g id="m-logo-ondark">{@render draw(ART.logo.dark.nodes)}</g>
      <g id="m-logo-onlight">{@render draw(ART.logo.light.nodes)}</g>
      <g id="m-mark">{@render draw(ART.mark.nodes)}</g>
      <g id="m-compact">{@render draw(ART.compact.nodes)}</g>
    </defs>
  </svg>
{:else}
  <svg class="logo logo-{kind} {klass}" {style} {viewBox} role="img" aria-label={label}>
    <title>{label}</title>
    {#if kind !== 'logo'}
      <use href="#{ref}" />
    {:else if ground === 'theme'}
      <use class="cut-ondark" href="#m-logo-ondark" />
      <use class="cut-onlight" href="#m-logo-onlight" />
    {:else}
      <use href={ground === 'light' ? '#m-logo-onlight' : '#m-logo-ondark'} />
    {/if}
  </svg>
{/if}

<style>
  .metrale-defs {
    position: absolute;
  }
  .logo {
    display: block;
    height: auto;
  }
  /* The theme picks the cut: the dark-ground cut unless the page is light. */
  .cut-onlight,
  :global([data-theme='light']) .cut-ondark {
    display: none;
  }
  :global([data-theme='light']) .cut-onlight {
    display: inline;
  }
</style>
