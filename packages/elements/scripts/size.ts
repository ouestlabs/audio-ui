/**
 * What each entry costs a consumer: its built file bundled and minified,
 * gzipped, `@audio-ui/core` included. Fails when one grows past its budget,
 * so an element cannot get heavier without somebody deciding it should.
 * Run `bun run build:pkg` first.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";

/** Gzipped bytes. About 15% above what each weighs today. */
const BUDGETS: Record<string, number> = {
  envelope: 9000,
  fader: 5300,
  index: 71_000,
  knob: 6000,
  meter: 4200,
  pad: 3500,
  piano: 4700,
  "piano-roll": 33_500,
  plot: 8500,
  sequencer: 6000,
  timeline: 19_000,
  waveform: 13_300,
  xypad: 5300,
};

const dist = `${import.meta.dir}/../dist`;
let failed = false;

const primitives = Object.keys(BUDGETS).filter((entry) => entry !== "index");

/** The elements an entry registers when imported for its side effect: its root, every root for the package root, and for the piano roll the timeline and piano it is composed of. */
const REGISTERS: Record<string, readonly string[]> = {
  index: primitives.map((entry) => `audio-ui-${entry}`),
  "piano-roll": [
    "audio-ui-piano-roll",
    "audio-ui-timeline-viewport",
    "audio-ui-piano-key",
  ],
};

/**
 * The elements a page that imports `entry` only for its side effect, as
 * `import "@audio-ui/elements/knob"` does, fails to register once a bundler
 * has dropped the code it thinks is unused: what `sideEffects` in
 * package.json decides. The bundle runs in a window of its own, so an entry
 * checked before cannot register them in its place.
 */
async function unregistered(entry: string): Promise<string[]> {
  const page = `${dist}/.registers-${entry}.js`;
  const bundled = `${dist}/.registered-${entry}.js`;
  await Bun.write(page, `import "./${entry}.js";\n`);
  const result = await Bun.build({
    entrypoints: [page],
    minify: true,
    target: "browser",
  });
  await Bun.file(page).delete();
  const [output] = result.outputs;
  const tags = REGISTERS[entry] ?? [`audio-ui-${entry}`];
  if (!(result.success && output)) {
    return [...tags];
  }
  await Bun.write(bundled, output);
  GlobalRegistrator.register();
  try {
    // A query of its own, so each window runs the bundle afresh.
    await import(`${Bun.pathToFileURL(bundled).href}?${entry}`);
    return tags.filter((tag) => !customElements.get(tag));
  } finally {
    await GlobalRegistrator.unregister();
    await Bun.file(bundled).delete();
  }
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
  const missing = await unregistered(entry);
  if (missing.length > 0) {
    console.error(
      `FAIL ${entry}: imported for its side effect, it does not register ${missing.map((tag) => `<${tag}>`).join(", ")}`
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
