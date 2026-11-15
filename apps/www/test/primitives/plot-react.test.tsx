import { act } from "react";
import { createRoot } from "react-dom/client";
import { Plot } from "@/registry-audio/bases/base/primitives/plot/react.tsx";
import { plotSuite } from "./plot-suite.ts";

plotSuite("React", async (tree) => {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  await act(() => {
    root.render(
      <Plot.Root {...tree.options}>
        {tree.grid ? <Plot.Grid {...tree.grid} /> : null}
        {tree.band ? <Plot.Band {...tree.band} /> : null}
        {tree.curve ? <Plot.Curve {...tree.curve} /> : null}
        {tree.line ? <Plot.Line {...tree.line} /> : null}
        {tree.trace ? <Plot.Trace {...(tree.trace as never as { source: never })} /> : null}
        {tree.mark ? <Plot.Mark {...tree.mark} /> : null}
        {tree.dot ? <Plot.Dot {...(tree.dot as object)} /> : null}
        {tree.handle ? (
          <Plot.Handle aria-label={tree.handle.label} {...tree.handle} />
        ) : null}
        {tree.cursor ? (
          <Plot.Cursor>
            <Plot.CursorReadout format={tree.cursor.format} />
          </Plot.Cursor>
        ) : null}
      </Plot.Root>
    );
  });
  return {
    act: async (interact) => {
      await act(() => {
        interact();
      });
    },
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
});
