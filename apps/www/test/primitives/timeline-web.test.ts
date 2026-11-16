import "@/registry-audio/bases/base/primitives/timeline/web/index.ts";
import { flush } from "./helpers.ts";
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
    (tree.range
      ? `<audio-ui-timeline-range range='${tree.range.range}' default-value='${JSON.stringify(tree.range.defaultValue)}' ${tree.range.drawable ? "drawable" : ""} ${tree.range.label ? `aria-label='${tree.range.label}'` : ""}>` +
        `<audio-ui-timeline-range-start range='${tree.range.range}' aria-label='Loop start'></audio-ui-timeline-range-start>` +
        `<audio-ui-timeline-range-end range='${tree.range.range}' aria-label='Loop end'></audio-ui-timeline-range-end>` +
        "</audio-ui-timeline-range>"
      : "") +
    (tree.clip
      ? `<audio-ui-timeline-clip clip='${tree.clip.clip}' default-value='${JSON.stringify(tree.clip.defaultValue)}' ${tree.clip.label ? `aria-label='${tree.clip.label}'` : ""}>` +
        `<audio-ui-timeline-clip-header clip='${tree.clip.clip}'></audio-ui-timeline-clip-header>` +
        `<audio-ui-timeline-clip-fade-in clip='${tree.clip.clip}'></audio-ui-timeline-clip-fade-in>` +
        `<audio-ui-timeline-clip-fade-out clip='${tree.clip.clip}'></audio-ui-timeline-clip-fade-out>` +
        `<audio-ui-timeline-clip-trim-start clip='${tree.clip.clip}'></audio-ui-timeline-clip-trim-start>` +
        `<audio-ui-timeline-clip-trim-end clip='${tree.clip.clip}'></audio-ui-timeline-clip-trim-end>` +
        `<audio-ui-timeline-clip-fade-in-handle clip='${tree.clip.clip}'></audio-ui-timeline-clip-fade-in-handle>` +
        `<audio-ui-timeline-clip-fade-out-handle clip='${tree.clip.clip}'></audio-ui-timeline-clip-fade-out-handle>` +
        "</audio-ui-timeline-clip>"
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
  container.innerHTML = `<audio-ui-timeline ${attributes(tree.options)}>${tree.navigator ? `<audio-ui-timeline-navigator><audio-ui-timeline-navigator-window ${tree.navigator.label ? `aria-label='${tree.navigator.label}'` : ""}></audio-ui-timeline-navigator-window><audio-ui-timeline-navigator-start aria-label='Zoom start'></audio-ui-timeline-navigator-start><audio-ui-timeline-navigator-end aria-label='Zoom end'></audio-ui-timeline-navigator-end></audio-ui-timeline-navigator>` : ""}<audio-ui-timeline-viewport>${ruler}${lane}${track}</audio-ui-timeline-viewport></audio-ui-timeline>`;
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
  listen("clipchange", (detail, event) =>
    tree.options.onClipChange(detail.value as never, {
      cancel: () => event.preventDefault(),
      clip: detail.clip as string,
      reason: detail.reason as string,
      target: detail.target as string,
    })
  );
  listen("clipselect", (detail) =>
    tree.options.onClipSelectedChange(detail.value as boolean, {
      clip: detail.clip as string,
    })
  );
  listen("clipremove", (detail) =>
    tree.options.onClipRemove(detail.clip as string)
  );
  listen("rangechange", (detail, event) =>
    tree.options.onRangeChange(detail.value as never, {
      cancel: () => event.preventDefault(),
      edge: detail.edge as string,
      range: detail.range as string,
      reason: detail.reason as string,
    })
  );
  listen("markchange", (detail, event) =>
    tree.options.onMarkChange(detail.value as number, {
      cancel: () => event.preventDefault(),
      mark: detail.mark as string,
      reason: detail.reason as string,
    })
  );
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
