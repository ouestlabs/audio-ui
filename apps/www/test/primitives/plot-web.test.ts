import "@/registry-audio/bases/base/primitives/plot/web.ts";
import { flush } from "./helpers.ts";
import { type PlotTree, plotSuite } from "./plot-suite.ts";

const kebab = (name: string) =>
  name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** Values as attributes, as an author writes them: a function or a source is a property. */
function attributes(values: Record<string, unknown>) {
  const written: string[] = [];
  for (const [name, value] of Object.entries(values)) {
    if (
      value === undefined ||
      value === false ||
      typeof value === "function" ||
      (typeof value === "object" && value !== null && "getSnapshot" in value)
    ) {
      continue;
    }
    const text = typeof value === "object" ? JSON.stringify(value) : value;
    written.push(value === true ? kebab(name) : `${kebab(name)}='${text}'`);
  }
  return written.join(" ");
}

plotSuite("custom elements", async (tree: PlotTree) => {
  const container = document.body.appendChild(document.createElement("div"));
  const parts: string[] = [];
  if (tree.grid) {
    parts.push("<audio-ui-plot-grid></audio-ui-plot-grid>");
  }
  if (tree.band) {
    parts.push(
      `<audio-ui-plot-band ${attributes(tree.band)}></audio-ui-plot-band>`
    );
  }
  if (tree.curve) {
    parts.push(
      `<audio-ui-plot-curve ${attributes(tree.curve)}></audio-ui-plot-curve>`
    );
  }
  if (tree.line) {
    parts.push(
      `<audio-ui-plot-line ${attributes(tree.line)}></audio-ui-plot-line>`
    );
  }
  if (tree.trace) {
    parts.push(
      `<audio-ui-plot-trace ${attributes(tree.trace)}></audio-ui-plot-trace>`
    );
  }
  if (tree.mark) {
    parts.push(
      `<audio-ui-plot-mark ${attributes(tree.mark)}></audio-ui-plot-mark>`
    );
  }
  if (tree.dot) {
    parts.push(
      `<audio-ui-plot-dot ${attributes(tree.dot)}></audio-ui-plot-dot>`
    );
  }
  if (tree.handle) {
    const { label, ...handle } = tree.handle;
    parts.push(
      `<audio-ui-plot-handle ${attributes(handle)} ${label ? `aria-label="${label}"` : ""}></audio-ui-plot-handle>`
    );
  }
  if (tree.cursor) {
    parts.push(
      "<audio-ui-plot-cursor><audio-ui-plot-cursor-readout></audio-ui-plot-cursor-readout></audio-ui-plot-cursor>"
    );
  }
  container.innerHTML = `<audio-ui-plot ${attributes(tree.options)}>${parts.join("")}</audio-ui-plot>`;
  const find = <T extends HTMLElement>(tag: string) =>
    container.querySelector(tag) as (T & Record<string, unknown>) | null;
  // What cannot be an attribute is set as a property.
  const curve = find("audio-ui-plot-curve");
  if (curve && tree.curve) {
    curve.fn = tree.curve.fn;
  }
  const trace = find("audio-ui-plot-trace");
  if (trace && tree.trace) {
    trace.source = tree.trace.source;
  }
  const dot = find("audio-ui-plot-dot");
  if (dot && tree.dot?.source) {
    dot.source = tree.dot.source;
  }
  const grid = find("audio-ui-plot-grid");
  if (grid && tree.grid) {
    grid.x = tree.grid.x;
    grid.y = tree.grid.y;
  }
  const readout = find("audio-ui-plot-cursor-readout");
  if (readout && tree.cursor) {
    readout.format = tree.cursor.format;
  }
  const plot = container.querySelector("audio-ui-plot") as HTMLElement;
  // The callbacks are the plot's events, a cancel its preventDefault().
  plot.addEventListener("input", (event) => {
    const { detail } = event as Event as CustomEvent<{
      handle: string;
      reason: string;
      value: { x: number; y: number };
    }>;
    tree.options.onValueChange(detail.value, {
      cancel: () => event.preventDefault(),
      handle: detail.handle,
      reason: detail.reason,
    });
  });
  plot.addEventListener("change", (event) => {
    const { detail } = event as Event as CustomEvent<{
      reason: string;
      value: { x: number; y: number };
    }>;
    tree.options.onValueCommitted(detail.value, { reason: detail.reason });
  });
  await flush(3);
  return {
    act: async (interact) => {
      interact();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
    container,
    unmount: () => container.remove(),
  };
});
