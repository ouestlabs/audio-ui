import { type BunPlugin, plugin } from "bun";
import { compile, compileModule } from "svelte/compiler";

/**
 * Compiles Svelte components and rune modules as Bun loads them, as a
 * Svelte bundler would: UI SDK's Svelte package ships them as source. They
 * run in the browser build of Svelte, so the tests run with the `browser`
 * condition, or for the server with `SVELTE_GENERATE=server` and without it.
 */
const transpiler = new Bun.Transpiler({ loader: "ts" });
const COMPONENT = /\.svelte$/;
const RUNES_MODULE = /\.svelte\.(js|ts)$/;
const generate = process.env.SVELTE_GENERATE === "server" ? "server" : "client";

export const svelte: BunPlugin = {
  name: "svelte",
  setup(build) {
    build.onLoad({ filter: COMPONENT }, async ({ path }) => {
      const { js } = compile(await Bun.file(path).text(), {
        filename: path,
        generate,
      });
      return { contents: js.code, loader: "js" };
    });
    build.onLoad({ filter: RUNES_MODULE }, async ({ path }) => {
      const source = await Bun.file(path).text();
      const { js } = compileModule(
        path.endsWith(".ts") ? transpiler.transformSync(source) : source,
        { filename: path, generate }
      );
      return { contents: js.code, loader: "js" };
    });
  },
};

plugin(svelte);
