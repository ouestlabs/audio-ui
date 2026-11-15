import { defineConfig } from "tsup";

// Declarations come from `tsc -p tsconfig.build.json`, as in core.
export default defineConfig({
  clean: true,
  entry: {
    plot: "src/plot/index.ts",
    waveform: "src/waveform/index.ts",
    sequencer: "src/sequencer/index.ts",
    piano: "src/piano/index.ts",
    pad: "src/pad/index.ts",
    envelope: "src/envelope/index.ts",
    fader: "src/fader/index.ts",
    index: "src/index.ts",
    knob: "src/knob/index.ts",
    meter: "src/meter/index.ts",
    xypad: "src/xypad/index.ts",
  },
  external: ["@audio-ui/core", "@ui-sdk/core"],
  format: ["esm"],
  sourcemap: true,
  splitting: true,
});
