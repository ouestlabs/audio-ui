import "@/registry/bases/base/primitives/piano-roll/web/index.ts";
import { flush } from "./helpers.ts";
import { type PianoRollTree, pianoRollSuite } from "./piano-roll-suite.ts";

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

pianoRollSuite("custom elements", async (tree: PianoRollTree) => {
  const container = document.body.appendChild(document.createElement("div"));
  container.innerHTML =
    `<audio-ui-piano-roll ${attributes(tree.options)}>` +
    "<audio-ui-piano-roll-grid>" +
    "<audio-ui-piano-roll-rows></audio-ui-piano-roll-rows>" +
    "<audio-ui-piano-roll-selection-span>" +
    "<audio-ui-piano-roll-stretch-start></audio-ui-piano-roll-stretch-start>" +
    "<audio-ui-piano-roll-stretch-end></audio-ui-piano-roll-stretch-end>" +
    "</audio-ui-piano-roll-selection-span>" +
    "<audio-ui-piano-roll-notes handles></audio-ui-piano-roll-notes>" +
    "<audio-ui-piano-roll-marquee></audio-ui-piano-roll-marquee>" +
    "</audio-ui-piano-roll-grid>" +
    "<audio-ui-piano-roll-velocity-lane></audio-ui-piano-roll-velocity-lane>" +
    "</audio-ui-piano-roll>";
  const root = container.querySelector("audio-ui-piano-roll") as HTMLElement & {
    source?: unknown;
  };
  if (tree.options.source) {
    root.source = tree.options.source;
  }
  const listen = (
    type: string,
    handler: (detail: Record<string, unknown>, event: Event) => void
  ) =>
    root.addEventListener(type, (event) => {
      if (event.target !== root) {
        return;
      }
      handler((event as CustomEvent).detail, event);
    });
  listen("input", (detail, event) =>
    tree.options.onValueChange(detail.value as never, {
      cancel: () => event.preventDefault(),
      reason: detail.reason as string,
    })
  );
  listen("change", (detail) =>
    tree.options.onValueCommitted(detail.value as never, {
      reason: detail.reason as string,
    })
  );
  listen("selectionchange", (detail, event) =>
    tree.options.onSelectionChange(detail.value as never, {
      cancel: () => event.preventDefault(),
      reason: detail.reason as string,
    })
  );
  await flush(4);
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
