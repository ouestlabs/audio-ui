import { defineConfig } from "tsup";

// One entry per primitive so `@audio-ui/react/<name>` subpaths ship only that
// primitive; shared internals are split into common chunks.
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

// Declarations are emitted by `tsc -p tsconfig.build.json` (see build:pkg):
// tsup's dts step injects the deprecated `baseUrl` option, which TypeScript 6
// rejects.
export default defineConfig({
  clean: true,
  entry: {
    index: "src/index.ts",
    source: "src/source.ts",
    ...Object.fromEntries(
      primitives.map((name) => [name, `src/entries/${name}.ts`])
    ),
  },
  format: ["esm"],
  sourcemap: true,
  splitting: true,
});
