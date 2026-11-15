import {
  bandOf,
  curveOf,
  lineOf,
  type PlotState,
  plot,
  ticksOf,
  traceOf,
} from "@audio-ui/primitives/plot";
import { createParts } from "@ui-sdk/web";

const SVG = "http://www.w3.org/2000/svg";

/** A number written as an attribute, or undefined. */
const numberOf = (el: Element, name: string) => {
  const value = el.getAttribute(name);
  return value === null || value === "" ? undefined : Number(value);
};

/** An `<svg>` child of `part`, with the element `tag` inside it, made on first use. */
function shapeIn(
  part: Element,
  tag: string,
  attributes: Record<string, string> = {}
) {
  let svg = part.querySelector("svg");
  if (!svg) {
    svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("height", "100%");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute(
      "style",
      "inset: 0; overflow: visible; position: absolute"
    );
    svg.setAttribute("viewBox", "0 0 1 1");
    svg.setAttribute("width", "100%");
    part.appendChild(svg);
  }
  let shape = svg.querySelector(tag);
  if (!shape) {
    shape = document.createElementNS(SVG, tag);
    shape.setAttribute("style", "vector-effect: non-scaling-stroke");
    svg.appendChild(shape);
  }
  for (const [name, value] of Object.entries(attributes)) {
    if (shape.getAttribute(name) !== value) {
      shape.setAttribute(name, value);
    }
  }
  return { shape, svg };
}

/** Makes the lines and labels of a grid inside its part, from the ticks it was given. */
function drawGrid(
  part: Element & { x?: unknown; y?: unknown },
  axes: PlotState["axes"]
) {
  const columns = ticksOf(axes.x, part.x as never);
  const rows = ticksOf(axes.y, part.y as never);
  const svg = shapeIn(part, "g").svg;
  const group = svg.querySelector("g") as Element;
  const lines: string[] = [];
  for (const tick of columns) {
    lines.push(
      `<line data-axis="x" data-part="line" ${tick.value === 0 ? 'data-zero=""' : ""} style="vector-effect: non-scaling-stroke" x1="${tick.position}" x2="${tick.position}" y1="0" y2="1"/>`
    );
  }
  for (const tick of rows) {
    lines.push(
      `<line data-axis="y" data-part="line" ${tick.value === 0 ? 'data-zero=""' : ""} style="vector-effect: non-scaling-stroke" x1="0" x2="1" y1="${1 - tick.position}" y2="${1 - tick.position}"/>`
    );
  }
  // The markup is only numbers and our own attribute names.
  const markup = lines.join("");
  if (group.getAttribute("data-markup") !== markup) {
    group.setAttribute("data-markup", markup);
    group.replaceChildren(
      ...new DOMParser().parseFromString(
        `<svg xmlns="${SVG}">${markup}</svg>`,
        "image/svg+xml"
      ).documentElement.children
    );
  }
  const labels = [
    ...columns.map((tick) => ({ axis: "x", tick })),
    ...rows.map((tick) => ({ axis: "y", tick })),
  ].filter(({ tick }) => tick.label !== null);
  // Written again only when they change: a write is a mutation the plot watches.
  const signature = labels
    .map(({ axis, tick }) => `${axis}:${tick.position}:${tick.label}`)
    .join("|");
  if (part.getAttribute("data-labels") === signature) {
    return;
  }
  part.setAttribute("data-labels", signature);
  for (const stale of part.querySelectorAll('[data-part="label"]')) {
    stale.remove();
  }
  for (const { axis, tick } of labels) {
    const label = document.createElement("div");
    label.setAttribute("data-axis", axis);
    label.setAttribute("data-part", "label");
    label.style.position = "absolute";
    if (axis === "x") {
      label.style.left = `${tick.position * 100}%`;
    } else {
      label.style.top = `${(1 - tick.position) * 100}%`;
    }
    label.textContent = tick.label;
    part.appendChild(label);
  }
}

/** The path a part draws is written as its child. */
function drawParts(
  el: HTMLElement,
  instance: {
    get: () => object;
    subscribe: (listener: () => void) => () => void;
  }
) {
  const paint = () => {
    const { axes } = instance.get() as PlotState;
    for (const curve of el.querySelectorAll<
      HTMLElement & { fn?: (x: number) => number }
    >("audio-ui-plot-curve")) {
      const d = curve.fn
        ? curveOf(
            axes,
            curve.fn,
            numberOf(curve, "samples"),
            numberOf(curve, "fill-to")
          )
        : "";
      shapeIn(curve, "path", { "data-plot": "path", d });
    }
    for (const trace of el.querySelectorAll<
      HTMLElement & { source?: { getSnapshot: () => ArrayLike<number> } }
    >("audio-ui-plot-trace")) {
      const d = trace.source
        ? traceOf(axes, trace.source.getSnapshot(), {
            fillTo: numberOf(trace, "fill-to"),
            max: numberOf(trace, "max"),
            min: numberOf(trace, "min"),
          })
        : "";
      shapeIn(trace, "path", { "data-plot": "path", d });
    }
    for (const line of el.querySelectorAll("audio-ui-plot-line")) {
      const axis = line.getAttribute("axis") === "y" ? "y" : "x";
      const ends = lineOf(axes, axis, numberOf(line, "value") ?? 0);
      shapeIn(line, "line", {
        x1: String(ends.x1),
        x2: String(ends.x2),
        y1: String(ends.y1),
        y2: String(ends.y2),
      });
    }
    for (const band of el.querySelectorAll("audio-ui-plot-band")) {
      const axis = band.getAttribute("axis") === "y" ? "y" : "x";
      const box = bandOf(
        axes,
        axis,
        numberOf(band, "from") ?? 0,
        numberOf(band, "to") ?? 0
      );
      shapeIn(band, "rect", {
        height: String(box.height),
        width: String(box.width),
        x: String(box.x),
        y: String(box.y),
      });
    }
    for (const grid of el.querySelectorAll("audio-ui-plot-grid")) {
      drawGrid(grid, axes);
    }
  };
  paint();
  queueMicrotask(paint);
  // A curve given a new function, a part written later: both change the DOM or the part's `data-fn`.
  const observer = new MutationObserver(paint);
  observer.observe(el, {
    attributeFilter: [
      "data-fn",
      "data-ticks",
      "value",
      "from",
      "to",
      "axis",
      "fill-to",
    ],
    attributes: true,
    childList: true,
    subtree: true,
  });
  const unsubscribe = instance.subscribe(paint);
  return () => {
    observer.disconnect();
    unsubscribe();
  };
}

/** The names set on a handle go onto its inputs, which are made inside it, one for each axis it moves along. */
function renderHandle(handle: HTMLElement) {
  if (handle.querySelector("input")) {
    return;
  }
  const name = handle.getAttribute("handle") ?? "";
  const axis = handle.getAttribute("axis") ?? "both";
  const label = handle.getAttribute("aria-label");
  handle.removeAttribute("aria-label");
  for (const along of ["x", "y"] as const) {
    if (axis !== "both" && axis !== along) {
      continue;
    }
    const part = document.createElement(
      `audio-ui-plot-input-${along}`
    ) as HTMLElement & {
      getAriaLabel?: (axis: "x" | "y") => string | undefined;
    };
    part.setAttribute("handle", name);
    part.getAriaLabel = () =>
      label && axis === "both"
        ? `${label} ${along.toUpperCase()}`
        : (label ?? undefined);
    const input = document.createElement("input");
    for (const type of ["input", "change"]) {
      input.addEventListener(type, (event) => event.stopPropagation());
    }
    part.appendChild(input);
    handle.appendChild(part);
  }
}

const jsonAttribute = (value: string | null) =>
  value ? JSON.parse(value) : undefined;

/**
 * The whole web adapter of the plot: a tag for each part. A part that draws
 * writes its own `<svg>`; a handle makes the inputs it carries.
 */
export const parts = createParts(plot, {
  band: { display: "block", tag: "audio-ui-plot-band" },
  curve: {
    display: "block",
    properties: ["fn"],
    tag: "audio-ui-plot-curve",
  },
  cursor: { display: "block", tag: "audio-ui-plot-cursor" },
  cursorReadout: {
    display: "block",
    properties: ["format"],
    tag: "audio-ui-plot-cursor-readout",
  },
  dot: {
    display: "block",
    kinds: { value: jsonAttribute },
    properties: ["source"],
    tag: "audio-ui-plot-dot",
  },
  grid: {
    display: "block",
    properties: ["x", "y"],
    tag: "audio-ui-plot-grid",
  },
  handle: {
    display: "block",
    kinds: { defaultValue: jsonAttribute, value: jsonAttribute },
    render: renderHandle,
    tag: "audio-ui-plot-handle",
  },
  inputX: {
    display: "contents",
    properties: ["getAriaLabel", "getAriaValueText"],
    tag: "audio-ui-plot-input-x",
    target: (el) => el.querySelector("input"),
  },
  inputY: {
    display: "contents",
    properties: ["getAriaLabel", "getAriaValueText"],
    tag: "audio-ui-plot-input-y",
    target: (el) => el.querySelector("input"),
  },
  line: { display: "block", tag: "audio-ui-plot-line" },
  mark: { display: "block", tag: "audio-ui-plot-mark" },
  root: {
    display: "block",
    events: { onValueChange: "input", onValueCommitted: "change" },
    kinds: {
      scaleX: (value) => value ?? undefined,
      scaleY: (value) => value ?? undefined,
    },
    render: drawParts,
    tag: "audio-ui-plot",
  },
  trace: {
    display: "block",
    properties: ["source"],
    tag: "audio-ui-plot-trace",
  },
});
