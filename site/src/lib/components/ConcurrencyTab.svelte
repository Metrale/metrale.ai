<script>
  // The Concurrency tab: one inner tab per subject (the SSOT list in
  // concurrency-subjects.json), one ConcurrencySubjectPanel for the active
  // one. The subjects are those of the model in the dashboard's header select,
  // so a model with two subjects (dense and DFlash) keeps two tabs here.
  //
  // `subject` is bound to the dashboard so the deep link
  // (#bench=concurrency&subject=…) both selects a tab and follows a click.
  import TabStrip from './TabStrip.svelte';
  import ConcurrencySubjectPanel from './ConcurrencySubjectPanel.svelte';
  import { formatUnassigned, recordsOf, unassignedRecords } from '$lib/concurrency-subjects.js';

  /**
   * @type {{
   *   subject: string,
   *   rungs: number[],
   *   benches: string[],
   *   recordsFor: (benchId: string) => object[],
   *   subjects: Array<{id: string, label: string, checkpoint: string, gate: string}>,
   *   onselect: (recs: object[]) => void
   * }}
   */
  let { subject = $bindable(), rungs, benches, recordsFor, subjects, onselect } = $props();

  // `subjects` is the dashboard's scope: the subjects of the model in its
  // header select (dashboard-scope.js#subjectsInScope), every one for all models.
  const bySubject = $derived(subjects.map((s) => ({ s, records: recordsOf(s, recordsFor) })));
  // A subject with no records still gets a tab — the owner wants the empty
  // state shown — and the chip is inside the button, so the state is heard
  // when the tab is reached by arrow key, not only seen.
  const tabs = $derived(
    bySubject.map(({ s, records }) => ({
      id: s.id,
      label: s.label,
      chip: records.length === 0 ? 'not yet measured' : undefined,
    }))
  );
  const active = $derived.by(() => {
    const found = bySubject.find((b) => b.s.id === subject);
    // The dashboard resolves the hash through resolveSubject before this
    // mounts, so an unknown id here is a wiring bug, not user input.
    if (!found) throw new Error(`ConcurrencyTab: unknown subject ${JSON.stringify(subject)}`);
    return found;
  });
  // Listed, never dropped: a new checkpoint's runs must be visible somewhere
  // until it gets a subject.
  const unassigned = $derived(unassignedRecords(benches, recordsFor));
</script>

<div class="ct">
  <TabStrip prefix="cs" label="Concurrency subjects" {tabs} bind:active={subject} />
  <ConcurrencySubjectPanel subject={active.s} records={active.records} {rungs} {onselect} />
  {#if unassigned.length > 0}
    <p class="bd-footnote">
      unassigned: {unassigned.map(formatUnassigned).join(' · ')}
    </p>
  {/if}
</div>
