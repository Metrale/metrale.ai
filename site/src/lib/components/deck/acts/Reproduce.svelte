<script>
  import { ENGINE_REPO } from '$shared/sources.mjs';
  // Act II — the reference frame and the walkthrough: fingerprint and parity,
  // then the steps that get an outsider from a bare box to the published
  // ladder. The commands are the ones in bench/ladder38/RESULTS.md, not a
  // simplified retelling: a reproduction that needs a translation step is not
  // one. Every value in a command that the record carries is read from it.
  import Slide from '../Slide.svelte';
  import Cmd from '../Cmd.svelte';
  import Kv from '../Kv.svelte';
  import { claim, fingerprint, parity, serve, serveKnobs } from '$lib/deck/content.js';
</script>

<Slide
  eyebrow="Reference"
  title="The fingerprint, and every axis pinned on both engines"
  lede="Six lines decide whether anything after them is comparable; ten pins are what make the comparison fair. If your box differs on any of them you are measuring something else — fine, but say so."
>
  <div class="dk-cols dk-cols-even">
    <div>
      <p class="dk-card-h">Fingerprint</p>
      <Kv rows={fingerprint} />
    </div>
    <div>
      <p class="dk-card-h">Parity — driven by one script, not two</p>
      <Kv rows={parity} mark />
      <p class="dk-note">
        vLLM at its best, not its defaults: {claim.baselineVersion} registers this checkpoint's MTP weights, so the baseline runs
        {claim.baselineSpeculation}. The no-speculation leg is published beside it and is not what we claim against.
      </p>
    </div>
  </div>
</Slide>

<Slide
  eyebrow="Steps 1 and 2"
  title="Prove the box, then build both artefacts"
  lede="Every check here has been the reason a run was thrown away in this campaign. The container serves models; the binary measures them. You need both, from the tree the record names."
>
  <div class="dk-cols dk-cols-even">
    <Cmd
      label="1 · preflight"
      lines={[
        `nvidia-smi                       # GB10, driver 580+`,
        `free -g                          # ~121 GB unified, not nvidia-smi`,
        ``,
        `export PATH=/usr/local/cuda/bin:$PATH`,
        `nvcc --version                   # must report CUDA 13.0`,
        ``,
        `docker run --rm --gpus all \\`,
        `  nvidia/cuda:13.0.0-base-ubuntu24.04 nvidia-smi`,
        `df -h ~/.cache/huggingface       # weights land here, tens of GB`,
      ]}
      note="nvidia-smi reports memory as Not Supported on GB10: the 121 GB is a unified pool, so free is the instrument. CUDA ships outside PATH; without the export the cargo build dies in a build script rather than anywhere informative. The docker line proves the NVIDIA Container Toolkit is wired up, not just installed. Measure on an idle box: the gate refuses to self-start below 85% free host memory and tolerates at most one foreign compute process."
    />
    <div class="stack">
      <Cmd
        label="2 · clone, image, binary"
        lines={[
          `git clone ${ENGINE_REPO}.git metrale-engine`,
          `cd metrale-engine`,
          ``,
          `docker build -f docker/gb10/Dockerfile -t metrale-gb10 .`,
          ``,
          `sudo apt-get install -y build-essential pkg-config \\`,
          `  cmake clang libclang-dev`,
          `cargo build --release -p metrale-server --bin met`,
          ``,
          `./target/release/met --version`,
          `./target/release/met benchmark list concurrency-sweep`,
          `./target/release/met sync-recipes`,
        ]}
        note="Both builds run from the repository root with CUDA on PATH from Step 1. The first cargo build takes 15–30 minutes and leaves 3–5 GB under target/. Every record under .benchmarks/ names the commit it measured as git_sha, with a .sig beside it; check that commit out to rebuild the exact tree. The list line prints every parameter of the sweep with its default, the schema the next steps override; if it prints, the toolchain is sound. sync-recipes populates the recipe index the gate's self-start reads in Step 6."
      />
    </div>
  </div>
</Slide>

<Slide
  eyebrow="Steps 3 and 4"
  title="Bring up both legs"
  lede="Same box, same checkpoint, same client, back to back. The baseline is pinned by digest, not by tag; the subject is the whole certified configuration, rendered from the record the harness wrote."
>
  <div class="dk-cols dk-cols-even">
    <Cmd
      label="3 · baseline: {claim.baseline}, fp8 KV"
      lines={[
        `docker run --rm --gpus all --network host \\`,
        `  ${claim.baselineImage.split(':')[0]}@${claim.baselineDigest} \\`,
        `  --model ${claim.checkpoint} \\`,
        `  --max-model-len 2048 --max-num-seqs 128 \\`,
        `  --gpu-memory-utilization 0.85 \\`,
        `  --kv-cache-dtype fp8 --enable-prefix-caching \\`,
        `  --speculative-config '{"method":"mtp","num_speculative_tokens":3}'`,
      ]}
      note="num_speculative_tokens 3 is K=4, the same draft width the subject runs. Context 2048 and batch cap 128 are the pinned pair; changing either invalidates the comparison in both directions. The cap is load-bearing: vLLM sizes its KV blocks and scheduler budget from max_num_seqs, and a cap-32 pair inverted the ordering on the same box the same day (RESULTS.md, method note)."
    />
    <Cmd
      label="4 · subject: {claim.engine}, complete"
      lines={[...serve.env.map((l) => `${l} \\`), ...serve.cli.map((l, i, a) => (i < a.length - 1 ? `${l} \\` : l))]}
      note={`Do not trim this. ${serveKnobs.length} of these flags (${serveKnobs.join(', ')}) are kernel and scheduling knobs whose defaults are the opposite of the certified values; serving without them measures a different engine. An abridged command run in this campaign landed under the published ladder, the gap widening with concurrency exactly as those knobs predict. With the full command the same box reproduced every rung.`}
    />
  </div>
</Slide>

<Slide
  eyebrow="Step 5"
  title="Measure: the chart's own driver, then the gate's instrument"
  lede="Two instruments, not interchangeable. The campaign driver produced every number on the result slide; the gate's subcommand measures the gate's workload and is the only one that can mint a record."
>
  <div class="dk-cols">
    <Cmd
      label="5a · the published ladder, {claim.engine} leg"
      lines={[
        `python3 -m venv .venv && .venv/bin/pip install aiohttp`,
        ``,
        `.venv/bin/python ${claim.harnessFile} \\`,
        `  --url http://127.0.0.1:8888 --model ${claim.checkpoint} \\`,
        `  --label metrale --out metrale_ladder.json \\`,
        `  --concs ${claim.concsArg} \\`,
        `  --reps ${claim.reps} --isl ${claim.isl} --osl ${claim.osl} --warmup ${claim.warmup}`,
      ]}
      note={`Every knob is a required argument; the driver defaults nothing silently, so the command is the methodology. Swap --url and --label for the vLLM leg and run them back to back. Budget about an hour per leg: C=${claim.last} alone streams ${claim.last * claim.osl} tokens per rep. The driver prints its sha256 on the first line and writes it as driver_sha256; the published engine legs carry ${claim.harnessShaEngine} and the copy in the repository today hashes ${claim.harnessShaRepo}. Record the hash you ran.`}
    />
    <Cmd
      label="5b · the gate's instrument, both endpoints"
      lines={[
        `met benchmark run concurrency-sweep \\`,
        `  --url http://127.0.0.1:8000 --model ${claim.checkpoint} \\`,
        `  --param concurrencies=1,4,8,16 --param isls=512 --param osl=320 \\`,
        `  --skip-coherence-probe --format json > vllm.json`,
        `met benchmark run concurrency-sweep \\`,
        `  --url http://127.0.0.1:8888 --model ${claim.checkpoint} \\`,
        `  --param concurrencies=1,4,8,16 --param isls=512 --param osl=320 \\`,
        `  --format json > metrale.json`,
      ]}
      note="Drives an endpoint that is already serving; it neither loads a model nor touches the GPU, so the binary that gates our pull requests is the binary that measures vLLM. stdout carries the record and stderr the progress. The prompt corpus is byte-identical to the driver's, so aggregate tok/s is comparable across the two; percentile rules are not, so never compare one instrument's TTFT against the other's."
    />
  </div>
</Slide>

<style>
  .stack {
    display: grid;
    gap: 1rem;
    min-width: 0;
  }
</style>
