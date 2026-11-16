import { createApp, h, nextTick } from "vue";
import { Plot } from "@/registry-audio/bases/base/primitives/plot/vue.ts";
import { plotSuite } from "./plot-suite.ts";

plotSuite("Vue", async (tree) => {
  const container = document.body.appendChild(document.createElement("div"));
  const app = createApp({
    render: () =>
      h(Plot.Root, tree.options, () => [
        tree.grid ? h(Plot.Grid, tree.grid) : null,
        tree.band ? h(Plot.Band, tree.band) : null,
        tree.curve ? h(Plot.Curve, tree.curve) : null,
        tree.line ? h(Plot.Line, tree.line) : null,
        tree.trace ? h(Plot.Trace, tree.trace as never) : null,
        tree.mark ? h(Plot.Mark, tree.mark) : null,
        tree.dot ? h(Plot.Dot, tree.dot as never) : null,
        tree.handle
          ? h(Plot.Handle, { "aria-label": tree.handle.label, ...tree.handle })
          : null,
        tree.cursor
          ? h(Plot.Cursor, null, () =>
              h(Plot.CursorReadout, { format: tree.cursor?.format as never })
            )
          : null,
      ]),
  });
  app.mount(container);
  await nextTick();
  return {
    act: async (interact) => {
      interact();
      await nextTick();
    },
    container,
    unmount: () => {
      app.unmount();
      container.remove();
    },
  };
});
