// =============================================================================
// Central data source for ALL site copy + links (SSOT).
// Components are presentation only. Generated data (models, benchmarks, stars)
// lives in *.generated.json and is imported by components directly.
//
// VOICE: confident and plain, builder-to-builder. No colons, no em dashes, no
// semicolons in the visible copy. Commas and periods only. No exclamation
// marks, no emoji in prose, and nothing that reads as a novelty. An operator
// evaluating an engine for a rack and a developer evaluating it for a desk are
// reading the same page.
//
// SCOPE: the engine spans a range, from edge class accelerators through workstations
// to multi node deployments. Copy must not narrow that to "desk machines", and
// must not claim a tier we have not verified. Verified silicon is named. The
// rest is stated as direction, with its status attached.
//
// CLAIM POLICY: every performance number is generated-from-repo or mechanically
// true. No hand-typed tok/s. No bare "fastest / best / #1". Third-party names
// carry a live artifact link and a status-true tense.
// =============================================================================

// --- canonical links ---------------------------------------------------------
// Public developer URL. adapter-static still writes engine.html; Cloudflare
// Pages pretty-URLs /engine (200) and 308s /engine.html → /engine. Vite
// preview serves /engine from that file too. Do not put .html in hrefs.
import { CLI, ENGINE_REPO, REGISTRY_REPO } from '../../../web-shared/sources.mjs';
export const ENGINE = '/engine';
export const CONTROL = '/control';
export { CLI };
export const githubUrl = ENGINE_REPO;
export const discordUrl = 'https://discord.gg/RQcGakU2jW';
export const blogUrl = 'https://blog.metrale.ai';
export const redditUrl = 'https://www.reddit.com/r/LocalLLaMA/comments/1rmvxo3/';
export const firstPostUrl = 'https://www.reddit.com/r/LocalLLaMA/comments/1rkefjw/solved_the_dgx_spark_102_stable_toks_qwen3535ba3b/';
export const recipesUrl = REGISTRY_REPO;
export const guideUrl = `${ENGINE_REPO}/blob/main/docs/GB10_DEPLOYMENT_GUIDE.md`;
export const verifiedAnchor = `${ENGINE_REPO}/blob/main/docs/GB10_DEPLOYMENT_GUIDE.md#8-what-verified-means-so-you-can-trust-an-image`;
export const gateSrcUrl = `${ENGINE_REPO}/blob/main/tests/gate_results.py`;
export const discussionsUrl = `${ENGINE_REPO}/discussions`;
export const issuesUrl = `${githubUrl}/issues`;
export const goodFirstIssuesUrl = `${ENGINE_REPO}/labels/good%20first%20issue`;
// Single source of truth for contact addresses (footer + reach-out section).
export const contactEmails = ['engineering@metrale.com']; // the role mailbox; see contacts in content/brand.js

// third-party artifacts (link-or-cut, each verified live July 2026)
export const scaleUrl = 'https://docs.scale-lang.com/stable/';
export const strixKernelsUrl = `${ENGINE_REPO}/tree/main/kernels/strix`;
export const nvidiaInceptionUrl = 'https://www.nvidia.com/en-us/startups/';

// --- brand -------------------------------------------------------------------
export const tagline = 'Pure Rust inference, from the device in your hand to the datacenter rack.';

// --- commands (one flagship recipe) ------------------------------------------
//
// The recipe name has a SECOND home, in another repository: the installer's
// closing hint, `scripts/install.sh` in the installers' repository
// (`info "    $BIN_NAME run <recipe>"`). A constant cannot span repos, so that
// copy has to be changed by hand when this one changes.
//
// The previous note here said "kept in lockstep with static/install.sh". There
// is no such file in this repository, so a maintainer following it found
// nothing and the lockstep it asked for could not happen.
//
// `llms.txt` needs no such care: gen-llms.mjs emits `data.runCommandRaw`, so it
// follows this constant on its own.
export const flagshipRecipe = 'qwen3.6-35b-a3b-fp8-mtp';
export const quickInstall = `cargo install ${CLI}`;
/// Where install.sh is served from. One authority: the join one-liner in
/// `joincommand.js` builds on this too, and a second copy is how the two drift.
export const installerUrl = 'https://metrale.ai/install.sh';
/// The Windows counterpart. Windows visitors were shown the `curl … | sh` line
/// too, which cannot run there: PowerShell has no `sh`, and Git Bash reaches
/// install.sh only to be refused by it.
export const powershellInstallerUrl = 'https://metrale.ai/install.ps1';
/// The shell one-liner, and the prerendered default. `currentInstall()` in
/// `$lib/install/host.svelte.js` is what a page should print once it knows
/// which machine it is talking to.
export const runCommand = `curl -fsSL ${installerUrl} | sh`;
/// Install the agent as a service — deliberately `install`, not `run`: a bare
/// `run` dies with the terminal that started it, and the machine silently
/// leaves the fleet the next time someone closes an ssh session.
export const startAgentCommand = `${CLI} agent install`;
/// Built from `flagshipRecipe`, not repeating it. The constant existed and was
/// referenced by nothing while its value sat hardcoded eleven lines below —
/// so changing the flagship recipe would have updated the obvious place and
/// left the command the site tells people to copy pointing at the old one.
/// `installerUrl` above already states this rule: "a second copy is how the two
/// drift".
export const runCommandRaw = `${CLI} run ${flagshipRecipe}`;

// --- announcement strip (the one line above the hero) ------------------------
// One row, the front page's pattern. Emptying `text` takes the strip off the
// page: the component renders nothing without it.
export const announcement = {
  tag: 'Preview',
  text: 'Metrale Fleet Manager runs models from your browser on the machines you pair, and nothing leaves your network. It is in preview, and feedback is welcome.',
  cta: 'Open the control plane',
  href: CONTROL,
};

// --- nav (SSOT for the /engine jump bar and the /control bar and drawer) -----
export const nav = {
  // `hue` is the section's colour in the jump bar, by the tokens' grammar:
  // green for a verified result, violet for the engine, gold for the
  // community, cyan for the control plane.
  links: [
    { text: 'Verified', href: `${ENGINE}#verified`, hue: 'green' },
    { text: 'Models', href: `${ENGINE}#models`, hue: 'violet' },
    { text: 'Get running', href: `${ENGINE}#run`, hue: 'violet' },
    { text: 'Community', href: `${ENGINE}#community`, hue: 'gold' },
    { text: 'Reach out', href: `${ENGINE}#reach`, hue: 'gold' },
    { text: 'Control', href: CONTROL, hue: 'cyan' },
    { text: 'Blog', href: blogUrl, hue: 'gold' },
  ],
  menuLabel: 'Menu',
  closeLabel: 'Close menu',
};

// --- hero --------------------------------------------------------------------
// The figures the hero prints (rungs won, the margin, the top rung) come from
// ladder.generated.json inside Hero.svelte. Nothing numeric about performance
// is typed here. "75 MB" is the size of the binary, and the front page says it.
export const hero = {
  kicker: 'Metrale Engine, the inference layer',
  pillars: ['Open source', 'Rust and CUDA', 'Verified on DGX Spark'],
  headline: ['More inference from the silicon you already own.', 'One signed binary, verified on every release.'],
  sub: 'Metrale Engine is the open source inference layer of the Metrale platform. Rust and CUDA in one 75 MB binary, with no Python or PyTorch in the request path, OpenAI and Anthropic compatible APIs, and a signed gate record behind every release. It runs on a single accelerator today and scales across nodes with expert parallelism.',
  primaryCta: 'Get running',
  secondaryCta: 'Talk to us',
  githubCta: 'Star on GitHub',
  // The line under the actions. Hero.svelte fills the figures in from the
  // generated ladder; this is only the frame around them.
  claim: {
    conditions: 'Same box, same checkpoint, same client.',
    logCta: 'Read the campaign log',
  },
  // The benchmark story beside the copy: the frame's kicker, the three stat
  // labels, and the control that opens the dashboard.
  art: {
    kicker: 'Published DGX Spark ladder',
    stats: {
      ratio: 'the matched vLLM configuration at the top rung',
      throughput: 'aggregate tok/s at the top rung',
      rungs: 'rungs won',
    },
    records: 'signed records',
    dashboardCta: 'View the benchmark dashboard',
  },
};

// --- proof strip (prominent, right under the hero) ---------------------------
export const proof = {
  label: 'Proof',
  // The trust strip under the hero. Four facts, each linked to its source.
  // The signed-record count is read from live.generated.json by the
  // component; only the words around it live here, so the number is never
  // typed. `kind` picks the glyph (components/engine/bench/ProofIcon.svelte).
  items: [
    { kind: 'partner', tag: 'Partner', text: 'Built with SCALE by Spectral Compute', url: scaleUrl },
    { kind: 'program', tag: 'Program', text: 'NVIDIA Inception member', url: nvidiaInceptionUrl },
    { kind: 'licence', tag: 'Licence', text: 'MIT OR Apache-2.0, at your option', url: `${githubUrl}/blob/main/LICENSE-MIT` },
  ],
  signed: { kind: 'records', tag: 'Records', text: '{signed} of {records} gate records signed', href: `#verified` },
};

// --- star / social proof -----------------------------------------------------
export const stars = {
  label: '// 07 · community',
  title: 'Built in the open.',
  sub: 'The engine went from one Reddit post to a community running it on their own hardware, and every line of it is in the repository.',
  cta: 'Star the repo',
};

// --- community / discord push ------------------------------------------------
export const community = {
  label: '// come build with us',
  title: 'The action is in Discord.',
  body: 'Hundreds of builders are running Metrale Engine on their own hardware right now. We are in there every day, shipping fixes, taking model requests, and tuning kernels in the open. Your machine is the test fleet and your voice sets the roadmap.',
  cta: 'Join the Discord',
  sub: 'Active every day.',
};

// --- verified performance (the gate receipt) ---------------------------------
export const verified = {
  label: 'Verified',
  title: 'Every number is a receipt.',
  sub: 'Metrale Engine is benchmarked on every release against a committed baseline, and every record is signed. The performance on this page comes from those records, stamped with the engine commit and the date. If a number is not in the repository, it is not on this page.',
  mechanism: 'A release that ships slower than the committed baseline fails our gate.',
  challengeLine: 'Beat these numbers or catch a regression, open an issue and we will feature it.',
  challengeCta: 'Open an issue',
  // The headline comparison, three tiles over the ladder chart. Every {value}
  // is read from ladder.generated.json by components/engine/bench/ladder-facts.js.
  headline: {
    ratio: {
      label: 'Against matched vLLM at C={c}',
      body: '{baselineLabel} runs vLLM with its own speculative decoding at the same K as the engine, on the same box, checkpoint, client and prompts.',
    },
    throughput: {
      label: 'Aggregate throughput at C={c}',
      unit: 'tok/s',
      body: '{checkpoint} on one DGX Spark. {aggregate}.',
    },
    rungs: {
      label: 'Rungs won, C={from} to C={c}',
      body: 'Margin {min}× to {max}× against the matched configuration at every rung, with the rungs we lost on the way in the campaign log.',
    },
  },
  stamp: 'engine {sha} · {date}',
  // Rendered under the ladder chart. The figures in it are derived from
  // ladder.generated.json by lib/ladder.js, never typed here.
  scale: {
    title: 'The top of the ladder is the part that matters.',
    lead: 'Agentic work arrives as fleets of tool calling agents sharing a context bus, and the engine underneath them is judged where the requests pile up, not at a single stream.',
    tail: 'An engine that flattens under load caps how many agents you can run on the hardware you have. Holding the curve is what turns one accelerator into a fleet.',
  },
  // What the comparison does and does not say. Each {value} is read from the
  // ladder manifest by caveatsOf in ladder-facts.js, so a re-measured
  // baseline rewrites its date here on the next build.
  caveats: {
    kicker: 'What this does and does not say',
    box: { label: 'One accelerator', text: '{gpu}. {boxNote}.' },
    checkpoint: {
      label: 'One checkpoint',
      text: '{checkpoint}, a {checkpointNote}. Other models are measured in the dashboard and claimed nowhere else.',
    },
    baseline: {
      label: 'A matched baseline',
      text: '{baselineLabel} is {baselineEngine} with {baselineSpeculation}, measured {baselineFrom} to {baselineTo}. It is a dated snapshot, not a live series.',
    },
    workload: {
      label: 'One workload',
      text: 'ISL {isl} and OSL {osl}, {reps} timed reps after {warmup} warmup, temperature {temperature}, seed {seed}. Your prompts will differ.',
    },
    unmatched: {
      label: 'Drawn, not scored',
      text: '{unmatchedLabels} differs on {unmatchedDeltas}. It is on the chart for completeness and is not the denominator of any ratio here.',
    },
    scope: {
      label: 'Nothing beyond that',
      text: 'One box, one checkpoint, one workload. This says nothing about other hardware until we have run it there.',
    },
  },
  // The entry point to the benchmark dashboard, one control per family.
  dashboard: {
    kicker: 'Benchmark dashboard',
    title: 'Every benchmark family, every signed run.',
    body: 'Agentic, BFCL, TTFT, decode, concurrency and cost, one tab each. Every chart point opens its record, its signature and the steps to reproduce it.',
    groupLabel: 'Open the dashboard on a benchmark family',
    cta: 'Open the dashboard',
  },
  // The trust signals beside the release-gate receipt.
  trust: {
    signed: {
      title: 'Signed records',
      body: '{signed} of {records} gate records carry a detached signature and the public key that made it, committed beside the record. The newest is from {newest}.',
      cta: 'How to verify a record',
      // The certification chapter of the engine's book. Held equal to
      // RECORD_SIGNING_DOC in lib/receipt.js by ladder-facts.test.js: the page
      // cannot import receipt.js, which is shared with the lazily loaded
      // dashboard and would split into one more preload (page-weight.spec.js).
      url: 'https://docs.metrale.ai/project/landing.html',
    },
    gate: {
      title: 'The release gate',
      cta: 'What verified means',
      ctaSource: 'gate_results.py',
    },
    reproduce: {
      title: 'Reproduce it',
      body: 'The campaign log holds every rung, every raw file and the harness sha, including the rungs we lost on the way and the claims we retracted.',
      cta: 'Read the campaign log',
    },
  },
};

// --- models ------------------------------------------------------------------
export const models = {
  label: '// 05 · models',
  title: 'Every model here has a recipe.',
  sub: 'Pick a vendor, then a family. Every card maps to one recipe in the recipe registry, so the site cannot list a model we do not ship. Copy the command and run it as is. Qwen leads because it has the most recipes.',
};

// --- get running -------------------------------------------------------------
export const getRunning = {
  label: '// 06 · start',
  title: 'Up and running in one command.',
  sub: 'This is the first 60 seconds. Everything after, per model recipes, EP=2, tuning, lives in the docs.',
  inspectNote: `Rather not pipe curl to a shell. Install ${CLI} from crates.io, then run the flagship recipe direct.`,
  docsCta: 'Read the deployment guide',
  quickstartHint: `The script downloads a prebuilt ${CLI}, verifies its checksum, and installs it to ~/.local/bin. No Python, no Rust toolchain. Run it with --uninstall to reverse it.`,
};

// --- mission -----------------------------------------------------------------
export const mission = {
  title: 'Our position',
  statement: 'AI worth having should run on hardware you own.',
  // Shown small, under the statement: the reasoning, not a second claim.
  footnote:
    'An accelerator at the edge, the workstation under a desk, or a rack you operate. Metrale builds one engine for that whole range, in Rust so the entire path from HTTP to kernel dispatch can be read by one engineer, and verifies it on the silicon we can put our hands on. NVIDIA and AMD provide the machines we develop on, and the community running the engine is the test fleet.',
};

// --- contribute --------------------------------------------------------------
export const contribute = {
  label: '// 08 · build with us',
  title: 'Your machine is the test fleet.',
  sub: 'Metrale Engine grows from the machines it runs on. Every path below is real and linked. The engine is open source under MIT OR Apache-2.0.',
  paths: [
    {
      title: 'Run the serve matrix',
      body: 'Boot the matrix on your own GB10 and report what you see. Regressions and wins both get featured.',
      cta: 'Deployment guide',
      url: guideUrl,
    },
    {
      title: 'Add or tune a recipe',
      body: 'Recipes are the model SSOT. Add a model, tune a quant, open a pull request against the recipe registry.',
      cta: 'The recipe registry',
      url: recipesUrl,
    },
    {
      title: 'Kernels in Rust and CUDA',
      body: 'Hand tuned attention, MoE, GDN, Mamba-2 for Blackwell. Register level work, no generic fallbacks.',
      cta: 'Good first issues',
      url: goodFirstIssuesUrl,
    },
    {
      title: 'Docs, triage, ideas',
      body: 'Improve the guide, triage issues, or just tell us what you are running in Discord.',
      cta: 'Discussions',
      url: discussionsUrl,
    },
  ],
  cla: 'The engine is licensed MIT OR Apache-2.0. See CONTRIBUTING.md for how a change lands.',
};

// --- roadmap (next up + artifact-linked) -------------------------------------
export const roadmap = {
  rowTitle: 'What we are building next.',
  rowSub:
    'Everything shipped links to an issue, a PR, or the Discord where the work happens. Anything not yet committed carries its status, and we do not round it up.',
  items: [
    {
      title: 'Three node GB10 topology',
      status: 'Next up',
      body: 'Three GB10s in one rig for models that will not fit across two. More memory, more experts, more concurrency headroom. We are wiring up the topology now.',
      cta: 'Discuss the topology in Discord',
      url: discordUrl,
    },
    {
      title: 'Intel Arc Pro B70',
      status: 'In talks',
      body: 'Active conversations with Intel about bringing the engine to the Arc Pro B70. Nothing is signed yet, and this card will say so until it is.',
      cta: 'Follow along in Discord',
      url: discordUrl,
    },
    {
      title: 'AMD Strix Halo',
      status: 'Runs through SCALE',
      body: 'Native gfx1151 through SCALE. AMD provided a Strix Halo desktop and we brought the engine to it, custom kernels and all.',
      cta: 'The gfx1151 kernels',
      url: strixKernelsUrl,
    },
    {
      title: 'Bigger model support',
      status: 'Tracking',
      body: 'Large MoE NVFP4 ports across EP topologies, DeepSeek and Kimi class, tracked in the open.',
      cta: 'Open issues',
      url: issuesUrl,
    },
  ],
};

// --- FAQ ---------------------------------------------------------------------
// Rendered on the page AND emitted as FAQPage structured data. Both come from
// here, which is what keeps the markup answering the same questions the page
// answers — marking up an answer a visitor cannot see is a search-policy
// violation, not a shortcut.
//
// CLAIM POLICY applies: every answer below restates something already shown
// elsewhere on this page or in a linked artifact. No new numbers.
export const faq = {
  label: '// 09 · questions',
  title: 'The questions we actually get asked.',
  sub: 'Short answers, each one backed by something on this page or in the repo.',
  items: [
    {
      q: 'What is Metrale Engine?',
      a: 'An open source LLM inference engine written in pure Rust and CUDA. It serves an OpenAI-compatible API from a single binary, with no Python and no PyTorch in the serving path. One codebase covers the range, from edge-class accelerators through workstations to expert-parallel deployments across nodes.',
    },
    {
      q: 'What hardware does Metrale Engine run on?',
      a: 'NVIDIA DGX Spark (GB10) is verified today, and AMD Strix Halo (gfx1151) runs the same CUDA source compiled through SCALE by Spectral Compute — one codebase, no HIP port.',
    },
    {
      q: 'Is Metrale Engine faster than vLLM on a DGX Spark?',
      a: 'On the published concurrency ladder, yes at every rung from C=1 to C=128, by 1.012x to 1.333x against the matched vLLM + MTP configuration. The margin is widest at the top, because between C=64 and C=128 Metrale Engine keeps scaling and the matched vLLM configuration flattens. Same box, same checkpoint, same client, same prompts, greedy sampling with matched penalties. The full campaign log, including the rungs we lost on the way, is in the repo.',
    },
    {
      q: 'How do I install it?',
      a: `One command: curl -fsSL https://metrale.ai/install.sh | sh. It downloads a prebuilt ${CLI}, verifies its checksum, and installs to ~/.local/bin. If you would rather not pipe curl to a shell, cargo install ${CLI} does the same thing from source.`,
    },
    {
      q: 'Which models can I run?',
      a: 'Every model on this page maps to a recipe in the recipe registry, which is the single source of truth — the site cannot list a model that has no recipe. Qwen has the most recipes, and the published concurrency ladder is measured on Qwen3.8-27B. Gemma, Nemotron, Mistral, MiniMax and DeepSeek have recipes too.',
    },
    {
      q: 'What does “verified” mean here?',
      a: 'An image ships only after the serve matrix passes: every model boots, stays coherent under greedy determinism with no token leakage and reliable tool calls, and holds throughput within 10% of its committed baseline. A release that ships slower than its baseline fails the gate.',
    },
    {
      q: 'Why does concurrency matter more than single-stream speed?',
      a: 'Because agentic systems do not send one request at a time. A fleet of tool-calling agents sharing a context bus arrives as many concurrent streams, so the engine is judged where the requests pile up. On the published ladder Metrale Engine keeps gaining throughput from C=64 to C=128 while the leading vLLM configuration does not, and an engine that flattens under load caps how many agents a given box can actually run.',
    },
    {
      q: 'What license is Metrale Engine under, and can I use it commercially?',
      a: 'Metrale Engine is dual licensed under MIT OR Apache-2.0, at your option, so yes, commercial use is allowed under either license. If you are running it in production and want support, email us.',
    },
    {
      q: 'Does Metrale Engine run multi-node?',
      a: 'Yes. EP=2 expert parallelism across two DGX Sparks is supported and shipped as recipes; those cards are marked EP=2 in the model list. A three-node GB10 topology is being wired up now.',
    },
  ],
};

// --- reach out ---------------------------------------------------------------
// The closing band. The primary action books a working session on the demo
// page; the mailbox and Discord stay beside it for the people who would rather
// write first. `icon` names one of the inline marks ReachOut.svelte draws.
export const reachout = {
  label: 'Reach out',
  title: 'Put the engine on your workload.',
  sub: 'We run the ladder on your models, on your hardware, and hand you the record.',
  cards: [
    {
      icon: 'briefcase',
      title: 'Production',
      body: 'Evaluating the engine for production or already running it. Tell us what you serve and we will scope the deployment with you.',
    },
    {
      icon: 'handshake',
      title: 'Partnerships',
      body: 'Frameworks, benchmarks and standards bodies. If it advances inference on hardware people own, we want the conversation.',
    },
    {
      icon: 'chip',
      title: 'Silicon',
      body: 'Hardware you want Metrale Engine running on. Tell us about it and we will scope the bring up.',
    },
  ],
  primaryCta: 'Book a demo',
  emails: contactEmails,
  discordCta: 'Find us in Discord',
};

// --- ask the codebase (chat modal) -------------------------------------------
// Copy SSOT for the CodeChat modal. Retrieval runs locally in wasm from the
// repo corpus, answers come from free OpenRouter models with the visitor's own
// key. Same voice rules as everything above.
export const codeChat = {
  // Off until the engine's repository publishes its own code index: its coderag
  // workflow runs, but the index has no host until GitHub Pages is switched on
  // there (CORPUS_GZ_URL in chat/config.js is the address it will have). What
  // could be read today is an index of the open source code the engine builds
  // on, which is not what `sub` promises. CHAT_ON in e2e/fixtures/chat-helpers.js follows this
  // switch, and a unit test holds the two equal.
  enabled: false,
  navLabel: 'Ask the codebase',
  closeLabel: 'Close ask the codebase',
  label: '// 11 \u00b7 ask the codebase',
  title: 'Ask the codebase.',
  sub: 'The whole Metrale repo is embedded into a vector lattice that runs right here in your browser. Ask a question, get an answer with file and line receipts.',
  boot: [
    'metrale code lattice online',
    'retrieval runs locally in wasm, only the model call leaves this page',
    'pick a question or type your own',
  ],
  starters: [
    'How does MTP speculative decoding pick which draft tokens to keep?',
    'Where does the scheduler decide which requests join a decode batch?',
    'How do the NVFP4 GEMM kernels get dispatched on GB10?',
  ],
  key: {
    tag: 'openrouter key',
    lead: 'Answers come from free models on OpenRouter, so you bring your own key. It stays in this browser and we never see it.',
    linkText: 'grab a free key at openrouter.ai/keys',
    url: 'https://openrouter.ai/keys',
    placeholder: 'sk-or-v1-...',
    inputLabel: 'OpenRouter API key',
    reveal: 'show',
    conceal: 'hide',
    save: 'connect',
    connectedTag: 'connected',
    connectedNote: 'key stored in this browser only',
    change: 'swap key',
  },
  status: {
    idle: 'standby',
    'wasm-init': 'starting engine',
    manifest: 'fetching manifest',
    'loading-cached': 'reading local cache',
    downloading: 'downloading corpus',
    caching: 'writing local cache',
    indexing: 'indexing',
    ready: 'ready',
    error: 'fault',
  },
  offlineBadge: 'cached \u00b7 offline',
  phase: {
    retrieving: 'searching the lattice',
    reranking: 'reranking matches',
    thinking: 'reasoning',
    writing: 'writing',
  },
  trace: {
    label: 'reasoning',
    reasonedPrefix: 'reasoned for',
    show: 'show',
    hide: 'hide',
  },
  loader: {
    title: 'mounting the code lattice',
    commitLabel: 'commit',
    sizeLabel: 'download',
    chunksLabel: 'chunks',
    stages: {
      'wasm-init': 'start the wasm engine',
      manifest: 'fetch the corpus manifest',
      corpus: 'load the corpus',
      indexing: 'index the chunks',
    },
    cancelNote: 'close anytime, the download cancels cleanly and nothing partial is kept',
  },
  input: {
    placeholder: 'ask about kernels, scheduling, quantization, anything in the repo',
    ask: 'ask',
    hintLoading: 'the corpus is still mounting, hang tight',
    hintNoKey: 'connect your OpenRouter key above to ask',
    fine: 'answers are generated and can be wrong, the source links are real so read them before you trust them',
  },
  answerTag: 'answer',
  sourcesHeading: 'source receipts',
  sourcesOne: 'source',
  sourcesMany: 'sources',
  loadFail: 'The chat window did not load, maybe the network blinked. Close and try again.',
  model: {
    label: 'answer model',
    reset: 'back to free',
  },

  errors: {
    wasm: {
      tag: 'engine fault',
      body: 'The wasm engine failed to start. Usually a one off, a retry brings it right up.',
      retry: 'restart engine',
    },
    manifest: {
      tag: 'manifest unreachable',
      body: 'Could not reach the corpus manifest. Check your connection and retry.',
      retry: 'retry',
    },
    corpus: {
      tag: 'download failed',
      body: 'The corpus download did not finish. Nothing partial was kept, retry whenever.',
      retry: 'retry download',
    },
    decompress: {
      tag: 'unpack failed',
      body: 'Your browser could not unpack the corpus stream. Any current Chrome, Edge, Firefox or Safari handles it.',
      retry: 'retry',
    },
    rate: {
      tag: 'rate limited',
      body: 'The free OpenRouter models are catching their breath. Give it a few seconds.',
      retry: 'ask again',
    },
    quota: {
      tag: 'daily limit reached',
      body: 'Your OpenRouter key has spent its free model allowance for today. Retrieval still runs locally so the corpus stays loaded and ready.',
      reset: 'The free pool refills at',
      paid: 'switch to the paid model and spend my own credits',
      retry: 'ask again',
    },
    key: {
      tag: 'key rejected',
      body: 'OpenRouter did not accept that key. Paste a fresh one and reconnect.',
      retry: 'swap key',
    },
    generic: {
      tag: 'hiccup',
      body: 'That one did not go through. Retry in a moment.',
      retry: 'retry',
    },
  },
};

// --- footer ------------------------------------------------------------------
export const footer = {
  tagline: 'Pure Rust and CUDA inference, from the device in your hand to the datacenter rack.',
  license: 'Dual licensed under MIT OR Apache-2.0, at your option.',
  cols: [
    {
      heading: 'Project',
      links: [
        { text: 'GitHub', url: githubUrl },
        { text: 'Blog', url: blogUrl },
        { text: 'Deployment guide', url: guideUrl },
        { text: 'Recipes (SSOT)', url: recipesUrl },
        { text: 'License MIT', url: githubUrl + '/blob/main/LICENSE-MIT' },
        { text: 'License Apache-2.0', url: githubUrl + '/blob/main/LICENSE-APACHE' },
      ],
    },
    {
      heading: 'Community',
      links: [
        { text: 'Discord', url: discordUrl },
        { text: 'Discussions', url: discussionsUrl },
        { text: 'Good first issues', url: goodFirstIssuesUrl },
        { text: 'r/LocalLLaMA', url: redditUrl },
      ],
    },
  ],
};
