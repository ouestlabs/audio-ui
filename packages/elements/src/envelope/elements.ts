import {
  type Breakpoint,
  createEnvelopeController,
  type EnvelopeChangeEventReason,
  type EnvelopeCommitEventReason,
  type EnvelopeController,
  type EnvelopeOptions,
  type EnvelopeSnap,
  type EnvelopeSnapshot,
  polylinePoints,
  segmentShape,
} from "@audio-ui/core/envelope";
import {
  jsonAttribute,
  listAttribute,
  localeOf,
  numberAttribute,
  reflect,
} from "../internal/element.ts";
import {
  ControlPart,
  ControlRoot,
  reportChange,
  reportCommit,
} from "../internal/parts.ts";
import { Stamp } from "../internal/stamp.ts";

/** The names the envelope's elements are registered under, frozen: a page cannot rename them by accident. */
export const ENVELOPE_TAGS = Object.freeze({
  fill: "audio-ui-envelope-fill",
  graph: "audio-ui-envelope-graph",
  line: "audio-ui-envelope-line",
  point: "audio-ui-envelope-point",
  points: "audio-ui-envelope-points",
  root: "audio-ui-envelope",
  segment: "audio-ui-envelope-segment",
  segments: "audio-ui-envelope-segments",
});

/** What an envelope's `input` and `change` events carry, besides the envelope itself as their target. */
export interface EnvelopeEventDetail<Reason extends string> {
  /** The point that moved, was added or removed, or that the bent segment leaves from. */
  index: number;
  /** What changed it: `drag`, `keyboard`, `add`, `remove` or `curve`. */
  reason: Reason;
  value: Breakpoint[];
}

/** Fired on every change. Cancel it, with `preventDefault()`, to refuse the points. */
export type EnvelopeInputEvent = CustomEvent<
  EnvelopeEventDetail<EnvelopeChangeEventReason>
>;
/** Fired once an interaction that changed the points ends. */
export type EnvelopeChangeEvent = CustomEvent<
  EnvelopeEventDetail<EnvelopeCommitEventReason>
>;

/** The events an envelope fires, as `addEventListener` types them. */
export interface EnvelopeElementEventMap
  extends Omit<HTMLElementEventMap, "change" | "input"> {
  change: EnvelopeChangeEvent;
  input: EnvelopeInputEvent;
}

const SVG = "http://www.w3.org/2000/svg";
const WHITESPACE = /\s+/;

/**
 * A points attribute: points separated by commas, each `x y` or `x y curve`
 * in 0…1 (`"0 0, 0.2 1 0.5, 1 0"`), or `undefined` when it is missing or
 * holds anything else.
 */
function pointsAttribute(
  element: Element,
  name: string
): Breakpoint[] | undefined {
  const text = element.getAttribute(name)?.trim();
  if (!text) {
    return;
  }
  const points: Breakpoint[] = [];
  for (const entry of text.split(",")) {
    const numbers = entry.trim().split(WHITESPACE).map(Number);
    const [x, y, curve] = numbers;
    if (
      numbers.length > 3 ||
      x === undefined ||
      y === undefined ||
      !numbers.every(Number.isFinite)
    ) {
      return;
    }
    points.push(curve === undefined ? { x, y } : { curve, x, y });
  }
  return points;
}

/** The `snap` attribute: one step for both axes, or `x y` for each. */
function snapAttribute(element: Element): EnvelopeSnap | undefined {
  const [x, y] = listAttribute(element, "snap").map(Number);
  if (x === undefined || !Number.isFinite(x)) {
    return;
  }
  return y !== undefined && Number.isFinite(y) ? { x, y } : x;
}

/** The state every part carries, as the React parts do: `data-disabled`, `data-dragging`. */
const stateAttributes = (snapshot: EnvelopeSnapshot) => ({
  "data-disabled": snapshot.disabled ? "" : null,
  "data-dragging": snapshot.dragging ? "" : null,
});

/** The point under the pointer, as 0…1 of `element`'s box, or null while it has no size. */
function pointIn(element: Element, event: MouseEvent) {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return {
    x: (event.clientX - rect.left) / rect.width,
    y: 1 - (event.clientY - rect.top) / rect.height,
  };
}

/**
 * The root of a breakpoint envelope editor, with `role="group"`. Owns the
 * points and positions them (`position: relative`). Fires `input` on every
 * change, cancelable with `preventDefault()`, and `change` when an
 * interaction that changed the points ends. Attributes mirror the props of
 * the React `Envelope.Root`: `value` and `default-value` as points separated
 * by commas, each `x y` or `x y curve` from 0 to 1 (`"0 0, 0.2 1, 1 0"`),
 * `disabled`, `format` (`Intl.NumberFormat` options as JSON), `locale`,
 * `max-points`, `min-points` (2), `snap` (a grid step, or `x y` per axis)
 * and `step` (keyboard step, 0.01). Label it with `aria-label`.
 */
export class EnvelopeElement extends ControlRoot<EnvelopeSnapshot> {
  static readonly observedAttributes = [
    "default-value",
    "disabled",
    "format",
    "locale",
    "max-points",
    "min-points",
    "snap",
    "step",
    "value",
  ];

  /** The framework-agnostic envelope behind every part: gestures, keys, adds, removes, bends. */
  readonly controller: EnvelopeController = createEnvelopeController();
  /** The drawing surface the pointer is measured against. */
  graph: HTMLElement | null = null;
  /** The handles of the points and of the segments, by index, for the keys to move focus to. */
  readonly pointNodes = new Map<number, HTMLElement>();
  readonly segmentNodes = new Map<number, HTMLElement>();
  /** Returns a point's `aria-valuetext`. Defaults to the formatted `x, y`. */
  getPointValueText: ((point: Breakpoint, index: number) => string) | undefined;
  /** Returns a segment handle's `aria-valuetext`. Defaults to the curve as a number. */
  getCurveValueText: ((curve: number, index: number) => string) | undefined;

  #value: Breakpoint[] | undefined;
  #format: Intl.NumberFormatOptions | undefined;
  #focusedPoint = 0;
  #focusedSegment = 0;

  override connectedCallback() {
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "group");
    }
    super.connectedCallback();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.controller.dispose();
  }

  attributeChangedCallback(name: string) {
    if (name === "value") {
      this.#value = pointsAttribute(this, "value");
    }
    this.configure();
    this.paint();
  }

  override addEventListener<K extends keyof EnvelopeElementEventMap>(
    type: K,
    listener: (
      this: EnvelopeElement,
      event: EnvelopeElementEventMap[K]
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

  /** The points as displayed, in `x` order. Setting them reshapes the envelope; subsequent gestures start from the new value. */
  get value(): Breakpoint[] {
    return this.controller.getSnapshot().value;
  }

  set value(value: Breakpoint[]) {
    this.#value = value;
    this.configure();
    this.paint();
  }

  /** How point coordinates are written: `Intl.NumberFormat` options. Overrides the `format` attribute. */
  get format(): Intl.NumberFormatOptions | undefined {
    return this.#format ?? jsonAttribute(this, "format");
  }

  set format(format: Intl.NumberFormatOptions | undefined) {
    this.#format = format;
    this.configure();
    this.paint();
  }

  /** The point that is the tab stop. */
  get focusedPoint(): number {
    return Math.min(this.#focusedPoint, this.value.length - 1);
  }

  /** The segment handle that is the tab stop. */
  get focusedSegment(): number {
    return Math.min(this.#focusedSegment, this.value.length - 2);
  }

  /** Makes the point at `index` the tab stop, without moving focus. */
  setFocusedPoint(index: number) {
    if (index !== this.#focusedPoint) {
      this.#focusedPoint = index;
      this.paint();
    }
  }

  setFocusedSegment(index: number) {
    if (index !== this.#focusedSegment) {
      this.#focusedSegment = index;
      this.paint();
    }
  }

  /** Moves focus to the point at `index`, which becomes the tab stop. */
  focusPoint(index: number) {
    this.setFocusedPoint(index);
    this.pointNodes.get(index)?.focus();
  }

  /** Moves focus to the segment handle at `index`, kept within the segments. */
  focusSegment(index: number) {
    const target = Math.min(this.value.length - 2, Math.max(0, index));
    this.setFocusedSegment(target);
    this.segmentNodes.get(target)?.focus();
  }

  /** Adds a point at `at` (0…1 of the graph), which becomes the tab stop. */
  addPoint(at: { x: number; y: number }, event: MouseEvent) {
    const index = this.controller.addPointAt(at, event);
    if (index !== null) {
      this.setFocusedPoint(index);
    }
  }

  /** Removes a point and moves focus to the one that takes its place. */
  removePoint(index: number, event: MouseEvent | KeyboardEvent) {
    if (this.controller.removePoint(index, event)) {
      this.focusPoint(Math.min(index, this.value.length - 1));
    }
  }

  protected snapshot() {
    return this.controller.getSnapshot();
  }

  protected subscribe(listener: () => void) {
    return this.controller.subscribe(listener);
  }

  protected rootAttributes(snapshot: EnvelopeSnapshot) {
    return stateAttributes(snapshot);
  }

  protected configure() {
    const options: EnvelopeOptions = {
      defaultValue: pointsAttribute(this, "default-value"),
      disabled: this.hasAttribute("disabled"),
      format: this.format,
      locale: localeOf(this),
      maxPoints: numberAttribute(this, "max-points"),
      minPoints: numberAttribute(this, "min-points"),
      onValueChange: (value, details) => {
        const detail = { index: details.index, reason: details.reason, value };
        if (!reportChange(this, detail)) {
          details.cancel();
          return;
        }
        // Points set from outside are kept up to date, so the next gesture starts from them.
        if (this.#value !== undefined) {
          this.#value = value;
          this.controller.setOptions({ ...options, value });
        }
      },
      onValueCommitted: (value, details) =>
        reportCommit(this, {
          index: details.index,
          reason: details.reason,
          value,
        }),
      snap: snapAttribute(this),
      step: numberAttribute(this, "step"),
      value: this.#value,
    };
    this.controller.setOptions(options);
  }
}

/** What every part of the envelope does: find its envelope, and carry its state. */
abstract class EnvelopePartElement extends ControlPart<
  EnvelopeElement,
  EnvelopeSnapshot
> {
  protected readonly rootTag = ENVELOPE_TAGS.root;

  protected isRoot(element: Element | null) {
    return element instanceof EnvelopeElement;
  }

  protected state(snapshot: EnvelopeSnapshot): Record<string, string | null> {
    return stateAttributes(snapshot);
  }
}

/**
 * The drawing surface, filling the envelope (`position: absolute; inset: 0`)
 * and containing the line and the fill. A double click adds a point. With
 * Alt held, a drag bends the segment under the pointer and a double click
 * straightens it. Carries `data-blocked` briefly when adding is refused at
 * `max-points`.
 */
export class EnvelopeGraphElement extends EnvelopePartElement {
  #release: AbortController | undefined;

  override paint(snapshot: EnvelopeSnapshot) {
    super.paint(snapshot);
    reflect(this, { "data-blocked": snapshot.isAddBlocked ? "" : null });
  }

  protected override attached(envelope: EnvelopeElement) {
    envelope.graph = this;
    this.#release = new AbortController();
    const { signal } = this.#release;
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (
          envelope.controller.getSnapshot().disabled ||
          !event.altKey ||
          event.button !== 0
        ) {
          return;
        }
        event.preventDefault();
        envelope.controller.pressBend(event, this);
      },
      { signal }
    );
    this.addEventListener(
      "dblclick",
      (event) => {
        const at = pointIn(this, event);
        if (!at) {
          return;
        }
        if (event.altKey) {
          envelope.controller.straightenAt(at, event);
          return;
        }
        envelope.addPoint(at, event);
      },
      { signal }
    );
  }

  protected override detached(envelope: EnvelopeElement) {
    this.#release?.abort();
    if (envelope.graph === this) {
      envelope.graph = null;
    }
  }
}

/** A curve drawn in a stretched 100×100 SVG that fills the graph, in `currentColor`. */
abstract class EnvelopeDrawingElement extends EnvelopePartElement {
  readonly #svg = document.createElementNS(SVG, "svg");
  protected readonly polyline = document.createElementNS(SVG, "polyline");

  constructor() {
    super();
    reflect(this.#svg, {
      "aria-hidden": "true",
      preserveAspectRatio: "none",
      viewBox: "0 0 100 100",
    });
    Object.assign(this.#svg.style, {
      display: "block",
      height: "100%",
      overflow: "visible",
      width: "100%",
    });
    this.#svg.appendChild(this.polyline);
  }

  protected override attached() {
    if (this.#svg.parentNode !== this) {
      this.appendChild(this.#svg);
    }
  }
}

/**
 * The curve through the points, in `currentColor`, with a stroke width that
 * stays constant as the graph scales. Set it with `stroke-width`.
 */
export class EnvelopeLineElement extends EnvelopeDrawingElement {
  constructor() {
    super();
    reflect(this.polyline, { fill: "none", stroke: "currentColor" });
    this.polyline.style.setProperty("vector-effect", "non-scaling-stroke");
  }

  override paint(snapshot: EnvelopeSnapshot) {
    super.paint(snapshot);
    this.polyline.setAttribute("points", polylinePoints(snapshot.value));
  }
}

/** The area under the curve, in `currentColor`. */
export class EnvelopeFillElement extends EnvelopeDrawingElement {
  constructor() {
    super();
    reflect(this.polyline, { fill: "currentColor", stroke: "none" });
  }

  override paint(snapshot: EnvelopeSnapshot) {
    super.paint(snapshot);
    const points = polylinePoints(snapshot.value);
    this.polyline.setAttribute(
      "points",
      points ? `${points} 100,100 0,100` : ""
    );
  }
}

/** The name of the handle at `index` from the `label` of the element that made it, `{n}` its number from 1 and `{count}` how many there are. */
function stampedLabel(
  handle: Element,
  maker: string,
  fallback: string,
  index: number,
  count: number
) {
  const made = handle.parentElement?.localName === maker;
  return made
    ? (handle.parentElement?.getAttribute("label") ?? fallback)
        .replaceAll("{n}", String(index + 1))
        .replaceAll("{count}", String(count))
    : null;
}

/** Makes one handle per key, from its `<template>`, again whenever their number changes. */
abstract class EnvelopeMakerElement extends EnvelopePartElement {
  #count = -1;

  protected abstract readonly stamp: Stamp;

  /** How many handles the points call for. */
  protected abstract count(snapshot: EnvelopeSnapshot): number;

  override paint(snapshot: EnvelopeSnapshot) {
    const count = Math.max(0, this.count(snapshot));
    if (count !== this.#count) {
      this.#count = count;
      this.stamp.update(Array.from({ length: count }, (_, index) => index));
    }
  }

  protected override attached() {
    this.stamp.connect();
  }

  protected override detached() {
    this.stamp.disconnect();
  }

  protected override state() {
    return {};
  }
}

/**
 * Generates an `<audio-ui-envelope-point>` per point, in `x` order, from its
 * `<template>` when present. `label` names the points, with `{n}` and
 * `{count}` placeholders ("Point {n} of {count}" by default). Renders with
 * `display: contents`.
 */
export class EnvelopePointsElement extends EnvelopeMakerElement {
  protected readonly stamp = new Stamp(this, ENVELOPE_TAGS.point, "index");

  protected count(snapshot: EnvelopeSnapshot) {
    return snapshot.value.length;
  }
}

/**
 * Generates an `<audio-ui-envelope-segment>` per segment, from its
 * `<template>` when present. `label` names the segments, with `{n}` and
 * `{count}` placeholders ("Curve {n}" by default). Renders with `display:
 * contents`.
 */
export class EnvelopeSegmentsElement extends EnvelopeMakerElement {
  protected readonly stamp = new Stamp(this, ENVELOPE_TAGS.segment, "index");

  protected count(snapshot: EnvelopeSnapshot) {
    return snapshot.value.length - 1;
  }
}

/** A handle on a point or a segment: its `index`, and its place in the envelope's map of handles. */
abstract class EnvelopeHandleElement extends EnvelopePartElement {
  #release: AbortController | undefined;

  /** Which point it is, or which point its segment leaves from, in `x` order. */
  get index(): number {
    return numberAttribute(this, "index") ?? 0;
  }

  protected abstract nodes(envelope: EnvelopeElement): Map<number, HTMLElement>;

  protected abstract listen(
    envelope: EnvelopeElement,
    signal: AbortSignal
  ): void;

  protected override attached(envelope: EnvelopeElement) {
    this.nodes(envelope).set(this.index, this);
    this.setAttribute("role", "slider");
    this.#release = new AbortController();
    this.listen(envelope, this.#release.signal);
  }

  protected override detached(envelope: EnvelopeElement) {
    this.#release?.abort();
    const nodes = this.nodes(envelope);
    if (nodes.get(this.index) === this) {
      nodes.delete(this.index);
    }
  }
}

/** Page Up and Page Down, Home and End: the point they move focus to from `index`, out of `count`. */
function pointMove(key: string, index: number, count: number) {
  const last = count - 1;
  const moves: Record<string, number> = {
    End: last,
    Home: 0,
    PageDown: Math.max(0, index - 1),
    PageUp: Math.min(last, index + 1),
  };
  return moves[key];
}

/**
 * A draggable handle for the point at `index`, positioned with `left` and
 * `bottom`. A `role="slider"` on the point's level. The points share one tab
 * stop: Page Up and Page Down (or Home and End) move between points, the
 * arrow keys move the point (Shift for larger steps), and Delete, Alt +
 * click or a double click removes it. Carries `data-dragging`,
 * `data-removable`, and `data-blocked` briefly when removal is refused at
 * `min-points`.
 */
export class EnvelopePointElement extends EnvelopeHandleElement {
  override paint(snapshot: EnvelopeSnapshot) {
    const { index } = this;
    const point = snapshot.value[index];
    if (!point) {
      return;
    }
    const envelope = this.root;
    this.tabIndex =
      snapshot.disabled || index !== envelope?.focusedPoint ? -1 : 0;
    Object.assign(this.style, {
      bottom: `${point.y * 100}%`,
      left: `${point.x * 100}%`,
    });
    const label = stampedLabel(
      this,
      ENVELOPE_TAGS.points,
      "Point {n} of {count}",
      index,
      snapshot.value.length
    );
    reflect(this, {
      "aria-disabled": snapshot.disabled ? "true" : null,
      "aria-valuemax": "1",
      "aria-valuemin": "0",
      "aria-valuenow": String(point.y),
      "aria-valuetext":
        envelope?.getPointValueText?.(point, index) ??
        envelope?.controller.formatPoint(point.x, point.y) ??
        null,
      "data-blocked": snapshot.blockedIndex === index ? "" : null,
      "data-disabled": snapshot.disabled ? "" : null,
      "data-dragging": snapshot.draggingIndex === index ? "" : null,
      "data-removable": snapshot.value.length > snapshot.minPoints ? "" : null,
    });
    if (label) {
      this.setAttribute("aria-label", label);
    }
  }

  protected nodes(envelope: EnvelopeElement) {
    return envelope.pointNodes;
  }

  protected listen(envelope: EnvelopeElement, signal: AbortSignal) {
    const disabled = () => envelope.controller.getSnapshot().disabled;
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (disabled() || event.button !== 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        // Alt + click removes the point.
        if (event.altKey) {
          envelope.removePoint(this.index, event);
          return;
        }
        if (!envelope.graph) {
          return;
        }
        this.focus({ focusVisible: false, preventScroll: true });
        envelope.setFocusedPoint(this.index);
        envelope.controller.pressPoint(this.index, event, this, envelope.graph);
      },
      { signal }
    );
    this.addEventListener(
      "dblclick",
      (event) => {
        event.stopPropagation();
        envelope.removePoint(this.index, event);
      },
      { signal }
    );
    this.addEventListener(
      "keydown",
      (event) => {
        if (disabled()) {
          return;
        }
        if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          envelope.removePoint(this.index, event);
          return;
        }
        // The points share one tab stop: these keys move between them.
        const move = pointMove(event.key, this.index, envelope.value.length);
        if (move !== undefined) {
          event.preventDefault();
          envelope.focusPoint(move);
          return;
        }
        if (envelope.controller.keyPoint(this.index, event)) {
          event.preventDefault();
        }
      },
      { signal }
    );
    this.addEventListener("focus", () => envelope.setFocusedPoint(this.index), {
      signal,
    });
  }
}

/**
 * A curve handle at the midpoint of the segment that starts at point
 * `index`, a `role="slider"` from -1 to 1. Dragging bends the segment so its
 * midpoint follows the pointer. The handles share one tab stop: Left and
 * Right move between them, Up and Down bend (Shift for larger steps), and a
 * double click or Delete straightens. Carries `data-flat` when the segment
 * joins two points of equal level, and `data-dragging` while bent.
 */
export class EnvelopeSegmentElement extends EnvelopeHandleElement {
  override paint(snapshot: EnvelopeSnapshot) {
    const { index } = this;
    const from = snapshot.value[index];
    const to = snapshot.value[index + 1];
    if (!(from && to)) {
      return;
    }
    const envelope = this.root;
    const curve = from.curve ?? 0;
    const flat = Math.abs(to.y - from.y) < 1e-6;
    this.tabIndex =
      snapshot.disabled || index !== envelope?.focusedSegment ? -1 : 0;
    Object.assign(this.style, {
      bottom: `${(from.y + (to.y - from.y) * segmentShape(0.5, from.curve)) * 100}%`,
      left: `${((from.x + to.x) / 2) * 100}%`,
    });
    const label = stampedLabel(
      this,
      ENVELOPE_TAGS.segments,
      "Curve {n}",
      index,
      snapshot.value.length - 1
    );
    reflect(this, {
      "aria-disabled": snapshot.disabled || flat ? "true" : null,
      "aria-valuemax": "1",
      "aria-valuemin": "-1",
      "aria-valuenow": String(curve),
      "aria-valuetext":
        envelope?.getCurveValueText?.(curve, index) ??
        String(Math.round(curve * 100) / 100),
      "data-disabled": snapshot.disabled ? "" : null,
      "data-dragging": snapshot.draggingSegmentIndex === index ? "" : null,
      "data-flat": flat ? "" : null,
    });
    if (label) {
      this.setAttribute("aria-label", label);
    }
  }

  protected nodes(envelope: EnvelopeElement) {
    return envelope.segmentNodes;
  }

  protected listen(envelope: EnvelopeElement, signal: AbortSignal) {
    this.addEventListener(
      "pointerdown",
      (event) => {
        const snapshot = envelope.controller.getSnapshot();
        if (
          snapshot.disabled ||
          this.hasAttribute("data-flat") ||
          event.button !== 0
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (!envelope.graph) {
          return;
        }
        this.focus({ focusVisible: false, preventScroll: true });
        envelope.setFocusedSegment(this.index);
        envelope.controller.pressSegment(
          this.index,
          event,
          this,
          envelope.graph
        );
      },
      { signal }
    );
    this.addEventListener(
      "dblclick",
      (event) => {
        event.stopPropagation();
        envelope.controller.straightenSegment(this.index, event);
      },
      { signal }
    );
    this.addEventListener(
      "keydown",
      (event) => {
        if (envelope.controller.getSnapshot().disabled) {
          return;
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          envelope.focusSegment(
            this.index + (event.key === "ArrowRight" ? 1 : -1)
          );
          return;
        }
        if (envelope.controller.keySegment(this.index, event)) {
          event.preventDefault();
        }
      },
      { signal }
    );
    this.addEventListener(
      "focus",
      () => envelope.setFocusedSegment(this.index),
      { signal }
    );
  }
}
