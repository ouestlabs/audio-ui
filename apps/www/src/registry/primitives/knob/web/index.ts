import { createParts, wrappedChild } from "@ui-sdk/web";
import {
  arcOf,
  DEFAULT_ARC_STROKE_WIDTH,
  editableReadout,
  indicatorSpan,
  type KnobState,
  knob,
  viewOf,
} from "@/primitives/knob";

/** A thumb's attributes that name its input instead, so they are read once. */
const INPUT_NAMES = ["aria-describedby", "aria-label", "aria-labelledby"];

/**
 * The thumb holds the native range input, which takes focus, the keys, the
 * name and the form value. Its own `input` and `change` events stop at the
 * knob, whose events of those names report the value with a reason.
 */
function renderThumb(thumb: HTMLElement) {
  if (thumb.querySelector("input")) {
    return;
  }
  const part = document.createElement("audio-ui-knob-input");
  const input = document.createElement("input");
  for (const name of INPUT_NAMES) {
    const value = thumb.getAttribute(name);
    if (value !== null) {
      input.setAttribute(name, value);
      thumb.removeAttribute(name);
    }
  }
  for (const type of ["input", "change"]) {
    input.addEventListener(type, (event) => event.stopPropagation());
  }
  part.appendChild(input);
  thumb.appendChild(part);
}

const SVG = "http://www.w3.org/2000/svg";

/** An arc part's `stroke-width` attribute, as the React part's prop. */
const widthOf = (part: Element) =>
  Number(part.getAttribute("stroke-width")) || DEFAULT_ARC_STROKE_WIDTH;

/** Draws an arc in an `<svg>` the part holds, made on first draw, or takes it away. */
function drawArc(part: Element, from: number, to: number) {
  const width = widthOf(part);
  const d = arcOf(width, from, to);
  let svg = part.querySelector("svg");
  if (!svg) {
    svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("style", "display: block; height: 100%; width: 100%");
    svg.setAttribute("viewBox", "0 0 48 48");
    part.appendChild(svg);
  }
  let path = svg.querySelector("path");
  if (!d) {
    path?.remove();
    return;
  }
  if (!path) {
    path = document.createElementNS(SVG, "path");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-linecap", "round");
    svg.appendChild(path);
  }
  path.setAttribute("stroke-width", String(width));
  path.setAttribute("d", d);
}

/** Writes the value's text as one text node's data, so a change restyles nothing else. */
function writeText(part: Element, text: string) {
  const node =
    part.firstChild instanceof Text
      ? part.firstChild
      : part.appendChild(document.createTextNode(""));
  if (node.data !== text) {
    node.data = text;
  }
}

/**
 * What React renders as children, the knob draws here: the arcs and the
 * value's text, from the state the primitive shows, on every change. The
 * knob connects before its parts are parsed, so it draws again once they bind.
 */
function drawParts(
  el: HTMLElement,
  instance: {
    get: () => object;
    subscribe: (listener: () => void) => () => void;
  }
) {
  // A readout given `editable` lays a field over the text the knob keeps drawing.
  const editable = new Map<Element, () => void>();
  const bindEditable = () => {
    for (const [readout, detach] of editable) {
      if (!(readout.isConnected && readout.hasAttribute("editable"))) {
        detach();
        editable.delete(readout);
      }
    }
    for (const readout of el.querySelectorAll<HTMLElement>(
      "audio-ui-knob-value[editable]"
    )) {
      if (!editable.has(readout)) {
        editable.set(readout, editableReadout(readout, "knob"));
      }
    }
  };
  const draw = () => {
    bindEditable();
    const view = viewOf(instance.get() as KnobState);
    for (const track of el.querySelectorAll("audio-ui-knob-track")) {
      drawArc(track, 0, 1);
    }
    for (const indicator of el.querySelectorAll("audio-ui-knob-indicator")) {
      drawArc(indicator, ...indicatorSpan(view));
    }
    for (const value of el.querySelectorAll("audio-ui-knob-value")) {
      writeText(value, view.formatted);
    }
  };
  draw();
  queueMicrotask(draw);
  const unsubscribe = instance.subscribe(draw);
  return () => {
    unsubscribe();
    for (const detach of editable.values()) {
      detach();
    }
    editable.clear();
  };
}

const jsonAttribute = (value: string | null) =>
  value ? JSON.parse(value) : undefined;

/** The whole web adapter of the knob: a tag for each part, and how attributes read. */
export const parts = createParts(knob, {
  control: { display: "block", tag: "audio-ui-knob-control" },
  indicator: { display: "block", tag: "audio-ui-knob-indicator" },
  input: {
    display: "contents",
    tag: "audio-ui-knob-input",
    target: wrappedChild("input"),
  },
  label: { display: "block", tag: "audio-ui-knob-label" },
  mark: "audio-ui-knob-mark",
  root: {
    api: ["setValue"],
    display: "block",
    events: { onValueChange: "input", onValueCommitted: "change" },
    kinds: {
      format: jsonAttribute,
      locale: "string",
      scale: (value) => value ?? undefined,
    },
    render: drawParts,
    state: {
      value: {
        get: (api) => api.value(),
        set: (api, value: number) => api.set(value),
      },
    },
    tag: "audio-ui-knob",
  },
  thumb: { display: "block", render: renderThumb, tag: "audio-ui-knob-thumb" },
  track: { display: "block", tag: "audio-ui-knob-track" },
  value: "audio-ui-knob-value",
});
