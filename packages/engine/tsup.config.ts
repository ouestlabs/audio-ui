import { defineConfig } from "tsup";

// Each module is its own `@audio-ui/engine/<name>` subpath that ships only
// that module. `@audio-ui/core` is a dependency, so it stays an import: the UI
// and the engine share one copy of it.
const modules = [
  "analysis",
  "device",
  "dsp",
  "files",
  "format",
  "kernels",
  "midi",
  "pitch",
  "playback",
  "time",
  "worklet",
];

// Declarations are emitted by `tsc -p tsconfig.build.json` (see build:pkg):
// tsup's dts step injects the deprecated `baseUrl` option, which TypeScript 6
// rejects.
export default defineConfig({
  clean: true,
  entry: Object.fromEntries(
    modules.map((name) => [name, `src/${name}/index.ts`])
  ),
  format: ["esm"],
  sourcemap: true,
  splitting: true,
});
