import type { RangeEdge, RangeValue } from "@audio-ui/core";
import {
  createRangeController,
  type RangeChangeEventDetails,
  type RangeCommitEventDetails,
  type RangeController,
  type RangeOptions,
  type TimelineSnapshot,
} from "@audio-ui/core/timeline";
import {
  listAttribute,
  numberAttribute,
  reflect,
} from "../internal/element.ts";
import {
  INPUT_NAMES,
  inputNames,
  rangeInput,
  takeName,
} from "../internal/input.ts";
import { reportChange, reportCommit } from "../internal/parts.ts";
import {
  describeNumber,
  LENGTH_PROPERTY,
  laneOf,
  placeOver,
  reflectOwn,
  TIMELINE_TAGS,
  type TimelineDescribe,
  type TimelineElement,
  TimelinePartElement,
  UNIT_PROPERTY,
} from "./root.ts";

/** A range attribute, `"start end"`, or `undefined` when it is missing or not two numbers. */
export function rangeAttribute(
  element: Element,
  name: string
): RangeValue | undefined {
  const [start, end] = listAttribute(element, name).map(Number);
  return start !== undefined &&
    end !== undefined &&
    Number.isFinite(start) &&
    Number.isFinite(end)
    ? [start, end]
    : undefined;
}

/** What a range's events carry: which edge moved, or `"both"`, and the range, `[start, end]` in the timeline's units. */
export interface TimelineRangeEventDetail<Reason extends string> {
  edge: RangeChangeEventDetails["edge"];
  reason: Reason;
  value: RangeValue;
}

/** The events a range fires, as `addEventListener` types them. */
export interface TimelineRangeElementEventMap extends HTMLElementEventMap {
  /** Fired once a gesture that moved the range ends. */
  rangechange: CustomEvent<
    TimelineRangeEventDetail<RangeCommitEventDetails["reason"]>
  >;
  /** Fired on every change of the range. Cancel it, with `preventDefault()`, to refuse it. */
  rangeinput: CustomEvent<
    TimelineRangeEventDetail<RangeChangeEventDetails["reason"]>
  >;
}

/**
 * A loop or selection on its lane, from `value` (`"start end"`; the whole
 * timeline by default). Its body is draggable on the grid, unless Cmd or
 * Ctrl is held or `movable="false"`; an `<audio-ui-timeline-range-handle>`
 * per edge resizes it. With `drawable`, a drag on empty lane draws a new
 * range. Its native `<input type="range">` carries the accessible name and
 * moves it from the keyboard: Left and Right by a step, Up and Down by its
 * length, and with Cmd or Ctrl, Left and Right shorten or lengthen it while
 * Up and Down double or halve it. Edges snap to `snap-points` within a few
 * pixels. Fires `rangeinput` with `{ value, edge, reason }`, cancelable with
 * `preventDefault()`, and `rangechange` when the interaction ends.
 * `min-length` sets the minimum length (the grid step by default) and
 * `min-drawn-width` the minimum drawn width in pixels. Carries
 * `data-dragging`.
 */
export class TimelineRangeElement extends TimelinePartElement {
  static readonly observedAttributes = [
    ...INPUT_NAMES,
    "default-value",
    "disabled",
    "drawable",
    "min-drawn-width",
    "min-length",
    "movable",
    "value",
  ];

  override addEventListener<K extends keyof TimelineRangeElementEventMap>(
    type: K,
    listener: (
      this: TimelineRangeElement,
      event: TimelineRangeElementEventMap[K]
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

  /** Returns how a position is announced, for the range and its handles. Defaults to the number. */
  getAriaValueText: TimelineDescribe | undefined;
  /** The framework-agnostic range behind every part: its span, drags, drawing and keys. */
  controller: RangeController | undefined;

  readonly #input = rangeInput();
  readonly #names = new Map<string, string>();
  readonly #handles = new Set<TimelineRangeHandleElement>();
  #value: RangeValue | undefined;
  #release: AbortController | undefined;
  #draw: AbortController | undefined;
  #stop: (() => void) | undefined;

  constructor() {
    super();
    this.#input.min = "0";
    this.#input.addEventListener("keydown", (event) => {
      if (this.controller?.keyDown(event)) {
        event.preventDefault();
      }
    });
    this.#input.addEventListener("input", (event) => {
      event.stopPropagation();
      this.controller?.moveTypeAt(Number(this.#input.value), event);
    });
    this.#input.addEventListener("change", (event) => event.stopPropagation());
  }

  attributeChangedCallback(
    name: string,
    _previous: string | null,
    next: string | null
  ) {
    if (INPUT_NAMES.includes(name)) {
      if (takeName(this, this.#names, name, next)) {
        reflect(this.#input, inputNames(this.#names));
      }
      return;
    }
    if (name === "value") {
      this.#value = rangeAttribute(this, "value");
    }
    this.repaint();
  }

  /** The range, `[start, end]` in the timeline's units. Setting it moves the range; subsequent gestures start from the new value. */
  get value(): RangeValue {
    return this.controller?.getSnapshot().value ?? this.#value ?? [0, 0];
  }

  set value(value: RangeValue | string) {
    // A framework may set the attribute's text form as the property.
    if (typeof value === "string") {
      this.setAttribute("value", value);
      return;
    }
    this.#value = [Number(value[0]), Number(value[1])];
    this.repaint();
  }

  /** Called by a handle as it connects: drawn at once, then on every change. */
  attach(handle: TimelineRangeHandleElement) {
    this.#handles.add(handle);
    handle.draw();
  }

  detach(handle: TimelineRangeHandleElement) {
    this.#handles.delete(handle);
  }

  /** Starts a drag of `edge` from `handle`, unless the range is disabled. Returns whether it started. */
  press(edge: RangeEdge, event: PointerEvent, handle: Element) {
    if (event.button !== 0) {
      return false;
    }
    // The press stops here, so the lane underneath doesn't take it.
    event.stopPropagation();
    const { controller } = this;
    if (!controller || controller.getSnapshot().disabled) {
      return false;
    }
    event.preventDefault();
    controller.press(edge, event, handle, laneOf(this));
    return true;
  }

  override paint(snapshot: TimelineSnapshot) {
    const timeline = this.root;
    if (!timeline) {
      return;
    }
    const options = this.#options(timeline, snapshot);
    if (this.controller) {
      this.controller.setOptions(options);
    } else {
      this.controller = createRangeController(options);
      this.#stop = this.controller.subscribe(() => this.#drawAll());
    }
    this.#listenForDrawing();
    this.#drawAll();
  }

  protected override attached() {
    if (this.#input.parentNode !== this) {
      this.appendChild(this.#input);
    }
    reflect(this.#input, inputNames(this.#names));
    this.#release = new AbortController();
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (this.getAttribute("movable") === "false") {
          if (event.button === 0) {
            event.stopPropagation();
          }
          return;
        }
        this.press("both", event, this);
      },
      { signal: this.#release.signal }
    );
  }

  protected override detached() {
    this.#release?.abort();
    this.#draw?.abort();
    this.#draw = undefined;
    this.#stop?.();
    this.#stop = undefined;
    this.controller = undefined;
  }

  #options(timeline: TimelineElement, snapshot: TimelineSnapshot) {
    const { grid, largeStep, step } = timeline.settings;
    const options: RangeOptions = {
      defaultValue: rangeAttribute(this, "default-value"),
      disabled: snapshot.disabled || this.hasAttribute("disabled"),
      drawable: this.hasAttribute("drawable"),
      duration: snapshot.duration,
      grid,
      largeStep,
      minDrawnWidth: numberAttribute(this, "min-drawn-width") ?? 0,
      minLength:
        numberAttribute(this, "min-length") ??
        (grid.step > 0 ? grid.step : step),
      movable: this.getAttribute("movable") !== "false",
      onValueChange: (value, details) => {
        const detail = { edge: details.edge, reason: details.reason, value };
        if (!reportChange(this, detail, "rangeinput")) {
          details.cancel();
          return;
        }
        // A range set from outside is kept up to date, so the next gesture starts from it.
        if (this.#value !== undefined) {
          this.#value = value;
          this.controller?.setOptions({ ...options, value });
        }
      },
      onValueCommitted: (value, details) =>
        reportCommit(
          this,
          { edge: details.edge, reason: details.reason, value },
          "rangechange"
        ),
      step,
      value: this.#value,
      zoom: snapshot.zoom,
    };
    return options;
  }

  /** Listens for a press on the empty lane while the range is `drawable`. */
  #listenForDrawing() {
    const lane = laneOf(this);
    const drawable = this.hasAttribute("drawable");
    if (drawable === Boolean(this.#draw) || !lane) {
      return;
    }
    this.#draw?.abort();
    this.#draw = undefined;
    if (drawable) {
      this.#draw = new AbortController();
      lane.addEventListener(
        "pointerdown",
        (event) => {
          if (!this.controller?.getSnapshot().disabled) {
            this.controller?.pressDraw(event, lane);
          }
        },
        { signal: this.#draw.signal }
      );
    }
  }

  #drawAll() {
    const { controller, root: timeline } = this;
    if (!(timeline && controller)) {
      return;
    }
    const { disabled, dragging, value } = controller.getSnapshot();
    const [start, end] = value;
    const length = end - start;
    reflectOwn(this, timeline.snapshot(), {
      "data-disabled": disabled ? "" : null,
      "data-dragging": dragging ? "" : null,
    });
    placeOver(this, start, length);
    const minDrawnWidth = numberAttribute(this, "min-drawn-width") ?? 0;
    const width = `calc(var(${UNIT_PROPERTY}) * var(${LENGTH_PROPERTY}))`;
    this.style.width =
      minDrawnWidth > 0
        ? `max(${width}, calc(${minDrawnWidth}px + ${width} / 2))`
        : "";
    const { duration } = timeline.settings;
    const describe = this.getAriaValueText ?? describeNumber;
    const input = this.#input;
    input.hidden = this.getAttribute("movable") === "false";
    input.max = String(Math.max(0, duration - length));
    input.value = String(start);
    input.disabled = disabled;
    input.setAttribute(
      "aria-valuetext",
      `${describe(start, duration)} to ${describe(end, duration)}`
    );
    for (const handle of this.#handles) {
      handle.draw();
    }
  }
}

/**
 * Resizes the `edge` (`start` or `end`) of its range by drag, on the grid
 * unless Cmd or Ctrl is held, or through the native `<input type="range">`
 * it contains, which carries the accessible name. Carries `data-edge`.
 */
export class TimelineRangeHandleElement extends TimelinePartElement {
  static readonly observedAttributes = [...INPUT_NAMES, "edge"];

  readonly #input = rangeInput();
  readonly #names = new Map<string, string>();
  #range: TimelineRangeElement | null = null;
  #release: AbortController | undefined;

  constructor() {
    super();
    this.#input.addEventListener("keydown", (event) => {
      if (this.#range?.controller?.edgeKeyDown(this.#edge(), event)) {
        event.preventDefault();
      }
    });
    this.#input.addEventListener("input", (event) => {
      event.stopPropagation();
      this.#range?.controller?.edgeTypeAt(
        this.#edge(),
        Number(this.#input.value),
        event
      );
    });
    this.#input.addEventListener("change", (event) => event.stopPropagation());
  }

  attributeChangedCallback(
    name: string,
    _previous: string | null,
    next: string | null
  ) {
    if (name === "edge") {
      this.draw();
    } else if (takeName(this, this.#names, name, next)) {
      reflect(this.#input, inputNames(this.#names));
    }
  }

  override paint() {
    this.draw();
  }

  /** Draws the handle from its range. */
  draw() {
    const range = this.#range;
    const controller = range?.controller;
    const timeline = this.root;
    if (!(range && controller && timeline)) {
      return;
    }
    const edge = this.#edge();
    const { disabled, dragging, value } = controller.getSnapshot();
    const current = edge === "start" ? value[0] : value[1];
    // How far this edge can go before it meets the other one.
    const [min, max] = controller.edgeRange(edge);
    reflectOwn(this, timeline.snapshot(), {
      "data-disabled": disabled ? "" : null,
      "data-dragging": dragging ? "" : null,
      "data-edge": edge,
    });
    const input = this.#input;
    input.min = String(min);
    input.max = String(max);
    input.value = String(current);
    input.disabled = disabled;
    input.setAttribute(
      "aria-valuetext",
      (range.getAriaValueText ?? describeNumber)(
        current,
        timeline.settings.duration
      )
    );
  }

  protected override attached() {
    const range = this.closest(TIMELINE_TAGS.range);
    if (!(range instanceof TimelineRangeElement)) {
      return;
    }
    this.#range = range;
    if (this.#input.parentNode !== this) {
      this.appendChild(this.#input);
    }
    reflect(this.#input, inputNames(this.#names));
    this.#release = new AbortController();
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (range.press(this.#edge(), event, this)) {
          this.#input.focus({ focusVisible: false, preventScroll: true });
        }
      },
      { signal: this.#release.signal }
    );
    range.attach(this);
  }

  protected override detached() {
    this.#release?.abort();
    this.#range?.detach(this);
    this.#range = null;
  }

  #edge(): "end" | "start" {
    return this.getAttribute("edge") === "end" ? "end" : "start";
  }
}
