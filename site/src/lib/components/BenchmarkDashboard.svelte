<script>
  import { modal } from '$lib/modal.js';
  // The hero's benchmark dashboard modal. One tab per benchmark family, a
  // hardware-class and a model select in the header that scope every tab
  // (dashboard-scope.js; the flagship model by default, so the charts do not
  // crowd), and a metadata card on every chart point. Data: gates.generated.json — the union of gate records
  // across ALL branches at build time, so the newest run shows even before its
  // PR merges (provenance shown per point and in the footer).
  import ConcurrencyTab from './ConcurrencyTab.svelte';
  import CostTab from './CostTab.svelte';
  import GateBenchSection from './GateBenchSection.svelte';
  import GatePointCard from './GatePointCard.svelte';
  import TabStrip from './TabStrip.svelte';
  import { browser } from '$app/environment';
  import { replaceState } from '$app/navigation';
  import { gateData, tabs, recordsFor, benchName, shortModel, colorFor, isTtftTab } from '$lib/gates.js';
  import vendors from '$lib/models.generated.json';
  import { flagshipRecipe } from '$lib/data.js';
  import {
    ALL_MODELS,
    flagshipModelOf,
    inScope,
    resolveScope,
    scopeOptions,
    scopedRecordsFor,
    subjectsInScope,
    tabsInScope,
  } from '$lib/dashboard-scope.js';
  import { TTFT_STATS } from '$lib/ttft-baselines.js';
  import { RECORD_SIGNING_DOC } from '$lib/receipt.js';
  import { SUBJECTS, rungsDeclared } from '$lib/concurrency-subjects.js';
  import { formatDashboardHash, isDeepLink, parseDashboardHash } from '$lib/dashboard-link.js';

  let { onclose } = $props();

  // What a hash may name: the tabs that earned one, the subjects in the SSOT,
  // and every rung any subject's gate declares — so `c=64` is a valid link even
  // on a subject whose gate stops at C=16 (it lands on a labelled "not run at
  // this rung" panel), while `c=3` never is.
  // The scope's options: hardware classes and models with records on a drawn
  // bench, never typed (dashboard-scope.js).
  const SUBJECT_TAB_IDS = ['concurrency', 'cost'];
  const options = scopeOptions(
    gateData.benchmarks,
    tabs.flatMap((t) => t.benches)
  );
  const FLAGSHIP = flagshipModelOf(vendors, flagshipRecipe);
  const known = {
    tabIds: tabs.map((t) => t.id),
    subjectIds: SUBJECTS.map((s) => s.id),
    rungs: [...new Set(SUBJECTS.flatMap((s) => rungsDeclared(s, recordsFor)))].sort((a, b) => a - b),
    stats: [...TTFT_STATS],
    hwClasses: options.classes,
    modelIds: [ALL_MODELS, ...new Set(Object.values(options.modelsByClass).flat())],
  };
  // The TTFT tabs' inner strip: one statistic at a time, both conditions.
  const STAT_TABS = TTFT_STATS.map((id) => ({ id, label: id === 'median' ? 'Median' : 'p90' }));
  const readLink = () => parseDashboardHash(browser ? location.hash : '', known);
  // A link that names a model keeps it; one from before the model select names
  // a subject and no model, and the subject's checkpoint decides; anything
  // else opens on the flagship.
  const scopeOf = (link) =>
    resolveScope(
      {
        hw: link.hw,
        model: link.model ?? (link.subjectGiven ? SUBJECTS.find((s) => s.id === link.subject).checkpoint : null),
      },
      options,
      FLAGSHIP
    );
  const initial = readLink();
  const initialScope = scopeOf(initial);
  // Resolved before the first render, so the server render and the first
  // paint already show a tab and a subject that are in scope.
  const initialTabs = tabsInScope(tabs, initialScope, { recordsFor, subjects: SUBJECTS, subjectTabIds: SUBJECT_TAB_IDS });
  const initialSubjects = subjectsInScope(SUBJECTS, initialScope);

  // A deep link picks the tab; a plain open lands on the first tab as before.
  let activeTab = $state(initialTabs.some((t) => t.id === initial.tab) ? initial.tab : initialTabs[0]?.id);
  // `subject` drives the concurrency tab's inner strip (bound both ways, so a
  // click and a pasted link agree). `rung` is held and written back so a
  // `c=64` link survives until the rung navigator mounts (a later step).
  let subject = $state(
    initialSubjects.some((s) => s.id === initial.subject) ? initial.subject : (initialSubjects[0]?.id ?? initial.subject)
  );
  let rung = $state(initial.c);
  // Median | p90 on both TTFT tabs. Shared between them, so flipping from TTFT
  // to High-ISL TTFT keeps the statistic the reader chose.
  let stat = $state(initial.stat);
  let hw = $state(initialScope.hw);
  let model = $state(initialScope.model);
  // The record(s) behind the clicked chart point. An array because one plotted
  // point can stand for several grouped runs — see GatePointCard.
  let selected = $state(null);
  let dialogEl = $state(null);

  const scope = $derived({ hw, model });
  const scopedFor = $derived(scopedRecordsFor(recordsFor, scope));
  const scopedSubjects = $derived(subjectsInScope(SUBJECTS, scope));
  const visibleTabs = $derived(tabsInScope(tabs, scope, { recordsFor, subjects: SUBJECTS, subjectTabIds: SUBJECT_TAB_IDS }));
  // A scope change can leave the tab, or the subject, out of scope: land on
  // the first one in it rather than on an empty panel.
  $effect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === activeTab)) activeTab = visibleTabs[0].id;
  });
  $effect(() => {
    if (scopedSubjects.length > 0 && !scopedSubjects.some((s) => s.id === subject)) subject = scopedSubjects[0].id;
  });
  const modelsHere = $derived(hw === null ? [] : options.modelsByClass[hw]);
  // Changing the class keeps the model when it has records there, else the flagship.
  function onhw() {
    model = resolveScope({ hw, model }, options, FLAGSHIP).model;
  }
  const tab = $derived(visibleTabs.find((t) => t.id === activeTab) ?? visibleTabs[0]);
  const onConcurrency = $derived(tab?.id === 'concurrency' && scopedSubjects.some((s) => s.id === subject));
  // Cost is the second subject-tabbed view: its inner subject strip IS the
  // model filter, exactly as on Concurrency, so the global model select is
  // hidden and subject/rung travel in the hash on both.
  const onCost = $derived(tab?.id === 'cost' && scopedSubjects.some((s) => s.id === subject));
  const onSubjectTab = $derived(onConcurrency || onCost);
  const onTtft = $derived(isTtftTab(tab?.id));
  // One bench, one section, holding the records in scope — except on the
  // subject tabs, where the subjects of the model in scope own every record.
  const sections = $derived(
    onSubjectTab
      ? []
      : (tab?.benches ?? []).map((b) => ({ benchId: b, name: benchName(b), records: scopedFor(b) })).filter((s) => s.records.length > 0)
  );
  // A bench of this tab with records on this class under other models only:
  // said, never silently dropped.
  const hiddenByFilter = $derived(
    onSubjectTab
      ? []
      : (tab?.benches ?? []).filter(
          (b) => recordsFor(b).some((r) => inScope(r, { hw, model: ALL_MODELS })) && !sections.some((s) => s.benchId === b)
        )
  );
  const src = gateData.sources;

  // Focus-in, the Tab trap and focus-return all live in `use:modal` below.
  // This effect used to call `dialogEl?.focus()` and stop there — a dialog
  // that claims `aria-modal="true"` while Tab still walks the page behind it,
  // which is the half of the contract that actually keeps a keyboard operator
  // inside. Body-scroll lock stays here: it is this dialog's own concern.
  $effect(() => {
    document.body.style.overflow = 'hidden';
    return () => (document.body.style.overflow = '');
  });

  // The URL is always the deep link to what is on screen. `replaceState` from
  // $app/navigation, because a bare history.replaceState nulls the history
  // metadata SvelteKit keeps there and breaks Back; replace rather than push so
  // tab flips do not pile up entries. Subject and rung travel only with the
  // concurrency tab — a TTFT link has no subject.
  $effect(() => {
    const hash = formatDashboardHash({
      tab: tab?.id ?? null,
      hw,
      model,
      subject: onSubjectTab ? subject : null,
      c: onSubjectTab ? rung : null,
      stat: onTtft ? stat : null,
    });
    replaceState(hash ? `#${hash}` : location.pathname + location.search, {});
  });
  // Cleared on close — but only while the hash is still ours, so a route
  // change mid-open cannot eat the next page's own hash (the deck uses one).
  $effect(() => () => {
    if (isDeepLink(readLink())) replaceState(location.pathname + location.search, {});
  });

  // A URL pasted in place, or Back/Forward between two deep links, re-syncs.
  // replaceState does not fire this, so the write-back above cannot loop.
  function onhashchange() {
    const link = readLink();
    if (!isDeepLink(link)) return;
    activeTab = link.tab;
    subject = link.subject;
    ({ hw, model } = scopeOf(link));
    rung = link.c;
    stat = link.stat;
  }

  function onkeydown(e) {
    if (e.key === 'Escape' && !selected) onclose();
  }
</script>

<svelte:window {onkeydown} {onhashchange} />

<div class="bd-backdrop" onclick={onclose} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- The click handler only stops a click inside the dialog reaching the
       backdrop's close handler; it is not an interaction. Keyboard dismissal
       is Escape, handled on the window. -->
  <div
    class="bd"
    role="dialog"
    aria-modal="true"
    aria-label="Metrale Engine benchmark dashboard"
    tabindex="-1"
    bind:this={dialogEl}
    use:modal
    onclick={(e) => e.stopPropagation()}
  >
    <header class="bd-head">
      <div class="bd-head-titles">
        <span class="slabel bd-label">gate receipts</span>
        <h2 class="bd-title">Benchmark dashboard</h2>
      </div>
      <div class="bd-head-end">
        <!-- The scope: which hardware class and which model every tab shows.
             Both lists are read from the published records. -->
        <div class="bd-scope" role="group" aria-label="Show certifications for">
          <!-- An explicit label (for/id), not a wrapping one: a wrapping label
               would fold the selected option's text into the select's name. -->
          <div class="bd-model">
            <label class="bd-model-label" for="bd-scope-hw">hardware</label>
            <select id="bd-scope-hw" bind:value={hw} onchange={onhw}>
              {#each options.classes as c}
                <option value={c}>{c.toUpperCase()}</option>
              {/each}
            </select>
          </div>
          <div class="bd-model">
            <label class="bd-model-label" for="bd-scope-model">model</label>
            <select id="bd-scope-model" bind:value={model}>
              {#each modelsHere as m}
                <option value={m}>{shortModel(m)}{m === FLAGSHIP ? ' · flagship' : ''}</option>
              {/each}
              <option value={ALL_MODELS}>all models</option>
            </select>
          </div>
        </div>
        <button type="button" class="bd-close" onclick={onclose} aria-label="Close dashboard">✕</button>
      </div>
    </header>

    <div class="bd-controls">
      <TabStrip prefix="bd" label="Benchmarks" tabs={visibleTabs} bind:active={activeTab} />
    </div>

    <!-- The outer tabpanel. Nested tablists (subjects, rungs) live INSIDE this
         panel, never inside a tab, so each stays its own roving group. -->
    <div class="bd-body" id="bd-panel-{tab?.id}" role="tabpanel" aria-labelledby="bd-tab-{tab?.id}" tabindex="-1">
      {#if onConcurrency}
        <ConcurrencyTab
          bind:subject
          rungs={known.rungs}
          benches={tab.benches}
          recordsFor={scopedFor}
          subjects={scopedSubjects}
          onselect={(recs) => (selected = recs)}
        />
      {/if}
      {#if onCost}
        <CostTab
          bind:subject
          bind:rung
          benches={tab.benches}
          recordsFor={scopedFor}
          subjects={scopedSubjects}
          onselect={(recs) => (selected = recs)}
        />
      {/if}
      {#if onTtft}
        <!-- Nested inside the outer tabpanel, like the subject strips. Each
             stat tab controls the one panel below, which holds every section. -->
        <TabStrip prefix="tt" label="TTFT statistic" tabs={STAT_TABS} bind:active={stat} />
        <div id="tt-panel-{stat}" role="tabpanel" aria-labelledby="tt-tab-{stat}">
          {#each sections as s (s.benchId)}
            <GateBenchSection {...s} {stat} onselect={(recs) => (selected = recs)} />
          {/each}
        </div>
      {:else}
        {#each sections as s (s.benchId)}
          <GateBenchSection {...s} onselect={(recs) => (selected = recs)} />
        {/each}
      {/if}
      {#if sections.length === 0 && !onSubjectTab}
        <p class="bd-empty">No records for this model on this hardware in this benchmark family.</p>
      {/if}
      {#each hiddenByFilter as b}
        {@const rs = recordsFor(b).filter((r) => inScope(r, { hw, model: ALL_MODELS }))}
        <p class="bd-filtered-note">
          <span class="gpc-swatch" style="background:{colorFor(rs[0].target_model)}" aria-hidden="true"></span>
          {benchName(b)} runs on {shortModel(rs[0].target_model)} — switch the model to see its {rs.length} records.
        </p>
      {/each}
      {#if tab?.id === 'bfcl'}
        <p class="bd-footnote">
          The two BFCL charts use different models AND different sample draws (see a point's run parameters) — scores are comparable within
          a chart, not across them.
        </p>
      {/if}
    </div>

    <footer class="bd-foot">
      <span>
        {src.committed + src.from_branches} records · {Object.keys(gateData.benchmarks).length} of {gateData.registered.length} registered benchmarks
        have one
        {#if src.from_branches > 0}· {src.from_branches} from {src.branches_scanned} remote branch heads{/if}
        · as of {gateData.generated_date}
      </span>
      <a href={RECORD_SIGNING_DOC} target="_blank" rel="noopener">how to verify a record</a>
    </footer>
  </div>
</div>

{#if selected}
  <GatePointCard records={selected} onclose={() => (selected = null)} />
{/if}
