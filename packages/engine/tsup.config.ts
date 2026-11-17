import { defineConfig } from "tsup";

// Each module is its own `@audio-ui/engine/<name>` subpath that ships only
// that module.
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
  "repair",
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
