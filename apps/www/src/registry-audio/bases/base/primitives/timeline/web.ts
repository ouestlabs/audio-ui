import { timeline } from "@audio-ui/primitives/timeline";
import { createParts } from "@ui-sdk/web";

/** Adds the part `tag` holding a native input to `owner`, with the names the owner was given. */
function addInput(owner: HTMLElement, tag: string, track?: string | null) {
  if (owner.querySelector("input")) {
    return;
  }
  const part = document.createElement(tag);
  if (track) {
    part.setAttribute("track", track);
  }
  const input = document.createElement("input");
  for (const name of [
    "aria-describedby",
    "aria-label",
    "aria-labelledby",
  ] as const) {
    const value = owner.getAttribute(name);
    if (value !== null) {
      input.setAttribute(name, value);
      owner.removeAttribute(name);
    }
  }
  for (const type of ["input", "change"]) {
    input.addEventListener(type, (event) => event.stopPropagation());
  }
  part.appendChild(input);
  owner.appendChild(part);
}

/** A mark that is not named takes its value for a name. */
function nameMark(mark: HTMLElement) {
  if (!mark.hasAttribute("mark")) {
    mark.setAttribute("mark", mark.getAttribute("value") ?? "");
  }
}

const numberAttribute = (value: string | null) =>
  value === null ? undefined : Number(value);

const jsonAttribute = (value: string | null) =>
  value ? JSON.parse(value) : undefined;

/**
 * The whole web adapter of the timeline: a tag for each part. The ruler and a
 * track's resize handle make the input they hold themselves.
 */
export const parts = createParts(timeline, {
  lane: { display: "block", tag: "audio-ui-timeline-lane" },
  mark: {
    display: "block",
    render: nameMark,
    tag: "audio-ui-timeline-mark",
  },
  playhead: { display: "block", tag: "audio-ui-timeline-playhead" },
  root: {
    display: "block",
    events: {
      onMarkChange: "markchange",
      onMarkCommitted: "markcommit",
      onPositionChange: "input",
      onPositionCommitted: "change",
      onSelectionChange: "selectionchange",
      onSelectionCommitted: "selectioncommit",
      onTrackHeightChange: "trackheightchange",
      onTrackHeightCommitted: "trackheightcommit",
      onZoomChange: "zoomchange",
    },
    kinds: {
      defaultZoom: numberAttribute,
      snapPoints: jsonAttribute,
      zoom: numberAttribute,
    },
    // A live position is set as a property: it is a source, not an attribute.
    properties: ["source"],
    tag: "audio-ui-timeline",
  },
  ruler: {
    display: "block",
    render: (ruler: HTMLElement) =>
      addInput(ruler, "audio-ui-timeline-ruler-input"),
    tag: "audio-ui-timeline-ruler",
  },
  rulerInput: {
    display: "contents",
    properties: ["getAriaValueText"],
    tag: "audio-ui-timeline-ruler-input",
    target: (el) => el.querySelector("input"),
  },
  track: { display: "flex", tag: "audio-ui-timeline-track" },
  trackHeader: { display: "block", tag: "audio-ui-timeline-track-header" },
  trackResizeHandle: {
    display: "block",
    render: (handle: HTMLElement) =>
      addInput(
        handle,
        "audio-ui-timeline-track-resize-input",
        handle.getAttribute("track")
      ),
    tag: "audio-ui-timeline-track-resize-handle",
  },
  trackResizeInput: {
    display: "contents",
    tag: "audio-ui-timeline-track-resize-input",
    target: (el) => el.querySelector("input"),
  },
  viewport: { display: "block", tag: "audio-ui-timeline-viewport" },
});
