import "@/registry-audio/bases/base/primitives/waveform/web/index.ts";
import { flush } from "./helpers.ts";
import { type WaveformTree, waveformSuite } from "./waveform-suite.ts";

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

waveformSuite("custom elements", async (tree: WaveformTree) => {
  const container = document.body.appendChild(document.createElement("div"));
  const parts: string[] = [];
  if (tree.control) {
    parts.push(
      `<audio-ui-waveform-control ${attributes({ ariaLabel: tree.control.label })}></audio-ui-waveform-control>`
    );
  }
  if (tree.playhead) {
    parts.push("<audio-ui-waveform-playhead></audio-ui-waveform-playhead>");
  }
  if (tree.thumb) {
    parts.push("<audio-ui-waveform-thumb></audio-ui-waveform-thumb>");
  }
  if (tree.marker) {
    parts.push(
      `<audio-ui-waveform-marker ${attributes(tree.marker)}></audio-ui-waveform-marker>`
    );
  }
  if (tree.hover) {
    parts.push("<audio-ui-waveform-hover></audio-ui-waveform-hover>");
  }
  if (tree.bars) {
    parts.push(
      `<audio-ui-waveform-bars ${attributes(tree.bars)}></audio-ui-waveform-bars>`
    );
  }
  if (tree.canvas) {
    parts.push("<audio-ui-waveform-canvas></audio-ui-waveform-canvas>");
  }
  if (tree.region) {
    const { label, ...region } = tree.region;
    const name = (edge: string) =>
      label ? `aria-label='${label} ${edge}'` : "";
    parts.push(
      `<audio-ui-waveform-region ${attributes(region)}>` +
        `<audio-ui-waveform-region-start region='${region.region}' ${name("start")}></audio-ui-waveform-region-start>` +
        `<audio-ui-waveform-region-end region='${region.region}' ${name("end")}></audio-ui-waveform-region-end>` +
        "</audio-ui-waveform-region>"
    );
  }
  container.innerHTML = `<audio-ui-waveform ${attributes(tree.options)}>${parts.join("")}</audio-ui-waveform>`;
  const find = (tag: string) =>
    container.querySelector(tag) as
      | (HTMLElement & Record<string, unknown>)
      | null;
  const root = find("audio-ui-waveform") as HTMLElement & {
    levels?: unknown;
    source?: unknown;
  };
  if (tree.options.source) {
    root.source = tree.options.source;
  }
  if (tree.options.levels) {
    root.levels = tree.options.levels;
  }
  const hover = find("audio-ui-waveform-hover");
  if (hover && tree.hover) {
    hover.format = tree.hover.format;
  }
  root.addEventListener("input", (event) => {
    if (event.target !== root) {
      return;
    }
    const { detail } = event as Event as CustomEvent<{
      reason: string;
      source?: string;
      value: number;
    }>;
    tree.options.onValueChange(detail.value, {
      cancel: () => event.preventDefault(),
      reason: detail.reason,
      source: detail.source,
    });
  });
  root.addEventListener("change", (event) => {
    if (event.target !== root) {
      return;
    }
    const { detail } = event as Event as CustomEvent<{
      reason: string;
      value: number;
    }>;
    tree.options.onValueCommitted(detail.value, { reason: detail.reason });
  });
  root.addEventListener("regionchange", (event) => {
    const { detail } = event as Event as CustomEvent<{
      edge: string;
      reason: string;
      region: string;
      value: number[];
    }>;
    tree.options.onRegionChange(detail.value, {
      cancel: () => event.preventDefault(),
      edge: detail.edge,
      reason: detail.reason,
      region: detail.region,
    });
  });
  root.addEventListener("regioncommit", (event) => {
    const { detail } = event as Event as CustomEvent<{
      edge: string;
      reason: string;
      region: string;
      value: number[];
    }>;
    tree.options.onRegionCommitted(detail.value, {
      cancel: () => undefined,
      edge: detail.edge,
      reason: detail.reason,
      region: detail.region,
    });
  });
  root.addEventListener("selectionchange", (event) => {
    const { detail } = event as Event as CustomEvent<{
      reason: string;
      value: number[];
    }>;
    tree.options.onSelectionChange(detail.value, {
      cancel: () => event.preventDefault(),
      reason: detail.reason,
    });
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
