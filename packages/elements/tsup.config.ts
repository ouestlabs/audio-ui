import { defineConfig } from "tsup";

// One entry per control, so `@audio-ui/elements/<name>` registers and ships
// only that control's elements; what they share is split into common chunks.
const elements = ["fader", "knob", "pad"];

// Declarations are emitted by `tsc -p tsconfig.build.json` (see build:pkg):
// tsup's dts step injects the deprecated `baseUrl` option, which TypeScript 6
// rejects.
export default defineConfig({
  clean: true,
  entry: {
    index: "src/index.ts",
    ...Object.fromEntries(
      elements.map((name) => [name, `src/${name}/index.ts`])
    ),
  },
  format: ["esm"],
  sourcemap: true,
  splitting: true,
});
