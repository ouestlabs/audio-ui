import "@/registry-audio/bases/base/primitives/timeline/web.ts";
import { type TimelineTree, timelineSuite } from "./timeline-suite.ts";

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

timelineSuite("custom elements", async (tree: TimelineTree) => {
  const container = document.body.appendChild(document.createElement("div"));
  const inner =
    (tree.playhead
      ? "<audio-ui-timeline-playhead></audio-ui-timeline-playhead>"
      : "") +
    (tree.mark
      ? `<audio-ui-timeline-mark ${attributes(tree.mark)}></audio-ui-timeline-mark>`
      : "");
  const ruler = tree.ruler
    ? `<audio-ui-timeline-ruler ${tree.ruler.label ? `aria-label='${tree.ruler.label}'` : ""}>${tree.lane ? "" : inner}</audio-ui-timeline-ruler>`
    : "";
  const lane = tree.lane
    ? `<audio-ui-timeline-lane ${attributes(tree.lane)}>${inner}</audio-ui-timeline-lane>`
    : "";
  const track = tree.track
    ? `<audio-ui-timeline-track track='${tree.track.track}' ${tree.track.height ? `height='${tree.track.height}'` : ""}>` +
      `<audio-ui-timeline-track-resize-handle track='${tree.track.track}' ${tree.track.label ? `aria-label='${tree.track.label}'` : ""}></audio-ui-timeline-track-resize-handle>` +
      "</audio-ui-timeline-track>"
    : "";
  container.innerHTML = `<audio-ui-timeline ${attributes(tree.options)}><audio-ui-timeline-viewport>${ruler}${lane}${track}</audio-ui-timeline-viewport></audio-ui-timeline>`;
  const root = container.querySelector("audio-ui-timeline") as HTMLElement & {
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
    tree.options.onPositionChange(detail.value as number, {
      cancel: () => event.preventDefault(),
      reason: detail.reason as string,
      source: detail.source as string,
    })
  );
  listen("change", (detail) =>
    tree.options.onPositionCommitted(detail.value as number, {
      reason: detail.reason as string,
    })
  );
  listen("zoomchange", (detail, event) =>
    tree.options.onZoomChange(detail.value as number, {
      cancel: () => event.preventDefault(),
      reason: detail.reason as string,
    })
  );
  listen("selectionchange", (detail, event) =>
    tree.options.onSelectionChange(detail.value as number[], {
      cancel: () => event.preventDefault(),
      reason: detail.reason as string,
    })
  );
  listen("trackheightchange", (detail, event) =>
    tree.options.onTrackHeightChange(detail.value as number | undefined, {
      cancel: () => event.preventDefault(),
      reason: detail.reason as string,
      track: detail.track as string,
    })
  );
  listen("markchange", (detail, event) =>
    tree.options.onMarkChange(detail.value as number, {
      cancel: () => event.preventDefault(),
      mark: detail.mark as string,
      reason: detail.reason as string,
    })
  );
  for (let tick = 0; tick < 3; tick += 1) {
    await Promise.resolve();
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
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
