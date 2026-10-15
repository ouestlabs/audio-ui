import { defineConfig } from "tsup";

// Two kinds of entry, each its own `@audio-ui/core/<name>` subpath that ships
// only that module:
// - primitives/<name>: the logic of a UI primitive (a knob, a timeline...).
// - audio/<name>: audio and music logic with no UI in it (pitch, MIDI...).
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
const audio = ["analysis", "midi", "pitch", "time"];

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
    ...Object.fromEntries(
      audio.map((name) => [name, `src/audio/${name}/index.ts`])
    ),
  },
  format: ["esm"],
  sourcemap: true,
  splitting: true,
});
