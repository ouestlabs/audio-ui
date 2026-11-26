import { type BunPlugin, plugin } from "bun";
import { compileScript, parse } from "vue/compiler-sfc";

/**
 * Compiles Vue single-file components as Bun loads them, as Vite's Vue
 * plugin would: the script and its template in one module, the TypeScript
 * stripped. The styled elements of the registry ship as `.vue` files.
 */
const transpiler = new Bun.Transpiler({ loader: "ts" });
const COMPONENT = /\.vue$/;

export const vue: BunPlugin = {
  name: "vue",
  setup(build) {
    build.onLoad({ filter: COMPONENT }, async ({ path }) => {
      const { descriptor } = parse(await Bun.file(path).text(), {
        filename: path,
      });
      const { content } = compileScript(descriptor, {
        id: Bun.hash(path).toString(36),
        inlineTemplate: true,
      });
      return { contents: transpiler.transformSync(content), loader: "js" };
    });
  },
};

plugin(vue);
