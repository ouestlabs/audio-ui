/**
 * Fails when an entry, imported only for its side effect as
 * `import "@audio-ui/elements/knob"` is, registers none of its elements once
 * a bundler has dropped the code it thinks is unused: what `sideEffects` in
 * package.json decides. Run `bun run build:pkg` first.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";

const dist = `${import.meta.dir}/../dist`;

const primitives = [
  "envelope",
  "fader",
  "knob",
  "meter",
  "pad",
  "piano",
  "piano-roll",
  "plot",
  "sequencer",
  "timeline",
  "waveform",
  "xypad",
];

/** The elements an entry registers when imported for its side effect: its root, every root for the package root, and for the piano roll the timeline and piano it is composed of. */
const REGISTERS: Record<string, readonly string[]> = {
  index: primitives.map((entry) => `audio-ui-${entry}`),
  "piano-roll": [
    "audio-ui-piano-roll",
    "audio-ui-timeline-viewport",
    "audio-ui-piano-key",
  ],
};

/** The elements `entry`, bundled and minified, fails to register. The bundle runs in a window of its own, so an entry checked before cannot register them in its place. */
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

let failed = false;
// One at a time: each entry runs in the one global window, registered and unregistered in turn.
await ["index", ...primitives].reduce(
  (previous, entry) =>
    previous.then(async () => {
      const missing = await unregistered(entry);
      failed ||= missing.length > 0;
      console.log(
        missing.length > 0
          ? `FAIL ${entry}: imported for its side effect, it does not register ${missing.map((tag) => `<${tag}>`).join(", ")}`
          : `ok   ${entry}`
      );
    }),
  Promise.resolve()
);

process.exit(failed ? 1 : 0);
