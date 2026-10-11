/**
 * What each entry costs a consumer: its built file bundled and minified, with
 * React and Base UI left out, gzipped. Fails when one grows past its budget,
 * so a primitive cannot get heavier without somebody deciding it should.
 * Run `bun run build:pkg` first.
 */
import { resolve } from "node:path";

/** Gzipped bytes. About 15% above what each weighs today. */
const BUDGETS: Record<string, number> = {
  envelope: 6500,
  fader: 3500,
  knob: 5800,
  meter: 3300,
  piano: 3300,
  "piano-roll": 13_000,
  plot: 6500,
  sequencer: 4700,
  timeline: 13_500,
  waveform: 11_000,
  xypad: 4300,
};

const dist = resolve(import.meta.dirname, "../dist");
let failed = false;

for (const [entry, budget] of Object.entries(BUDGETS)) {
  // One at a time: bundling in parallel makes the sizes no different, only the log harder to read.
  // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose
  const result = await Bun.build({
    entrypoints: [`${dist}/${entry}.js`],
    external: ["react", "react-dom", "react/jsx-runtime", "@base-ui/*"],
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
