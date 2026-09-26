<script>
  // The trust strip under the hero: four facts, each linked to its source.
  // Three are data in `proof` (data.js); the fourth is the signed-record
  // count, read from live.generated.json so the number is never typed.
  import { proof } from '$lib/data.js';
  import counts from '$lib/live.generated.json';
  import { fill } from './engine/bench/ladder-facts.js';
  import ProofIcon from './engine/bench/ProofIcon.svelte';

  const items = [
    ...proof.items.map((i) => ({ ...i, external: true })),
    {
      ...proof.signed,
      url: proof.signed.href,
      text: fill(proof.signed.text, { signed: counts.gates.signed, records: counts.gates.records }),
      external: false,
    },
  ];
</script>

<section id="proof" class="av av-section av-section-tight av-sx-green eg-proof" aria-label={proof.label}>
  <div class="av-container">
    <ul class="eg-proof-strip">
      {#each items as item (item.kind)}
        <li>
          <a
            class="eg-proof-item"
            href={item.url}
            target={item.external ? '_blank' : undefined}
            rel={item.external ? 'noopener' : undefined}
          >
            <span class="eg-proof-glyph"><ProofIcon kind={item.kind} /></span>
            <span class="eg-proof-text">
              <span class="eg-proof-tag">{item.tag}</span>
              <span class="eg-proof-name">{item.text} <span class="av-arrow">{item.external ? '↗' : '→'}</span></span>
            </span>
          </a>
        </li>
      {/each}
    </ul>
  </div>
</section>

<style>
  .eg-proof {
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    padding: 1.75rem 0;
  }
  .eg-proof-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.75rem;
  }
  .eg-proof-item {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    height: 100%;
    padding: 0.85rem 1rem;
    border: 1px solid transparent;
    border-radius: var(--av-radius-sm);
    color: inherit;
    text-decoration: none;
    transition:
      border-color 0.18s,
      background 0.18s,
      transform 0.18s var(--av-ease);
  }
  .eg-proof-item:hover {
    border-color: var(--border);
    background: var(--card);
    transform: translateY(-1px);
  }
  .eg-proof-glyph {
    flex: none;
    width: 34px;
    height: 34px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--sx) 14%, transparent);
    color: var(--sx-text);
  }
  .eg-proof-text {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
  }
  .eg-proof-tag {
    font-family: var(--font-mono);
    font-size: 0.64rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--t3);
  }
  .eg-proof-name {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--t1);
    line-height: 1.35;
  }
  .eg-proof-name .av-arrow {
    color: var(--t3);
    font-weight: 500;
  }
  .eg-proof-item:hover .eg-proof-name .av-arrow {
    color: var(--sx-text);
  }
  @media (max-width: 1080px) {
    .eg-proof-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 560px) {
    .eg-proof-strip {
      grid-template-columns: minmax(0, 1fr);
      gap: 0.25rem;
    }
    .eg-proof-item {
      padding: 0.6rem 0.5rem;
    }
  }
</style>
