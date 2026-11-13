import { defineConfig } from "tsup";

// Each module is its own `@audio-ui/gl/<name>` subpath that ships only that
// module, so a page that draws a waveform does not load the spectrogram's
// renderer. `gl-waveform` and `gl-spectrogram` stay imports, and are loaded
// when a lane first draws.
const modules = ["lane", "spectrogram", "waveform"];

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
