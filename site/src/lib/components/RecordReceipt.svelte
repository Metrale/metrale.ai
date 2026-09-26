<script>
  // The receipt for a chart's latest point: the signed record it was drawn
  // from, the signature beside it, the key that made it, and how to check one.
  // Every other point's receipt is on its card. Renders nothing when no record
  // says where it lives.
  import { fmtDate } from '$lib/gates.js';
  import { RECORD_SIGNING_DOC, latestReceipt } from '$lib/receipt.js';

  /** @type {{ records: object[] }} */
  let { records } = $props();
  const receipt = $derived(latestReceipt(records));
</script>

{#if receipt}
  <p class="gate-panel-receipt">
    latest point, {fmtDate(receipt.recordedAt)} · <code>{receipt.sha}</code> ·
    <a href={receipt.record} target="_blank" rel="noopener">record</a>
    {#if receipt.signature}· <a href={receipt.signature} target="_blank" rel="noopener">signature</a>{/if}
    {#if receipt.signer}· <a href={receipt.signer} target="_blank" rel="noopener">signing key</a>{/if}
    · <a href={RECORD_SIGNING_DOC} target="_blank" rel="noopener">how to verify a record</a>
  </p>
{/if}
