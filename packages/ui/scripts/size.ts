/**
 * What each entry costs a consumer: its built file bundled and minified, with
 * React left out, gzipped. Fails when one grows past its budget,
 * so a primitive cannot get heavier without somebody deciding it should.
 * Run `bun run build:pkg` first.
 */
/** Gzipped bytes. About 15% above what each weighs today, rendering and props merging included since they are ours. */
const BUDGETS: Record<string, number> = {
  envelope: 7200,
  fader: 6000,
  knob: 6400,
  meter: 4000,
  pad: 3800,
  piano: 4000,
  "piano-roll": 13_600,
  plot: 7100,
  sequencer: 5300,
  timeline: 15_400,
  waveform: 11_600,
  xypad: 4900,
};

const dist = `${import.meta.dir}/../dist`;
let failed = false;

for (const [entry, budget] of Object.entries(BUDGETS)) {
  // One at a time: bundling in parallel makes the sizes no different, only the log harder to read.
  // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose
  const result = await Bun.build({
    entrypoints: [`${dist}/${entry}.js`],
    external: ["react", "react-dom", "react/jsx-runtime"],
    minify: true,
    target: "browser",
  });
  const [output] = result.outputs;
  if (!(result.success && output)) {
    console.error(`${entry}: could not be bundled`);
    failed = true;
    continue;
  }
  const size = Bun.gzipSync(new Uint8Array(await output.arrayBuffer())).length;
  const over = size > budget;
  failed ||= over;
  console.log(
    `${over ? "FAIL" : "ok  "} ${entry.padEnd(11)} ${String(size).padStart(6)} B of ${budget}`
  );
}

process.exit(failed ? 1 : 0);
