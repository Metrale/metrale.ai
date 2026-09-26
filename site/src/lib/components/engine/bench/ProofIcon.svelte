<script>
  // One line glyph per kind of proof item, in currentColor. Decorative: the
  // text beside it carries the meaning.
  /** @type {{ kind: 'partner' | 'program' | 'licence' | 'records' }} */
  let { kind } = $props();
</script>

<svg
  class="eg-proof-icon"
  viewBox="0 0 16 16"
  width="16"
  height="16"
  aria-hidden="true"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  {#if kind === 'records'}
    <path d="M3 8.5l3.2 3.2L13 5" />
  {:else if kind === 'licence'}
    <path d="M8 1.6l5 1.9v4c0 3.1-2.1 5.4-5 6.6-2.9-1.2-5-3.5-5-6.6v-4l5-1.9z" />
    <path d="M5.8 8.2l1.5 1.5 3-3" />
  {:else if kind === 'program'}
    <circle cx="8" cy="8" r="5.4" />
    <path d="M8 4.8l1 2 2.2.3-1.6 1.5.4 2.2L8 9.7l-2 1.1.4-2.2-1.6-1.5 2.2-.3z" />
  {:else}
    <rect x="3" y="3" width="10" height="10" rx="2" />
    <path d="M6.5 1.5v1.5M9.5 1.5v1.5M6.5 13v1.5M9.5 13v1.5M1.5 6.5h1.5M1.5 9.5h1.5M13 6.5h1.5M13 9.5h1.5" />
  {/if}
</svg>
