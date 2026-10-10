import { defineConfig } from "tsup";

// One entry per primitive so `@audio-ui/react/<name>` subpaths ship only that
// primitive; shared internals are split into common chunks.
const primitives = [
  "envelope",
  "fader",
  "knob",
  "meter",
  "piano",
  "piano-roll",
  "ruler",
  "sequencer",
  "waveform",
  "xypad",
];

// Declarations are emitted by `tsc -p tsconfig.build.json` (see build:pkg):
// tsup's dts step injects the deprecated `baseUrl` option, which TypeScript 6
// rejects.
export default defineConfig({
  clean: true,
  entry: [
    "src/index.ts",
    "src/source.ts",
    ...primitives.map((name) => `src/${name}.ts`),
  ],
  format: ["esm"],
  sourcemap: true,
  splitting: true,
});
