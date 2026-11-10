import {
  createStore,
  type ParameterScaleProp,
  resolveScale,
  type Source,
  type Store,
} from "@audio-ui/core";
import {
  axisTicks,
  createPlotHandleController,
  curvePath,
  formatTick,
  type PlotAxis,
  type PlotHandleAxis,
  type PlotHandleChangeEventReason,
  type PlotHandleCommitEventReason,
  type PlotHandleController,
  type PlotHandleOptions,
  type PlotPoint,
  positionOn,
  tracePath,
  valueOn,
} from "@audio-ui/core/plot";
import {
  hideVisually,
  listAttribute,
  localeOf,
  numberAttribute,
  reflect,
} from "../internal/element.ts";
import { ValueText } from "../internal/input.ts";
import {
  ControlPart,
  ControlRoot,
  reportChange,
  reportCommit,
} from "../internal/parts.ts";

/** The names the plot's elements are registered under, frozen: a page cannot rename them by accident. */
export const PLOT_TAGS = Object.freeze({
  band: "audio-ui-plot-band",
  curve: "audio-ui-plot-curve",
  cursor: "audio-ui-plot-cursor",
  cursorReadout: "audio-ui-plot-cursor-readout",
  dot: "audio-ui-plot-dot",
  grid: "audio-ui-plot-grid",
  handle: "audio-ui-plot-handle",
  line: "audio-ui-plot-line",
  mark: "audio-ui-plot-mark",
  root: "audio-ui-plot",
  trace: "audio-ui-plot-trace",
});

/** What every part draws from: the plot's two axes, and whether it is disabled. */
export interface PlotSnapshot {
  disabled: boolean;
  x: PlotAxis;
  y: PlotAxis;
}

type Axis = "x" | "y";

/** What a handle's `input` and `change` events carry, besides the handle itself as their target. */
export interface PlotHandleEventDetail<Reason extends string> {
  /** What changed it: `drag`, `keyboard`, `input-change` or `reset`. */
  reason: Reason;
  value: PlotPoint;
}

/** Fired on every move of a handle. Cancel it, with `preventDefault()`, to refuse the value. */
export type PlotHandleInputEvent = CustomEvent<
  PlotHandleEventDetail<PlotHandleChangeEventReason>
>;
/** Fired once a gesture that moved a handle ends, and after each key or input change. */
export type PlotHandleChangeEvent = CustomEvent<
  PlotHandleEventDetail<PlotHandleCommitEventReason>
>;

/** The events a handle fires, as `addEventListener` types them. */
export interface PlotHandleElementEventMap
  extends Omit<HTMLElementEventMap, "change" | "input"> {
  change: PlotHandleChangeEvent;
  input: PlotHandleInputEvent;
}

const SVG = "http://www.w3.org/2000/svg";

/** The axis an `axis` attribute names: `y`, or `x` by default. */
const axisOf = (element: Element): Axis =>
  element.getAttribute("axis") === "y" ? "y" : "x";

/** A point attribute, `"x y"` or `"x, y"`, or `undefined` when it is missing or not two numbers. */
function pointAttribute(element: Element, name: string): PlotPoint | undefined {
  const [x, y] = listAttribute(element, name).map(Number);
  return x !== undefined &&
    y !== undefined &&
    Number.isFinite(x) &&
    Number.isFinite(y)
    ? { x, y }
    : undefined;
}

/** A scale attribute: `linear` or `log`. */
function scaleAttribute(
  element: Element,
  name: string
): ParameterScaleProp | undefined {
  const scale = element.getAttribute(name);
  return scale === "linear" || scale === "log" ? scale : undefined;
}

/** The `left` and `top` of a point placed on the plot, as percentages, on the floor for what is not a number. */
function placement(point: PlotPoint, plot: PlotSnapshot) {
  const left = positionOn(plot.x, point.x);
  const top = 1 - positionOn(plot.y, point.y);
  return {
    left: `${(Number.isNaN(left) ? 0 : left) * 100}%`,
    top: `${(Number.isNaN(top) ? 1 : top) * 100}%`,
  };
}

/**
 * The root of a plot. Defines two axes, each with a range and a scale,
 * linear or logarithmic, and positions every part in axis units. Attributes
 * mirror the props of the React `Plot.Root`: `min-x`, `max-x`, `min-y`,
 * `max-y` (0 to 1), `scale-x` and `scale-y` (`linear` or `log`), `disabled`,
 * and `locale` for the handles' values.
 */
export class PlotElement extends ControlRoot<PlotSnapshot> {
  static readonly observedAttributes = [
    "disabled",
    "max-x",
    "max-y",
    "min-x",
    "min-y",
    "scale-x",
    "scale-y",
  ];

  #snapshot: PlotSnapshot = {
    disabled: false,
    x: { max: 1, min: 0, scale: resolveScale("linear") },
    y: { max: 1, min: 0, scale: resolveScale("linear") },
  };
  #scaleX: ParameterScaleProp | undefined;
  #scaleY: ParameterScaleProp | undefined;
  #rect: DOMRect | null = null;
  #resize: ResizeObserver | undefined;
  readonly #forget = () => {
    this.#rect = null;
  };

  override connectedCallback() {
    super.connectedCallback();
    // The box is only good until the plot is resized or the page moves under it.
    if (typeof ResizeObserver !== "undefined") {
      this.#resize ??= new ResizeObserver(this.#forget);
      this.#resize.observe(this);
    }
    window.addEventListener("scroll", this.#forget, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", this.#forget, { passive: true });
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#resize?.disconnect();
    window.removeEventListener("scroll", this.#forget, { capture: true });
    window.removeEventListener("resize", this.#forget);
  }

  attributeChangedCallback() {
    this.configure();
    this.paint();
  }

  /** How x values spread across: `linear`, `log`, or your own `{ toPosition, toValue }`. Overrides the `scale-x` attribute. */
  get scaleX(): ParameterScaleProp {
    return this.#scaleX ?? scaleAttribute(this, "scale-x") ?? "linear";
  }

  set scaleX(scale: ParameterScaleProp | undefined) {
    this.#scaleX = scale;
    this.configure();
    this.paint();
  }

  /** How y values spread up. Overrides the `scale-y` attribute. */
  get scaleY(): ParameterScaleProp {
    return this.#scaleY ?? scaleAttribute(this, "scale-y") ?? "linear";
  }

  set scaleY(scale: ParameterScaleProp | undefined) {
    this.#scaleY = scale;
    this.configure();
    this.paint();
  }

  /**
   * The plot's box in the viewport. Reading it forces the browser to lay the
   * page out, so the box is kept until the plot is resized or the page
   * scrolls; `fresh` reads it again, for the start of a gesture.
   */
  measure(fresh = false): DOMRect | null {
    if (fresh || !this.#rect) {
      const rect = this.getBoundingClientRect();
      this.#rect = rect.width > 0 && rect.height > 0 ? rect : null;
    }
    return this.#rect;
  }

  /** The value under a pointer, in the axes' units and kept within them, or null while the plot has no size: for adding a point where someone double-clicks. */
  valueAt(clientX: number, clientY: number): PlotPoint | null {
    const rect = this.measure();
    if (!rect) {
      return null;
    }
    const { x, y } = this.#snapshot;
    const across = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const up = Math.min(1, Math.max(0, 1 - (clientY - rect.top) / rect.height));
    return { x: valueOn(x, across), y: valueOn(y, up) };
  }

  /** The axes and the disabled state, as the parts draw them. */
  snapshot(): PlotSnapshot {
    return this.#snapshot;
  }

  protected subscribe() {
    // The axes change only through attributes and properties, which paint at once.
    return () => undefined;
  }

  protected rootAttributes(snapshot: PlotSnapshot) {
    return { "data-disabled": snapshot.disabled ? "" : null };
  }

  protected configure() {
    this.#snapshot = {
      disabled: this.hasAttribute("disabled"),
      x: {
        max: numberAttribute(this, "max-x") ?? 1,
        min: numberAttribute(this, "min-x") ?? 0,
        scale: resolveScale(this.scaleX),
      },
      y: {
        max: numberAttribute(this, "max-y") ?? 1,
        min: numberAttribute(this, "min-y") ?? 0,
        scale: resolveScale(this.scaleY),
      },
    };
  }
}

/** What every part of the plot does: find its plot, and carry its state. */
abstract class PlotPartElement extends ControlPart<PlotElement, PlotSnapshot> {
  protected readonly rootTag = PLOT_TAGS.root;

  protected isRoot(element: Element | null) {
    return element instanceof PlotElement;
  }

  protected state(snapshot: PlotSnapshot): Record<string, string | null> {
    return { "data-disabled": snapshot.disabled ? "" : null };
  }

  /** Paints the part again from its plot, after one of its own attributes changed. */
  protected repaint() {
    if (this.root) {
      this.paint(this.root.snapshot());
    }
  }
}

/**
 * A shape drawn in a stretched 1×1 SVG of its own that covers the plot,
 * hidden from assistive technology and from the pointer. Strokes keep their
 * width however the plot is stretched.
 */
abstract class PlotDrawingElement extends PlotPartElement {
  readonly #svg = document.createElementNS(SVG, "svg");
  protected readonly shape: SVGElement;

  constructor(tag: "line" | "path" | "rect") {
    super();
    reflect(this.#svg, {
      "aria-hidden": "true",
      preserveAspectRatio: "none",
      viewBox: "0 0 1 1",
    });
    Object.assign(this.#svg.style, {
      display: "block",
      height: "100%",
      overflow: "visible",
      width: "100%",
    });
    this.shape = document.createElementNS(SVG, tag);
    this.shape.style.setProperty("vector-effect", "non-scaling-stroke");
    this.#svg.appendChild(this.shape);
  }

  attributeChangedCallback() {
    this.repaint();
  }

  protected override attached(_plot: PlotElement) {
    if (this.#svg.parentNode !== this) {
      this.appendChild(this.#svg);
    }
  }

  /** A line in `currentColor`, or with `fill-to`, an area in `currentColor`. */
  protected look(fillTo: number | undefined) {
    reflect(
      this.shape,
      fillTo === undefined
        ? { fill: "none", stroke: "currentColor" }
        : { fill: "currentColor", stroke: "none" }
    );
  }
}

/** The points a curve starts from: enough for a smooth curve at any size, before it adds more at the tight bends. */
const DEFAULT_SAMPLES = 256;

/**
 * Plots `y = fn(x)` across the plot in axis units, from the `fn` property,
 * such as a frequency response in dB. Stroked in `currentColor`; with
 * `fill-to`, closed to that y value and filled instead. `samples` sets the
 * initial sampling (256), refined adaptively at sharp bends.
 */
export class PlotCurveElement extends PlotDrawingElement {
  static readonly observedAttributes = ["fill-to", "samples"];

  #fn: ((x: number) => number) | undefined;

  constructor() {
    super("path");
  }

  /** The curve: y, in the y axis' units, at each x. */
  get fn(): ((x: number) => number) | undefined {
    return this.#fn;
  }

  set fn(fn: ((x: number) => number) | undefined) {
    this.#fn = fn;
    this.repaint();
  }

  override paint(snapshot: PlotSnapshot) {
    super.paint(snapshot);
    const fillTo = numberAttribute(this, "fill-to");
    this.look(fillTo);
    this.shape.setAttribute(
      "d",
      this.#fn
        ? curvePath(
            this.#fn,
            snapshot.x,
            snapshot.y,
            numberAttribute(this, "samples") ?? DEFAULT_SAMPLES,
            fillTo
          )
        : ""
    );
  }
}

/**
 * A straight line at `value`: vertical on the x axis (`axis="x"`, the
 * default), such as a cutoff, or horizontal on the y axis, such as 0 dB.
 * Stroked in `currentColor`.
 */
export class PlotLineElement extends PlotDrawingElement {
  static readonly observedAttributes = ["axis", "value"];

  constructor() {
    super("line");
    this.shape.setAttribute("stroke", "currentColor");
  }

  override paint(snapshot: PlotSnapshot) {
    super.paint(snapshot);
    const axis = axisOf(this);
    const value = numberAttribute(this, "value") ?? 0;
    const at =
      axis === "x"
        ? positionOn(snapshot.x, value)
        : 1 - positionOn(snapshot.y, value);
    const ends =
      axis === "x"
        ? { x1: at, x2: at, y1: 0, y2: 1 }
        : { x1: 0, x2: 1, y1: at, y2: at };
    for (const [name, coordinate] of Object.entries(ends)) {
      this.shape.setAttribute(name, String(coordinate));
    }
  }
}

const round = (value: number) => Math.round(value * 1e5) / 1e5;

/**
 * The range of one `axis` between `from` and `to`, spanning the other axis,
 * such as a sweep range or a level above a threshold. Filled in
 * `currentColor`.
 */
export class PlotBandElement extends PlotDrawingElement {
  static readonly observedAttributes = ["axis", "from", "to"];

  constructor() {
    super("rect");
    this.shape.setAttribute("fill", "currentColor");
  }

  override paint(snapshot: PlotSnapshot) {
    super.paint(snapshot);
    const axis = axisOf(this);
    const from = numberAttribute(this, "from") ?? 0;
    const to = numberAttribute(this, "to") ?? 0;
    const along = axis === "x" ? snapshot.x : snapshot.y;
    const start = round(positionOn(along, Math.min(from, to)));
    const end = round(positionOn(along, Math.max(from, to)));
    const box =
      axis === "x"
        ? { height: 1, width: round(end - start), x: start, y: 0 }
        : { height: round(end - start), width: 1, x: 0, y: round(1 - end) };
    for (const [name, size] of Object.entries(box)) {
      this.shape.setAttribute(name, String(size));
    }
  }
}

/** A live list of y values, spread evenly across the x axis. */
export type PlotTraceSource = Source<ArrayLike<number>>;

/**
 * A live line from the y values of the `source` property, such as a
 * spectrum, spread evenly across the x axis and redrawn on each change.
 * Stroked in `currentColor`; with `fill-to`, filled. `min` and `max` set an
 * independent value scale, such as absolute dB behind a gain axis.
 */
export class PlotTraceElement extends PlotDrawingElement {
  static readonly observedAttributes = ["fill-to", "max", "min"];

  #source: PlotTraceSource | undefined;
  #unsubscribe: (() => void) | undefined;

  constructor() {
    super("path");
  }

  /** The live y values; the snapshot may be one array updated in place. */
  get source(): PlotTraceSource | undefined {
    return this.#source;
  }

  set source(source: PlotTraceSource | undefined) {
    this.#source = source;
    this.#listen();
  }

  override paint(snapshot: PlotSnapshot) {
    super.paint(snapshot);
    this.look(numberAttribute(this, "fill-to"));
    this.#draw();
  }

  protected override attached(plot: PlotElement) {
    super.attached(plot);
    this.#listen();
  }

  protected override detached() {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
  }

  /** Follows the source while connected to a plot. */
  #listen() {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    const source = this.#source;
    if (source && this.root) {
      this.#unsubscribe = source.subscribe(() => this.#draw());
    }
    this.#draw();
  }

  #draw() {
    const plot = this.root?.snapshot();
    if (!plot) {
      return;
    }
    const y: PlotAxis = {
      max: numberAttribute(this, "max") ?? plot.y.max,
      min: numberAttribute(this, "min") ?? plot.y.min,
      scale: plot.y.scale,
    };
    this.shape.setAttribute(
      "d",
      this.#source
        ? tracePath(
            this.#source.getSnapshot(),
            y,
            numberAttribute(this, "fill-to")
          )
        : ""
    );
  }
}

/**
 * A label at `value` on one `axis`, such as "1k" or "+12", positioned with
 * `left` (x, the default) or `top` (y). Offset it from the plot's edge with
 * CSS. Hidden from assistive technology, which reads the handles' values.
 * Carries `data-axis`.
 */
export class PlotMarkElement extends PlotPartElement {
  static readonly observedAttributes = ["axis", "value"];

  attributeChangedCallback() {
    this.repaint();
  }

  override paint(snapshot: PlotSnapshot) {
    super.paint(snapshot);
    const axis = axisOf(this);
    const value = numberAttribute(this, "value") ?? 0;
    reflect(this, { "aria-hidden": "true", "data-axis": axis });
    Object.assign(
      this.style,
      axis === "x"
        ? { left: `${positionOn(snapshot.x, value) * 100}%`, top: "" }
        : { left: "", top: `${(1 - positionOn(snapshot.y, value)) * 100}%` }
    );
  }
}

/** A live point, in the axes' units. */
export type PlotDotSource = Source<PlotPoint>;

/**
 * A non-interactive point, such as the input level on a compressor curve.
 * Follows the `source` property, or stays at its `value` (`"x y"`). Hidden
 * from assistive technology and ignores the pointer.
 */
export class PlotDotElement extends PlotPartElement {
  static readonly observedAttributes = ["value"];

  #source: PlotDotSource | undefined;
  #unsubscribe: (() => void) | undefined;

  attributeChangedCallback() {
    this.repaint();
  }

  /** A live point, followed as it changes. Overrides `value`. */
  get source(): PlotDotSource | undefined {
    return this.#source;
  }

  set source(source: PlotDotSource | undefined) {
    this.#source = source;
    this.#listen();
  }

  override paint(snapshot: PlotSnapshot) {
    super.paint(snapshot);
    this.setAttribute("aria-hidden", "true");
    const point = this.#source?.getSnapshot() ??
      pointAttribute(this, "value") ?? { x: snapshot.x.min, y: snapshot.y.min };
    Object.assign(this.style, placement(point, snapshot));
  }

  protected override attached() {
    this.#listen();
  }

  protected override detached() {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
  }

  #listen() {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    const source = this.#source;
    if (source && this.root) {
      this.#unsubscribe = source.subscribe(() => this.repaint());
    }
    this.repaint();
  }
}

/** The grid's settings for one axis, from its attributes. */
function gridAxis(grid: Element, axis: Axis, plot: PlotSnapshot) {
  const drawn = grid.getAttribute("axis") ?? "both";
  if (drawn !== "both" && drawn !== axis) {
    return [];
  }
  const given = listAttribute(grid, `${axis}-ticks`)
    .map(Number)
    .filter(Number.isFinite);
  return given.length > 0
    ? given
    : axisTicks(plot[axis], numberAttribute(grid, `${axis}-count`));
}

/** A grid line at `across` (0…1 from the left, or from the top for y), its value's. */
function gridLine(axis: Axis, across: number, value: number) {
  const line = document.createElementNS(SVG, "line");
  const [x1, x2, y1, y2] =
    axis === "x" ? [across, across, 0, 1] : [0, 1, across, across];
  reflect(line, {
    "data-axis": axis,
    "data-part": "line",
    "data-zero": value === 0 ? "" : null,
    x1: String(x1),
    x2: String(x2),
    y1: String(y1),
    y2: String(y2),
  });
  line.style.setProperty("vector-effect", "non-scaling-stroke");
  return line;
}

/** A grid label at `across`, as `left` for x and `top` for y. */
function gridLabel(axis: Axis, across: number, text: string) {
  const label = document.createElement("div");
  reflect(label, { "data-axis": axis, "data-part": "label" });
  label.style.position = "absolute";
  label.style[axis === "x" ? "left" : "top"] = `${across * 100}%`;
  label.textContent = text;
  return label;
}

/**
 * Grid lines and labels at round values along the axes. `axis` selects the
 * axes (`x`, `y` or `both`, the default), `x-ticks` and `y-ticks` set
 * positions, `x-count` and `y-count` the approximate count when positions
 * are not set (5), and `labels` the labelled axes (those drawn, or `none`).
 * The `format(value, axis)` property formats labels ("1k" by default).
 * Covers the plot, is hidden from assistive technology and ignores the
 * pointer. Lines carry `data-part="line"`, labels `data-part="label"`, both
 * `data-axis`, and the zero line `data-zero`.
 */
export class PlotGridElement extends PlotPartElement {
  static readonly observedAttributes = [
    "axis",
    "labels",
    "x-count",
    "x-ticks",
    "y-count",
    "y-ticks",
  ];

  #format: ((value: number, axis: Axis) => string) | undefined;
  #drawn = "";

  attributeChangedCallback() {
    this.repaint();
  }

  /** Text for a tick's label. Defaults to a short number such as "1k". */
  get format(): ((value: number, axis: Axis) => string) | undefined {
    return this.#format;
  }

  set format(format: ((value: number, axis: Axis) => string) | undefined) {
    this.#format = format;
    this.#drawn = "";
    this.repaint();
  }

  override paint(snapshot: PlotSnapshot) {
    super.paint(snapshot);
    this.setAttribute("aria-hidden", "true");
    const labelled = this.getAttribute("labels");
    const ticks = (["x", "y"] as const).map((axis) => ({
      axis,
      labels: labelled === null || labelled === "both" || labelled === axis,
      values: gridAxis(this, axis, snapshot),
    }));
    // Drawn again only when the lines would change: the plot paints its parts on every change of its axes.
    const drawn = JSON.stringify([ticks, snapshot.x, snapshot.y]);
    if (drawn === this.#drawn) {
      return;
    }
    this.#drawn = drawn;
    const svg = document.createElementNS(SVG, "svg");
    reflect(svg, {
      "aria-hidden": "true",
      height: "100%",
      preserveAspectRatio: "none",
      viewBox: "0 0 1 1",
      width: "100%",
    });
    Object.assign(svg.style, {
      inset: "0",
      overflow: "visible",
      position: "absolute",
    });
    const labels: HTMLElement[] = [];
    const format = this.#format ?? formatTick;
    for (const { axis, labels: labelledAxis, values } of ticks) {
      for (const value of values) {
        const position = positionOn(snapshot[axis], value);
        const across = axis === "x" ? position : 1 - position;
        svg.appendChild(gridLine(axis, across, value));
        if (labelledAxis) {
          labels.push(gridLabel(axis, across, format(value, axis)));
        }
      }
    }
    this.replaceChildren(svg, ...labels);
  }
}

/** The handle's attributes that name its inputs instead. */
const HANDLE_NAMES = [
  "aria-describedby",
  "aria-label",
  "aria-labelledby",
  "label-x",
  "label-y",
];

/** A neutral plot, for a handle not yet on one. */
const UNPLACED: PlotAxis = { max: 1, min: 0, scale: resolveScale("linear") };

/**
 * A draggable point in axis units, such as an equalizer band or a filter's
 * cutoff and resonance. `value` and `default-value` are `"x y"`; `axis`
 * (`x`, `y` or `both`) constrains movement. Drag is relative, never jumping
 * to the pointer, and four times finer with Shift; a double click, Alt +
 * click or Delete resets to `default-value`, or the plot's center. Contains
 * one native `<input type="range">` per movable axis: the first receives
 * focus, and the arrow keys move by a hundredth of the axis (a tenth with
 * Shift). `aria-label` labels the inputs ("Low X", "Low Y"); `label-x` and
 * `label-y` label each. Fires `input`, cancelable with `preventDefault()`,
 * and `change`. Carries `data-axis` and `data-dragging`.
 */
export class PlotHandleElement extends PlotPartElement {
  static readonly observedAttributes = [
    "axis",
    "default-value",
    "disabled",
    "value",
    ...HANDLE_NAMES,
  ];

  /** The framework-agnostic handle behind it: the drag, the keys, typed values. */
  readonly controller: PlotHandleController = createPlotHandleController({
    measure: () => null,
    x: UNPLACED,
    y: UNPLACED,
  });
  /** Returns an axis input's `aria-valuetext`, from its value. Defaults to the number. */
  getAriaValueText: ((value: number, axis: Axis) => string) | undefined;

  readonly #inputs: Record<Axis, HTMLInputElement> = {
    x: document.createElement("input"),
    y: document.createElement("input"),
  };
  readonly #names = new Map<string, string>();
  #value: PlotPoint | undefined;
  #release: AbortController | undefined;
  #stop: (() => void) | undefined;
  #format:
    | { format: Intl.NumberFormat; locale: string | undefined }
    | undefined;

  constructor() {
    super();
    for (const along of ["x", "y"] as const) {
      const input = this.#inputs[along];
      reflect(input, {
        "aria-orientation": along === "x" ? "horizontal" : "vertical",
        max: "1",
        min: "0",
        step: "any",
        type: "range",
      });
      hideVisually(input);
      input.addEventListener("keydown", (event) => {
        if (this.controller.keyDown(event)) {
          event.preventDefault();
        }
      });
      // Assistive technology may set an input's value directly; the handle reports it as its own change.
      input.addEventListener("input", (event) => {
        event.stopPropagation();
        this.controller.typeAt(along, Number(input.value), event);
      });
      input.addEventListener("change", (event) => event.stopPropagation());
    }
  }

  override addEventListener<K extends keyof PlotHandleElementEventMap>(
    type: K,
    listener: (
      this: PlotHandleElement,
      event: PlotHandleElementEventMap[K]
    ) => unknown,
    options?: boolean | AddEventListenerOptions
  ): void;
  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void;
  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) {
    super.addEventListener(type, listener, options);
  }

  attributeChangedCallback(
    name: string,
    _previous: string | null,
    next: string | null
  ) {
    if (HANDLE_NAMES.includes(name)) {
      // A name never stays on the handle, so only its own removal of it comes with no value.
      if (next === null) {
        return;
      }
      if (next === "") {
        this.#names.delete(name);
      } else {
        this.#names.set(name, next);
      }
      this.removeAttribute(name);
    } else if (name === "value") {
      this.#value = pointAttribute(this, "value");
    }
    this.repaint();
  }

  /** The handle's value, in the axes' units. Setting it moves the handle; subsequent gestures start from the new value. */
  get value(): PlotPoint {
    return this.controller.getSnapshot().value;
  }

  set value(value: PlotPoint | string) {
    // A framework may set the attribute's text form as the property.
    if (typeof value === "string") {
      this.setAttribute("value", value);
      return;
    }
    this.#value = { x: Number(value.x), y: Number(value.y) };
    this.repaint();
  }

  /** The first input, which takes focus. */
  get input(): HTMLInputElement {
    return this.#inputs[this.#axis() === "y" ? "y" : "x"];
  }

  override paint(plot: PlotSnapshot) {
    this.#configure(plot);
    this.#draw(plot);
  }

  protected override attached(plot: PlotElement) {
    this.#stop = this.controller.subscribe(() => this.#draw(plot.snapshot()));
    this.#release = new AbortController();
    const { signal } = this.#release;
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0 || this.controller.getSnapshot().disabled) {
          return;
        }
        event.preventDefault();
        if (!event.altKey) {
          this.input.focus({ focusVisible: false, preventScroll: true });
        }
        this.controller.press(event, this);
      },
      { signal }
    );
    this.addEventListener(
      "dblclick",
      (event) => {
        if (!this.controller.getSnapshot().disabled) {
          this.controller.reset(event);
        }
      },
      { signal }
    );
  }

  protected override detached() {
    this.#stop?.();
    this.#release?.abort();
  }

  #axis(): PlotHandleAxis {
    const axis = this.getAttribute("axis");
    return axis === "x" || axis === "y" ? axis : "both";
  }

  #configure(plot: PlotSnapshot) {
    const options: PlotHandleOptions = {
      axis: this.#axis(),
      defaultValue: pointAttribute(this, "default-value"),
      disabled: plot.disabled || this.hasAttribute("disabled"),
      measure: (fresh: boolean) => this.root?.measure(fresh) ?? null,
      onValueChange: (value, details) => {
        if (!reportChange(this, { reason: details.reason, value })) {
          details.cancel();
          return;
        }
        // A value set from outside is kept up to date, so the next gesture starts from it.
        if (this.#value !== undefined) {
          this.#value = value;
          this.controller.setOptions({ ...options, value });
        }
      },
      onValueCommitted: (value, details) =>
        reportCommit(this, { reason: details.reason, value }),
      value: this.#value,
      x: plot.x,
      y: plot.y,
    };
    this.controller.setOptions(options);
  }

  #draw(plot: PlotSnapshot) {
    const snapshot = this.controller.getSnapshot();
    reflect(this, {
      ...this.state(plot),
      "data-axis": snapshot.axis,
      "data-disabled": snapshot.disabled ? "" : null,
      "data-dragging": snapshot.dragging ? "" : null,
    });
    Object.assign(this.style, {
      left: `${snapshot.position.x * 100}%`,
      top: `${(1 - snapshot.position.y) * 100}%`,
    });
    const format = this.#formatter();
    for (const along of ["x", "y"] as const) {
      const input = this.#inputs[along];
      if (snapshot.axis !== "both" && snapshot.axis !== along) {
        input.remove();
        continue;
      }
      if (input.parentNode !== this) {
        this.appendChild(input);
      }
      const current = snapshot.value[along];
      const label = this.#label(along, snapshot.axis);
      input.value = String(snapshot.position[along]);
      input.disabled = snapshot.disabled;
      input.tabIndex = input === this.input ? 0 : -1;
      reflect(input, {
        "aria-describedby": this.#names.get("aria-describedby") ?? null,
        "aria-label": label,
        "aria-labelledby": label
          ? null
          : (this.#names.get("aria-labelledby") ?? null),
        "aria-valuetext":
          this.getAriaValueText?.(current, along) ?? format.format(current),
      });
    }
  }

  /** The name of the input for `along`: its own, or the handle's followed by the axis when it moves along both. */
  #label(along: Axis, axis: PlotHandleAxis): string | null {
    const shared = this.#names.get("aria-label");
    return (
      this.#names.get(`label-${along}`) ??
      (shared && axis === "both"
        ? `${shared} ${along.toUpperCase()}`
        : shared) ??
      null
    );
  }

  /** How the values are written, made again only for a new language: the handle draws on every frame of a drag. */
  #formatter(): Intl.NumberFormat {
    const locale = this.root ? localeOf(this.root) : undefined;
    if (!this.#format || this.#format.locale !== locale) {
      this.#format = {
        format: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
        locale,
      };
    }
    return this.#format.format;
  }
}

/** Set on the cursor: where the pointer is across the plot, as a share of its width. */
const CURSOR_X = "--plot-cursor-x";
/** Set on the cursor: where the pointer is down the plot, as a share of its height. */
const CURSOR_Y = "--plot-cursor-y";

/**
 * Tracks a mouse or pen over the plot, for crosshairs and readouts. Covers
 * the plot and ignores the pointer. Sets `--plot-cursor-x` and
 * `--plot-cursor-y` (0% to 100%) and `data-active` while the pointer is over
 * the plot. The `value` property is the point under the pointer in axis
 * units, or null.
 */
export class PlotCursorElement extends PlotPartElement {
  /** What is under the pointer, for the readout to follow. */
  readonly store: Store<PlotPoint | null> = createStore<PlotPoint | null>(null);
  #release: AbortController | undefined;

  /** The value under the pointer, in the axes' units, or null while it is not over the plot. */
  get value(): PlotPoint | null {
    return this.store.get();
  }

  override paint(snapshot: PlotSnapshot) {
    super.paint(snapshot);
    this.setAttribute("aria-hidden", "true");
  }

  protected override attached(plot: PlotElement) {
    this.#release = new AbortController();
    const { signal } = this.#release;
    plot.addEventListener("pointerenter", () => plot.measure(true), {
      signal,
    });
    plot.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerType === "touch") {
          return;
        }
        const rect = plot.measure();
        if (!rect) {
          return;
        }
        const across = Math.min(
          1,
          Math.max(0, (event.clientX - rect.left) / rect.width)
        );
        const down = Math.min(
          1,
          Math.max(0, (event.clientY - rect.top) / rect.height)
        );
        this.style.setProperty(CURSOR_X, `${across * 100}%`);
        this.style.setProperty(CURSOR_Y, `${down * 100}%`);
        this.setAttribute("data-active", "");
        const { x, y } = plot.snapshot();
        this.store.set({ x: valueOn(x, across), y: valueOn(y, 1 - down) });
      },
      { signal }
    );
    plot.addEventListener(
      "pointerleave",
      () => {
        this.removeAttribute("data-active");
        this.store.set(null);
      },
      { signal }
    );
  }

  protected override detached() {
    this.#release?.abort();
  }
}

/**
 * Renders the value under the pointer as text, inside an
 * `<audio-ui-plot-cursor>`. The `format` property formats it (`"x, y"` by
 * default). Positioned at the pointer; offset and style it with CSS.
 */
export class PlotCursorReadoutElement extends PlotPartElement {
  readonly #text = new ValueText();
  #format: ((value: PlotPoint) => string) | undefined;
  #cursor: PlotCursorElement | null = null;
  #stop: (() => void) | undefined;

  /** Turns the value under the pointer, in the axes' units, into the text shown. */
  get format(): ((value: PlotPoint) => string) | undefined {
    return this.#format;
  }

  set format(format: ((value: PlotPoint) => string) | undefined) {
    this.#format = format;
    this.#write();
  }

  protected override attached() {
    const cursor = this.closest(PLOT_TAGS.cursor);
    if (!(cursor instanceof PlotCursorElement)) {
      return;
    }
    this.#cursor = cursor;
    this.#text.mount(this);
    this.#stop = cursor.store.subscribe(() => this.#write());
    this.#write();
  }

  protected override detached() {
    this.#stop?.();
    this.#cursor = null;
  }

  #write() {
    const value = this.#cursor?.value;
    this.#text.write(
      value
        ? (this.#format?.(value) ??
            `${formatTick(value.x)}, ${formatTick(value.y)}`)
        : ""
    );
  }
}
