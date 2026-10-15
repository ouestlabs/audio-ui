import { defineConfig } from "tsup";

// One entry per primitive, so `@audio-ui/core/<name>` ships only that primitive.
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
    internal: "src/internal.ts",
    ...Object.fromEntries(
      primitives.map((name) => [name, `src/primitives/${name}/index.ts`])
    ),
  },
  format: ["esm"],
  sourcemap: true,
  splitting: true,
});
