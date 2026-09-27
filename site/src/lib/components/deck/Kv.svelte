<script>
  // Fingerprint rows. `rows` is [label, value, note?] — the note carries the
  // reason a value is what it is, which is the part an analyst is actually
  // auditing.
  //
  // `mark` draws a parity glyph in front of every row: each axis is pinned
  // identically on both engines and the value column says to what.
  let { rows = [], mark = false, cols = 1 } = $props();
</script>

<dl class="kv" class:kv-two={cols === 2}>
  {#each rows as [label, value, note]}
    <div class="kv-row">
      {#if mark}<span class="kv-mark mono" aria-hidden="true">=</span>{/if}
      <dt class="mono">{label}</dt>
      <dd>
        <span class="kv-val mono">{value}</span>
        {#if note}<span class="kv-note">{note}</span>{/if}
      </dd>
    </div>
  {/each}
</dl>

<style>
  .kv {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0 2rem;
    align-content: start;
    min-width: 0;
  }
  @media (min-width: 900px) {
    .kv-two {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }
  .kv-row {
    display: grid;
    grid-template-columns: 12ch minmax(0, 1fr);
    gap: 0.25rem 0.9rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border);
    align-items: baseline;
    min-width: 0;
  }
  .kv-row:has(.kv-mark) {
    grid-template-columns: 1.1em 12ch minmax(0, 1fr);
  }
  @media (max-width: 480px) {
    .kv-row {
      grid-template-columns: minmax(0, 1fr);
    }
    .kv-row:has(.kv-mark) {
      grid-template-columns: 1.1em minmax(0, 1fr);
    }
    .kv-row:has(.kv-mark) dd {
      grid-column: 2;
    }
  }
  .kv-mark {
    color: var(--sx-text);
    font-weight: 700;
  }
  dt {
    overflow-wrap: anywhere;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--t3);
    text-transform: uppercase;
  }
  dd {
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.15rem 0.7rem;
    align-items: baseline;
  }
  .kv-val {
    color: var(--t1);
    font-size: 0.86rem;
    overflow-wrap: anywhere;
  }
  .kv-note {
    color: var(--t3);
    font-size: 0.8rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
</style>
