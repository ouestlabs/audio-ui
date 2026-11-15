import { polylinePoints } from "@audio-ui/core/envelope";
import { type EnvelopeState, envelope } from "@audio-ui/primitives/envelope";
import { createParts } from "@ui-sdk/web";

const SVG = "http://www.w3.org/2000/svg";
const DEFAULT_STROKE_WIDTH = 2;

/** The `<svg>` and `<polyline>` a drawing part holds, made on first draw. */
function polylineOf(part: Element, filled: boolean) {
  let svg = part.querySelector("svg");
  if (!svg) {
    svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute(
      "style",
      "height: 100%; inset: 0; position: absolute; width: 100%"
    );
    svg.setAttribute("viewBox", "0 0 100 100");
    part.appendChild(svg);
  }
  let line = svg.querySelector("polyline");
  if (!line) {
    line = document.createElementNS(SVG, "polyline");
    if (filled) {
      line.setAttribute("fill", "currentColor");
      line.setAttribute("stroke", "none");
    } else {
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", "currentColor");
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("stroke-linejoin", "round");
      line.setAttribute(
        "stroke-width",
        part.getAttribute("stroke-width") ?? String(DEFAULT_STROKE_WIDTH)
      );
      line.setAttribute("style", "vector-effect: non-scaling-stroke");
    }
    svg.appendChild(line);
  }
  return line;
}

/** Makes, or takes away, the elements of one kind so there are `count` of them, one for each index. */
function syncGenerated(
  root: HTMLElement,
  tag: string,
  count: number,
  label: string
) {
  const present = [...root.children].filter(
    (child) => child.localName === tag && child.hasAttribute("data-generated")
  );
  for (let index = present.length; index < count; index += 1) {
    const element = document.createElement(tag);
    element.setAttribute("data-generated", "");
    element.setAttribute("index", String(index));
    element.setAttribute("aria-label", `${label} ${index + 1}`);
    root.appendChild(element);
  }
  for (let index = present.length - 1; index >= count; index -= 1) {
    present[index]?.remove();
  }
}

/**
 * What React renders as children, the envelope draws here: the polylines of
 * the line and the fill, and one point for each point and one handle for each
 * segment, which a double click adds and removes. The envelope connects before
 * its parts are parsed, so it draws again once they bind.
 */
function draw(
  el: HTMLElement,
  instance: {
    get: () => object;
    subscribe: (listener: () => void) => () => void;
  }
) {
  const paint = () => {
    const { view } = instance.get() as EnvelopeState;
    const points = polylinePoints(view.value);
    for (const line of el.querySelectorAll("audio-ui-envelope-line")) {
      polylineOf(line, false).setAttribute("points", points);
    }
    for (const fill of el.querySelectorAll("audio-ui-envelope-fill")) {
      polylineOf(fill, true).setAttribute(
        "points",
        points ? `${points} 100,100 0,100` : ""
      );
    }
    syncGenerated(el, "audio-ui-envelope-point", view.value.length, "Point");
    syncGenerated(
      el,
      "audio-ui-envelope-segment",
      Math.max(0, view.value.length - 1),
      "Curve"
    );
  };
  paint();
  queueMicrotask(paint);
  return instance.subscribe(paint);
}

const jsonAttribute = (value: string | null) =>
  value ? JSON.parse(value) : undefined;

/** The whole web adapter of the envelope: a tag for each part, and how attributes read. */
export const parts = createParts(envelope, {
  fill: { display: "block", tag: "audio-ui-envelope-fill" },
  graph: { display: "block", tag: "audio-ui-envelope-graph" },
  line: { display: "block", tag: "audio-ui-envelope-line" },
  point: { display: "block", tag: "audio-ui-envelope-point" },
  root: {
    api: ["set"],
    display: "block",
    events: { onValueChange: "input", onValueCommitted: "change" },
    kinds: {
      defaultValue: jsonAttribute,
      format: jsonAttribute,
      locale: "string",
      snap: jsonAttribute,
      value: jsonAttribute,
    },
    render: draw,
    state: {
      value: {
        get: (api) => api.controller.getSnapshot().value,
        set: (api, value: { x: number; y: number; curve?: number }[]) =>
          api.set(value),
      },
    },
    tag: "audio-ui-envelope",
  },
  segment: { display: "block", tag: "audio-ui-envelope-segment" },
});
