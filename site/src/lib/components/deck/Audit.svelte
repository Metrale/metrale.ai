<script>
  // A self-audit table: each row is a known way to fake a benchmark, and what
  // this campaign did about it. `state` is 'clear' (addressed), 'open' (a real
  // limitation we are not claiming past) or 'note'.
  //
  // The point of rendering the open rows in the same table as the clear ones is
  // that a checklist with no open rows is not a checklist, it is marketing.
  let { rows = [] } = $props();

  const glyph = { clear: '✓', open: '!', note: '·' };
  const word = { clear: 'addressed', open: 'open', note: 'note' };
</script>

<ul class="au">
  {#each rows as row}
    <li class="au-row" data-state={row.state}>
      <span class="au-g" aria-hidden="true">{glyph[row.state]}</span>
      <span class="au-risk">{row.risk}<span class="au-state mono">{word[row.state]}</span></span>
      <span class="au-ans">{row.answer}</span>
    </li>
  {/each}
</ul>

<style>
  .au {
    list-style: none;
    display: grid;
    gap: 0;
    min-width: 0;
  }
  .au-row {
    display: grid;
    grid-template-columns: 1.4rem minmax(0, 1fr);
    gap: 0.15rem 0.8rem;
    align-items: baseline;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border);
    font-size: 0.86rem;
    line-height: 1.5;
  }
  .au-ans {
    grid-column: 2;
    color: var(--t2);
    overflow-wrap: anywhere;
  }
  @media (min-width: 900px) {
    .au-row {
      grid-template-columns: 1.4rem 24ch minmax(0, 1fr);
    }
    .au-ans {
      grid-column: 3;
    }
  }
  .au-g {
    font-weight: 700;
    text-align: center;
    grid-row: span 2;
  }
  @media (min-width: 900px) {
    .au-g {
      grid-row: auto;
    }
  }
  .au-row[data-state='clear'] .au-g {
    color: var(--green);
  }
  .au-row[data-state='open'] .au-g {
    color: var(--amber);
  }
  .au-row[data-state='note'] .au-g {
    color: var(--t3);
  }
  .au-risk {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.15rem 0.5rem;
    color: var(--t1);
    font-weight: 600;
  }
  .au-state {
    font-size: 0.66rem;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--t3);
  }
</style>
