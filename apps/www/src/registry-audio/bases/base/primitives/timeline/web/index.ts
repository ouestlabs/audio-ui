import {
  type FadeShape,
  fadeGain,
  timeline,
} from "@audio-ui/primitives/timeline";
import { createParts } from "@ui-sdk/web";

/** Adds the part `tag` holding a native input to `owner`, with the names the owner was given. */
function addInput(
  owner: HTMLElement,
  tag: string,
  name?: string | null,
  by = "track"
) {
  if (owner.querySelector("input")) {
    return;
  }
  const part = document.createElement(tag);
  if (name) {
    part.setAttribute(by, name);
  }
  const input = document.createElement("input");
  for (const attribute of [
    "aria-describedby",
    "aria-label",
    "aria-labelledby",
  ] as const) {
    const value = owner.getAttribute(attribute);
    if (value !== null) {
      input.setAttribute(attribute, value);
      owner.removeAttribute(attribute);
    }
  }
  for (const type of ["input", "change"]) {
    input.addEventListener(type, (event) => event.stopPropagation());
  }
  part.appendChild(input);
  owner.appendChild(part);
}

/** The window and the edges of a navigator each hold an input of their own. */
const renderNavigator = (tag: string) => (part: HTMLElement) =>
  addInput(part, tag);

/** A range holds the input that moves it, unless it is not movable; its edges hold one each. */
function renderRange(range: HTMLElement) {
  if (range.getAttribute("movable") !== "false") {
    addInput(
      range,
      "audio-ui-timeline-range-input",
      range.getAttribute("range"),
      "range"
    );
  }
}

const renderRangeEdge = (tag: string) => (handle: HTMLElement) =>
  addInput(handle, tag, handle.getAttribute("range"), "range");

/** A mark that is not named takes its value for a name. */
function nameMark(mark: HTMLElement) {
  if (!mark.hasAttribute("mark")) {
    mark.setAttribute("mark", mark.getAttribute("value") ?? "");
  }
}

const numberAttribute = (value: string | null) =>
  value === null ? undefined : Number(value);

/** A clip holds the input that moves it, unless it is not movable. */
function renderClip(clip: HTMLElement) {
  if (clip.getAttribute("movable") !== "false") {
    addInput(
      clip,
      "audio-ui-timeline-clip-input",
      clip.getAttribute("clip"),
      "clip"
    );
  }
}

/** An edge of a clip holds an input of its own, in a part named after it. */
const renderEdge = (tag: string) => (handle: HTMLElement) =>
  addInput(handle, tag, handle.getAttribute("clip"), "clip");

const FADE_SAMPLES = 16;

/** Draws a fade's curve in an `<svg>` inside the part, from its `data-shape` and `data-edge`. */
function renderFade(host: HTMLElement) {
  const SVG = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("viewBox", "0 0 1 1");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.style.display = "block";
  const fill = document.createElementNS(SVG, "path");
  fill.style.fill = "var(--clip-fade-shade, currentColor)";
  const line = document.createElementNS(SVG, "path");
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "currentColor");
  line.setAttribute("stroke-width", "1.5");
  line.style.vectorEffect = "non-scaling-stroke";
  svg.appendChild(fill);
  svg.appendChild(line);
  host.appendChild(svg);
  const draw = () => {
    const shape = (host.getAttribute("data-shape") ?? "linear") as FadeShape;
    const edge = host.hasAttribute("data-edge-in") ? "in" : "out";
    const points: string[] = [];
    for (let index = 0; index <= FADE_SAMPLES; index += 1) {
      const x = index / FADE_SAMPLES;
      const gain = fadeGain(shape, edge === "in" ? x : 1 - x);
      points.push(`${x} ${1 - gain}`);
    }
    fill.setAttribute("d", `M0 0H1L${[...points].reverse().join("L")}Z`);
    line.setAttribute("d", `M${points.join("L")}`);
  };
  draw();
  const observer = new MutationObserver(draw);
  observer.observe(host, { attributeFilter: ["data-shape"], attributes: true });
  return () => {
    observer.disconnect();
    svg.remove();
  };
}

const jsonAttribute = (value: string | null) =>
  value ? JSON.parse(value) : undefined;

/**
 * The whole web adapter of the timeline: a tag for each part. The ruler and a
 * track's resize handle make the input they hold themselves.
 */
export const parts = createParts(timeline, {
  clip: {
    display: "block",
    kinds: { defaultValue: jsonAttribute, value: jsonAttribute },
    render: renderClip,
    tag: "audio-ui-timeline-clip",
  },
  clipFadeIn: {
    display: "block",
    render: renderFade,
    tag: "audio-ui-timeline-clip-fade-in",
  },
  clipFadeInHandle: {
    display: "block",
    render: renderEdge("audio-ui-timeline-clip-fade-in-input"),
    tag: "audio-ui-timeline-clip-fade-in-handle",
  },
  clipFadeInInput: {
    display: "contents",
    properties: ["getAriaValueText"],
    tag: "audio-ui-timeline-clip-fade-in-input",
    target: (el) => el.querySelector("input"),
  },
  clipFadeOut: {
    display: "block",
    render: renderFade,
    tag: "audio-ui-timeline-clip-fade-out",
  },
  clipFadeOutHandle: {
    display: "block",
    render: renderEdge("audio-ui-timeline-clip-fade-out-input"),
    tag: "audio-ui-timeline-clip-fade-out-handle",
  },
  clipFadeOutInput: {
    display: "contents",
    properties: ["getAriaValueText"],
    tag: "audio-ui-timeline-clip-fade-out-input",
    target: (el) => el.querySelector("input"),
  },
  clipHeader: { display: "block", tag: "audio-ui-timeline-clip-header" },
  clipInput: {
    display: "contents",
    properties: ["getAriaValueText"],
    tag: "audio-ui-timeline-clip-input",
    target: (el) => el.querySelector("input"),
  },
  clipTrimEnd: {
    display: "block",
    render: renderEdge("audio-ui-timeline-clip-trim-end-input"),
    tag: "audio-ui-timeline-clip-trim-end",
  },
  clipTrimEndInput: {
    display: "contents",
    properties: ["getAriaValueText"],
    tag: "audio-ui-timeline-clip-trim-end-input",
    target: (el) => el.querySelector("input"),
  },
  clipTrimStart: {
    display: "block",
    render: renderEdge("audio-ui-timeline-clip-trim-start-input"),
    tag: "audio-ui-timeline-clip-trim-start",
  },
  clipTrimStartInput: {
    display: "contents",
    properties: ["getAriaValueText"],
    tag: "audio-ui-timeline-clip-trim-start-input",
    target: (el) => el.querySelector("input"),
  },
  lane: { display: "block", tag: "audio-ui-timeline-lane" },
  mark: {
    display: "block",
    render: nameMark,
    tag: "audio-ui-timeline-mark",
  },
  navigator: { display: "block", tag: "audio-ui-timeline-navigator" },
  navigatorEnd: {
    display: "block",
    render: renderNavigator("audio-ui-timeline-navigator-end-input"),
    tag: "audio-ui-timeline-navigator-end",
  },
  navigatorEndInput: {
    display: "contents",
    properties: ["getAriaValueText"],
    tag: "audio-ui-timeline-navigator-end-input",
    target: (el) => el.querySelector("input"),
  },
  navigatorStart: {
    display: "block",
    render: renderNavigator("audio-ui-timeline-navigator-start-input"),
    tag: "audio-ui-timeline-navigator-start",
  },
  navigatorStartInput: {
    display: "contents",
    properties: ["getAriaValueText"],
    tag: "audio-ui-timeline-navigator-start-input",
    target: (el) => el.querySelector("input"),
  },
  navigatorWindow: {
    display: "block",
    render: renderNavigator("audio-ui-timeline-navigator-window-input"),
    tag: "audio-ui-timeline-navigator-window",
  },
  navigatorWindowInput: {
    display: "contents",
    properties: ["getAriaValueText"],
    tag: "audio-ui-timeline-navigator-window-input",
    target: (el) => el.querySelector("input"),
  },
  playhead: { display: "block", tag: "audio-ui-timeline-playhead" },
  range: {
    display: "block",
    kinds: { defaultValue: jsonAttribute, value: jsonAttribute },
    render: renderRange,
    tag: "audio-ui-timeline-range",
  },
  rangeEnd: {
    display: "block",
    render: renderRangeEdge("audio-ui-timeline-range-end-input"),
    tag: "audio-ui-timeline-range-end",
  },
  rangeEndInput: {
    display: "contents",
    properties: ["getAriaValueText"],
    tag: "audio-ui-timeline-range-end-input",
    target: (el) => el.querySelector("input"),
  },
  rangeInput: {
    display: "contents",
    properties: ["getAriaValueText"],
    tag: "audio-ui-timeline-range-input",
    target: (el) => el.querySelector("input"),
  },
  rangeStart: {
    display: "block",
    render: renderRangeEdge("audio-ui-timeline-range-start-input"),
    tag: "audio-ui-timeline-range-start",
  },
  rangeStartInput: {
    display: "contents",
    properties: ["getAriaValueText"],
    tag: "audio-ui-timeline-range-start-input",
    target: (el) => el.querySelector("input"),
  },
  root: {
    display: "block",
    events: {
      onClipChange: "clipchange",
      onClipCommitted: "clipcommit",
      onClipRemove: "clipremove",
      onClipSelectedChange: "clipselect",
      onMarkChange: "markchange",
      onRangeChange: "rangechange",
      onRangeCommitted: "rangecommit",
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
  track: { display: "block", tag: "audio-ui-timeline-track" },
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
