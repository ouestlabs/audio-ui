/**
 * What each entry costs a consumer: its built file bundled and minified,
 * gzipped, `@audio-ui/core` included. Fails when one grows past its budget,
 * so an element cannot get heavier without somebody deciding it should.
 * Run `bun run build:pkg` first.
 */
/** Gzipped bytes. About 15% above what each weighs today. */
const BUDGETS: Record<string, number> = {
  fader: 5300,
  index: 21_500,
  knob: 6000,
  meter: 4200,
  pad: 3500,
  piano: 4700,
  sequencer: 6000,
  xypad: 5300,
};

const dist = `${import.meta.dir}/../dist`;
let failed = false;

/**
 * Whether a page that imports `entry` only for its side effect, as
 * `import "@audio-ui/elements/knob"` does, still registers the elements once
 * a bundler has dropped the code it thinks is unused: what `sideEffects` in
 * package.json decides.
 */
async function registers(entry: string, tag: string) {
  const page = `${dist}/.registers-${entry}.js`;
  await Bun.write(page, `import "./${entry}.js";\n`);
  const result = await Bun.build({
    entrypoints: [page],
    minify: true,
    target: "browser",
  });
  await Bun.file(page).delete();
  const [output] = result.outputs;
  return Boolean(
    result.success && output && (await output.text()).includes(tag)
  );
}

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
  const tag = entry === "index" ? "audio-ui-knob" : `audio-ui-${entry}`;
  if (!(await registers(entry, tag))) {
    console.error(
      `FAIL ${entry}: imported for its side effect, it registers no <${tag}>`
    );
    failed = true;
  }
  const size = Bun.gzipSync(new Uint8Array(await output.arrayBuffer())).length;
  const over = size > budget;
  failed ||= over;
  console.log(
    `${over ? "FAIL" : "ok  "} ${entry.padEnd(11)} ${String(size).padStart(6)} B of ${budget}`
  );
}

process.exit(failed ? 1 : 0);
