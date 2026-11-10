/**
 * What each entry costs a consumer: its built file bundled and minified,
 * gzipped, `@audio-ui/core` included. Fails when one grows past its budget,
 * so an element cannot get heavier without somebody deciding it should.
 * Run `bun run build:pkg` first.
 */
/** Gzipped bytes. About 15% above what each weighs today. */
const BUDGETS: Record<string, number> = {
  fader: 5300,
  index: 8200,
  knob: 6000,
};

const dist = `${import.meta.dir}/../dist`;
let failed = false;

for (const [entry, budget] of Object.entries(BUDGETS)) {
  // One at a time: bundling in parallel makes the sizes no different, only the log harder to read.
  // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose
  const result = await Bun.build({
    entrypoints: [`${dist}/${entry}.js`],
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
