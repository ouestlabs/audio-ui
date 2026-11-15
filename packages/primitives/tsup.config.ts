import { defineConfig } from "tsup";

// Declarations come from `tsc -p tsconfig.build.json`, as in core.
export default defineConfig({
  clean: true,
  entry: { index: "src/index.ts", knob: "src/knob/index.ts" },
  external: ["@audio-ui/core", "@ui-sdk/core"],
  format: ["esm"],
  sourcemap: true,
  splitting: true,
});
