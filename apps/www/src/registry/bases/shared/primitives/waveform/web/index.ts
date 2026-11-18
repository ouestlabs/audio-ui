import { createParts } from "@ui-sdk/web";
import { waveform } from "@/primitives/waveform";

const NAMING = ["aria-describedby", "aria-label", "aria-labelledby"] as const;

/** Adds the part `tag` holding a native input to `owner`, with the names the owner was given. */
function addInput(owner: HTMLElement, tag: string, region?: string | null) {
  if (owner.querySelector("input")) {
    return;
  }
  const part = document.createElement(tag) as HTMLElement & {
    getAriaValueText?: (value: number, duration: number) => string;
  };
  if (region) {
    part.setAttribute("region", region);
  }
  const input = document.createElement("input");
  for (const name of NAMING) {
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

/** The control holds the input that takes the keys and carries the name. */
function renderControl(control: HTMLElement) {
  addInput(control, "audio-ui-waveform-input");
}

/** A region's edge holds an input of its own. */
const renderEdge = (edge: "end" | "start") => (handle: HTMLElement) =>
  addInput(
    handle,
    `audio-ui-waveform-region-${edge}-input`,
    handle.getAttribute("region")
  );

/** The bars are made by the part, one for each of its `count`. */
function renderBars(bars: HTMLElement) {
  const draw = () => {
    const count = Number(bars.getAttribute("count") ?? 24);
    const present = [...bars.children].filter((child) =>
      child.hasAttribute("data-generated")
    );
    for (let index = present.length; index < count; index += 1) {
      const bar = document.createElement("audio-ui-waveform-bar");
      bar.setAttribute("data-generated", "");
      bar.setAttribute("index", String(index));
      bars.appendChild(bar);
    }
    for (let index = present.length - 1; index >= count; index -= 1) {
      present[index]?.remove();
    }
  };
  draw();
  const observer = new MutationObserver((records) => {
    if (records.some((record) => record.attributeName === "count")) {
      draw();
    }
  });
  observer.observe(bars, { attributeFilter: ["count"], attributes: true });
  return () => observer.disconnect();
}

/** The canvas is made inside the part: a custom element cannot be one. */
function canvasOf(part: HTMLElement) {
  let element = part.querySelector("canvas");
  if (!element) {
    element = document.createElement("canvas");
    element.style.display = "block";
    element.style.height = "100%";
    element.style.width = "100%";
    part.appendChild(element);
  }
  return element;
}

const jsonAttribute = (value: string | null) =>
  value ? JSON.parse(value) : undefined;

/**
 * The whole web adapter of the waveform: a tag for each part. The control, the
 * bars, the canvas and a region's edges make what they hold themselves.
 */
export const parts = createParts(waveform, {
  bar: { display: "block", tag: "audio-ui-waveform-bar" },
  bars: {
    display: "block",
    render: renderBars,
    tag: "audio-ui-waveform-bars",
  },
  canvas: {
    display: "block",
    tag: "audio-ui-waveform-canvas",
    target: canvasOf,
  },
  control: {
    display: "block",
    render: renderControl,
    tag: "audio-ui-waveform-control",
  },
  hover: {
    display: "block",
    properties: ["format"],
    tag: "audio-ui-waveform-hover",
  },
  input: {
    display: "contents",
    properties: ["getAriaValueText"],
    tag: "audio-ui-waveform-input",
    target: (el) => el.querySelector("input"),
  },
  marker: { display: "block", tag: "audio-ui-waveform-marker" },
  playhead: { display: "block", tag: "audio-ui-waveform-playhead" },
  region: {
    display: "block",
    kinds: { defaultValue: jsonAttribute, value: jsonAttribute },
    tag: "audio-ui-waveform-region",
  },
  regionEnd: {
    display: "block",
    render: renderEdge("end"),
    tag: "audio-ui-waveform-region-end",
  },
  regionEndInput: {
    display: "contents",
    properties: ["getAriaValueText"],
    tag: "audio-ui-waveform-region-end-input",
    target: (el) => el.querySelector("input"),
  },
  regionStart: {
    display: "block",
    render: renderEdge("start"),
    tag: "audio-ui-waveform-region-start",
  },
  regionStartInput: {
    display: "contents",
    properties: ["getAriaValueText"],
    tag: "audio-ui-waveform-region-start-input",
    target: (el) => el.querySelector("input"),
  },
  root: {
    display: "block",
    events: {
      onRegionChange: "regionchange",
      onRegionCommitted: "regioncommit",
      onSelectionChange: "selectionchange",
      onSelectionCommitted: "selectioncommit",
      onValueChange: "input",
      onValueCommitted: "change",
    },
    kinds: { range: jsonAttribute },
    // A live position or signal, and the peaks, are set as properties.
    properties: ["levels", "peaks", "source"],
    tag: "audio-ui-waveform",
  },
  thumb: { display: "block", tag: "audio-ui-waveform-thumb" },
});
