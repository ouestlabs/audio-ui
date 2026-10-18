import { defineConfig } from "tsup";

// Declarations are emitted by `tsc -p tsconfig.build.json` (see build:pkg):
// tsup's dts step injects the deprecated `baseUrl` option, which TypeScript 6
// rejects.
export default defineConfig({
  clean: true,
  entry: { index: "src/core/index.ts", react: "src/react/index.ts" },
  external: ["react"],
  format: ["esm"],
  sourcemap: true,
  treeshake: true,
});
