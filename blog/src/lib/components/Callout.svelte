<!-- An aside that must not be skimmed past. `tone` picks what the aside is:
     notice is a warning (amber), verified a checked result (green), technical
     and engine are copper, the brand's accent. Amber and green are the UI's
     status colours and are used for nothing else. -->
<script>
  const TONES = {
    notice: 'var(--amber)',
    verified: 'var(--green)',
    technical: 'var(--sx)',
    engine: 'var(--sx)'
  };
  // The label and the icon are small text: copper reads from its text token,
  // the status colours are text-safe as they are.
  const TONES_TEXT = {
    notice: 'var(--amber)',
    verified: 'var(--green)',
    technical: 'var(--accent)',
    engine: 'var(--accent)'
  };
  let { label, tone = 'notice', children } = $props();
  const color = $derived(TONES[tone] ?? TONES.notice);
  const textColor = $derived(TONES_TEXT[tone] ?? TONES_TEXT.notice);
</script>

<aside class="callout" style="--co: {color}; --co-text: {textColor}">
  <svg class="ci" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
    <path d="M12 9v4" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="9" />
  </svg>
  <p><span class="ct">{label}</span>{@render children()}</p>
</aside>
