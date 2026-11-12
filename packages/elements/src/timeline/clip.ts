import {
  type ChangeEventDetails,
  createChangeEventDetails,
} from "@audio-ui/core";
import {
  type ClipController,
  type ClipOptions,
  type ClipTarget,
  type ClipValue,
  clipEnd,
  createClipController,
  FADE_SHAPES,
  type FadeShape,
  fadeGain,
  type TimelineSnapshot,
} from "@audio-ui/core/timeline";
import { numberAttribute, reflect } from "../internal/element.ts";
import {
  INPUT_NAMES,
  inputNames,
  rangeInput,
  takeName,
} from "../internal/input.ts";
import { reportChange, reportCommit } from "../internal/parts.ts";
import {
  describeNumber,
  laneOf,
  placeOver,
  reflectOwn,
  TIMELINE_TAGS,
  type TimelineDescribe,
  type TimelineElement,
  TimelinePartElement,
} from "./root.ts";

/** The clip's attributes, each a field of its value. */
const VALUE_ATTRIBUTES = {
  "fade-in": "fadeIn",
  "fade-out": "fadeOut",
  length: "length",
  offset: "offset",
  start: "start",
} as const;

const SVG = "http://www.w3.org/2000/svg";

/** A fade shape attribute, or `undefined`. */
function shapeAttribute(element: Element, name: string): FadeShape | undefined {
  const shape = element.getAttribute(name);
  return FADE_SHAPES.find((each) => each === shape);
}

/** What a clip's events carry, besides the clip itself as their target. */
export interface TimelineClipEventDetail {
  /** Whether Alt was held when the drag began: the clip is meant to be copied to where it lands. */
  copy?: boolean;
  /** For a move: how far the clip moved, in the timeline's units. */
  delta?: number;
  /** The lane under the pointer while the clip is dragged, or null when it is over none. */
  lane?: Element | null;
  reason: string;
  /** What moved: `move`, `trim-start`, `trim-end`, `fade-in` or `fade-out`. */
  target: ClipTarget;
  value: ClipValue;
}

/** The events a clip fires, as `addEventListener` types them. They bubble, so one listener on the timeline hears every clip. */
export interface TimelineClipElementEventMap extends HTMLElementEventMap {
  /** Fired once a gesture that moved, trimmed or faded the clip ends. */
  clipchange: CustomEvent<TimelineClipEventDetail>;
  /** Fired while the clip is dragged across lanes, with its vertical `offset` in pixels. */
  clipdrag: CustomEvent<{ offset: number }>;
  /** Fired on every move, trim or fade. Cancel it, with `preventDefault()`, to refuse it. */
  clipinput: CustomEvent<TimelineClipEventDetail>;
  /** Fired on Delete or Backspace. */
  clipremove: CustomEvent<ChangeEventDetails<"keyboard", KeyboardEvent>>;
  /** Fired when a press selects or deselects the clip. Cancel it to leave `selected` as it is. */
  clipselect: CustomEvent<{ event: PointerEvent; selected: boolean }>;
}

/**
 * A region of a source on a lane, such as a recording or a pattern. Its
 * value comes from the `start`, `length`, `offset` (source offset),
 * `fade-in`, `fade-out`, `fade-in-shape` and `fade-out-shape` attributes
 * (`linear`, `fast`, `slow` or `smooth`), or the `value` property; without
 * them it spans the timeline. Dragging its `<audio-ui-timeline-clip-header>`
 * moves it on the grid, across lanes, unless Cmd or Ctrl is held; a press on
 * its body selects it and sets the position.
 * `<audio-ui-timeline-clip-handle>` trims an edge and
 * `<audio-ui-timeline-clip-fade-handle>` sets a fade. Fires `clipinput` with
 * `{ value, reason, target, lane, delta, copy }`, cancelable with
 * `preventDefault()`, and `clipchange` when the interaction ends;
 * `clipselect` with `{ selected, event }`, which toggles the `selected`
 * attribute unless prevented; `clipremove` on Delete or Backspace; and
 * `clipdrag` with the vertical `offset` in pixels. Sets `--clip-offset`,
 * `--clip-source-length`, `--clip-fade-in`, `--clip-fade-out`,
 * `--clip-fade-in-max`, `--clip-fade-out-max`, `--clip-drag-y`, and
 * `--clip-unit`, the unit width for its own parts. Carries `data-dragging`,
 * `data-fading` and `data-selected`. Contains a native `<input
 * type="range">` for keyboard moves and the accessible name. `additive`
 * reports every press as additive, `movable="false"` locks it, `min-length`
 * sets the minimum trim, and `source-length` the source's end.
 */
export class TimelineClipElement extends TimelinePartElement {
  static readonly observedAttributes = [
    ...INPUT_NAMES,
    ...Object.keys(VALUE_ATTRIBUTES),
    "additive",
    "disabled",
    "fade-in-shape",
    "fade-out-shape",
    "min-length",
    "movable",
    "selected",
    "source-length",
  ];

  override addEventListener<K extends keyof TimelineClipElementEventMap>(
    type: K,
    listener: (
      this: TimelineClipElement,
      event: TimelineClipElementEventMap[K]
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

  /** Returns how a position is announced. Defaults to the number. */
  getAriaValueText: TimelineDescribe | undefined;
  /** The framework-agnostic clip behind every part: its span, selection, drags and keys. */
  controller: ClipController | undefined;

  readonly #input = rangeInput();
  readonly #names = new Map<string, string>();
  readonly #parts = new Set<TimelineClipPartElement>();
  #value: ClipValue | undefined;
  #release: AbortController | undefined;
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
    if (name in VALUE_ATTRIBUTES || name.endsWith("-shape")) {
      this.#takeValueAttribute(name);
    }
    this.repaint();
  }

  /** The clip as displayed. Setting it moves the clip; subsequent gestures start from the new value. */
  get value(): ClipValue | undefined {
    return this.controller?.getSnapshot().value ?? this.#value;
  }

  set value(value: ClipValue | undefined) {
    this.#value = value;
    this.repaint();
  }

  /** Called by a part as it connects: drawn at once, then on every change. */
  attach(part: TimelineClipPartElement) {
    this.#parts.add(part);
    part.draw();
  }

  detach(part: TimelineClipPartElement) {
    this.#parts.delete(part);
  }

  /** Gives the clip's input the focus, so the keyboard follows a press on a part of it. */
  focusInput() {
    this.#input.focus({ focusVisible: false, preventScroll: true });
  }

  /** Starts a drag of `target` from `handle`, unless disabled. Returns whether it started. */
  press(target: ClipTarget, event: PointerEvent, handle: Element) {
    if (event.button !== 0) {
      return false;
    }
    // The press stops here, so the lane underneath doesn't take it.
    event.stopPropagation();
    const { controller } = this;
    if (!controller || controller.getSnapshot().disabled) {
      return false;
    }
    if (target === "move" && this.getAttribute("movable") === "false") {
      return false;
    }
    event.preventDefault();
    controller.press(target, event, handle, laneOf(this));
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
      this.controller = createClipController(options);
      this.#stop = this.controller.subscribe(() => this.#draw());
    }
    this.#draw();
  }

  protected override attached(timeline: TimelineElement) {
    if (this.#input.parentNode !== this) {
      this.appendChild(this.#input);
    }
    reflect(this.#input, inputNames(this.#names));
    this.#release = new AbortController();
    // A press on the body selects the clip and puts the cursor there; its parts stop their own presses.
    this.addEventListener(
      "pointerdown",
      (event) => {
        const lane = laneOf(this);
        if (
          event.button !== 0 ||
          !lane ||
          timeline.snapshot().disabled ||
          this.controller?.getSnapshot().disabled
        ) {
          return;
        }
        this.controller?.select(event);
        timeline.controller.pressSeek(event, this, lane);
        this.focusInput();
      },
      { signal: this.#release.signal }
    );
  }

  protected override detached() {
    this.#release?.abort();
    this.#stop?.();
    this.#stop = undefined;
    this.controller = undefined;
  }

  /** Folds a value attribute just changed into the value, keeping the fields a gesture moved. */
  #takeValueAttribute(name: string) {
    const base: ClipValue = this.#value ?? {
      fadeIn: 0,
      fadeOut: 0,
      length: this.root?.settings.duration ?? 1,
      offset: 0,
      start: 0,
    };
    if (name === "fade-in-shape" || name === "fade-out-shape") {
      const field = name === "fade-in-shape" ? "fadeInShape" : "fadeOutShape";
      this.#value = { ...base, [field]: shapeAttribute(this, name) };
      return;
    }
    const field = VALUE_ATTRIBUTES[name as keyof typeof VALUE_ATTRIBUTES];
    this.#value = { ...base, [field]: numberAttribute(this, name) ?? 0 };
  }

  #options(timeline: TimelineElement, snapshot: TimelineSnapshot) {
    const { grid, largeStep, step } = timeline.settings;
    const { disabled, duration, zoom } = snapshot;
    const options: ClipOptions = {
      additive: this.hasAttribute("additive"),
      disabled: disabled || this.hasAttribute("disabled"),
      duration,
      grid,
      largeStep,
      minLength:
        numberAttribute(this, "min-length") ??
        (grid.step > 0 ? grid.step : step),
      movable: this.getAttribute("movable") !== "false",
      onDragOffsetChange: (offset) =>
        this.dispatchEvent(
          new CustomEvent("clipdrag", {
            bubbles: true,
            composed: true,
            detail: { offset },
          })
        ),
      onRemove: (event) =>
        this.dispatchEvent(
          new CustomEvent("clipremove", {
            bubbles: true,
            composed: true,
            detail: createChangeEventDetails("keyboard", event),
          })
        ),
      onSelectedChange: (selected, details) => {
        const detail = { event: details.event, selected };
        if (reportChange(this, detail, "clipselect")) {
          this.toggleAttribute("selected", selected);
        }
      },
      onValueChange: (value, details) => {
        if (!reportChange(this, this.#detail(value, details), "clipinput")) {
          details.cancel();
          return;
        }
        // The clip keeps where a gesture leaves it, so the next one starts from there.
        this.#value = value;
        this.controller?.setOptions({ ...options, value });
      },
      onValueCommitted: (value, details) =>
        reportCommit(this, this.#detail(value, details), "clipchange"),
      selected: this.hasAttribute("selected"),
      sourceLength: numberAttribute(this, "source-length"),
      step,
      value: this.#value,
      zoom,
    };
    return options;
  }

  #detail(
    value: ClipValue,
    details: Omit<TimelineClipEventDetail, "value">
  ): TimelineClipEventDetail {
    const { copy, delta, lane, reason, target } = details;
    return { copy, delta, lane, reason, target, value };
  }

  #draw() {
    const { controller, root: timeline } = this;
    if (!(timeline && controller)) {
      return;
    }
    const { disabled, dragOffset, dragTarget, dragging, selected, value } =
      controller.getSnapshot();
    const { fadeIn, fadeOut, length, offset, start } = value;
    let fading: string | null = null;
    if (dragTarget === "fade-in") {
      fading = "in";
    } else if (dragTarget === "fade-out") {
      fading = "out";
    }
    reflectOwn(this, timeline.snapshot(), {
      "data-disabled": disabled ? "" : null,
      "data-dragging": dragging ? "" : null,
      "data-fading": fading,
      "data-selected": selected ? "" : null,
    });
    placeOver(this, start, length);
    const sourceLength = numberAttribute(this, "source-length");
    const properties: Record<string, string> = {
      "--clip-drag-y": `${dragOffset}px`,
      "--clip-fade-in": String(fadeIn),
      "--clip-fade-in-max": String(length - fadeOut),
      "--clip-fade-out": String(fadeOut),
      "--clip-fade-out-max": String(length - fadeIn),
      "--clip-offset": String(offset),
      "--clip-source-length":
        sourceLength === undefined ? "" : String(sourceLength),
      // A unit inside the clip: fitted, the timeline's unit is a share of the lane, which inside the clip would be a share of the clip.
      "--clip-unit": clipUnit(timeline.snapshot().zoom, length),
    };
    for (const [name, property] of Object.entries(properties)) {
      this.style.setProperty(name, property);
    }
    this.style.transform = dragging ? "translateY(var(--clip-drag-y))" : "";
    const { duration } = timeline.settings;
    const describe = this.getAriaValueText ?? describeNumber;
    const input = this.#input;
    input.hidden = this.getAttribute("movable") === "false";
    input.max = String(Math.max(0, duration - length));
    input.value = String(start);
    input.disabled = disabled;
    input.setAttribute(
      "aria-valuetext",
      `${describe(start, duration)} to ${describe(start + length, duration)}`
    );
    for (const part of this.#parts) {
      part.draw();
    }
  }
}

/** The width of one unit inside a clip `length` units long: px when zoomed, a share of the clip when fitted. */
function clipUnit(zoom: number | null, length: number) {
  if (zoom !== null) {
    return `${zoom}px`;
  }
  return length > 0 ? `calc(100% / ${length})` : "0px";
}

/** A part of a clip: it carries the clip's state, and is drawn when the clip changes. */
abstract class TimelineClipPartElement extends TimelinePartElement {
  protected clip: TimelineClipElement | null = null;

  override paint() {
    this.draw();
  }

  /** Draws the part from its clip. */
  draw() {
    const { clip, root: timeline } = this;
    const snapshot = clip?.controller?.getSnapshot();
    if (!(timeline && snapshot)) {
      return;
    }
    const { disabled, dragging, selected } = snapshot;
    reflectOwn(this, timeline.snapshot(), {
      "data-disabled": disabled ? "" : null,
      "data-dragging": dragging ? "" : null,
      "data-selected": selected ? "" : null,
    });
  }

  protected override attached(_timeline: TimelineElement) {
    const clip = this.closest(TIMELINE_TAGS.clip);
    if (clip instanceof TimelineClipElement) {
      this.clip = clip;
      clip.attach(this);
    }
  }

  protected override detached() {
    this.clip?.detach(this);
    this.clip = null;
  }
}

/**
 * The clip's title bar. Dragging it moves the clip on the grid, unless Cmd
 * or Ctrl is held, and across lanes.
 */
export class TimelineClipHeaderElement extends TimelineClipPartElement {
  #release: AbortController | undefined;

  protected override attached(timeline: TimelineElement) {
    super.attached(timeline);
    this.#release = new AbortController();
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (this.clip?.press("move", event, this)) {
          this.clip.focusInput();
        }
      },
      { signal: this.#release.signal }
    );
  }

  protected override detached() {
    super.detached();
    this.#release?.abort();
  }
}

/** A clip part holding an input that moves one of the clip's edges or fades. */
abstract class TimelineClipEdgeElement extends TimelineClipPartElement {
  static readonly observedAttributes = [...INPUT_NAMES, "edge"];

  protected readonly input = rangeInput();
  readonly #names = new Map<string, string>();
  #release: AbortController | undefined;

  constructor() {
    super();
    this.input.addEventListener("keydown", (event) => this.keyDown(event));
    this.input.addEventListener("input", (event) => {
      event.stopPropagation();
      this.clip?.controller?.edgeTypeAt(
        this.target(),
        Number(this.input.value),
        event
      );
    });
    this.input.addEventListener("change", (event) => event.stopPropagation());
  }

  attributeChangedCallback(
    name: string,
    _previous: string | null,
    next: string | null
  ) {
    if (name === "edge") {
      this.draw();
    } else if (takeName(this, this.#names, name, next)) {
      reflect(this.input, inputNames(this.#names));
    }
  }

  /** What dragging it moves. */
  protected abstract target(): Exclude<ClipTarget, "move">;

  protected keyDown(event: KeyboardEvent) {
    if (this.clip?.controller?.edgeKeyDown(this.target(), event)) {
      event.preventDefault();
    }
  }

  /** Writes the input from the edge's place and limits. */
  protected writeInput(current: number, min: number, max: number) {
    const { clip, input, root: timeline } = this;
    if (!(clip && timeline)) {
      return;
    }
    const { controller, getAriaValueText = describeNumber } = clip;
    const { duration } = timeline.settings;
    input.min = String(min);
    input.max = String(max);
    input.value = String(current);
    input.disabled = Boolean(controller?.getSnapshot().disabled);
    input.setAttribute("aria-valuetext", getAriaValueText(current, duration));
  }

  protected override attached(timeline: TimelineElement) {
    super.attached(timeline);
    if (this.input.parentNode !== this) {
      this.appendChild(this.input);
    }
    reflect(this.input, inputNames(this.#names));
    this.#release = new AbortController();
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (this.clip?.press(this.target(), event, this)) {
          this.input.focus({ focusVisible: false, preventScroll: true });
        }
      },
      { signal: this.#release.signal }
    );
    this.listen(this.#release.signal);
  }

  protected override detached() {
    super.detached();
    this.#release?.abort();
  }

  /** Listeners of its own, beyond the press. */
  protected listen(_signal: AbortSignal) {
    // An edge with nothing more to listen to.
  }
}

/**
 * Trims the clip's `edge` (`start` or `end`) by drag, on the grid unless Cmd
 * or Ctrl is held, or through the native `<input type="range">` it contains,
 * which carries the accessible name. Trimming the start shifts the source
 * offset and keeps the content in place; trimming the end stops at the end
 * of the source or the timeline. Carries `data-edge`.
 */
export class TimelineClipHandleElement extends TimelineClipEdgeElement {
  override draw() {
    super.draw();
    const controller = this.clip?.controller;
    if (!controller) {
      return;
    }
    const target = this.target();
    const { value } = controller.getSnapshot();
    const [min, max] = controller.edgeRange(target);
    this.setAttribute("data-edge", target === "trim-start" ? "start" : "end");
    const { start } = value;
    this.writeInput(target === "trim-start" ? start : clipEnd(value), min, max);
  }

  protected target(): "trim-end" | "trim-start" {
    return this.getAttribute("edge") === "end" ? "trim-end" : "trim-start";
  }
}

/**
 * Sets the length of the fade at its `edge` (`in` or `out`) by drag, off the
 * grid, or through the native `<input type="range">` it contains, which
 * carries the accessible name. A double click or Enter cycles the fade
 * shape, and Delete or Backspace removes the fade. Positioned at the end of
 * its fade. Carries `data-edge`.
 */
export class TimelineClipFadeHandleElement extends TimelineClipEdgeElement {
  override draw() {
    super.draw();
    const controller = this.clip?.controller;
    if (!controller) {
      return;
    }
    const edge = this.#edge();
    const { value } = controller.getSnapshot();
    this.setAttribute("data-edge", edge);
    const property = edge === "in" ? "--clip-fade-in" : "--clip-fade-out";
    const place = `calc(var(--clip-unit) * var(${property}))`;
    this.style.insetInlineStart = edge === "in" ? place : "";
    this.style.insetInlineEnd = edge === "in" ? "" : place;
    const { fadeIn, fadeOut, length } = value;
    this.writeInput(
      edge === "in" ? fadeIn : fadeOut,
      0,
      Math.max(0, length - (edge === "in" ? fadeOut : fadeIn))
    );
  }

  protected target(): "fade-in" | "fade-out" {
    return this.#edge() === "in" ? "fade-in" : "fade-out";
  }

  protected override keyDown(event: KeyboardEvent) {
    const controller = this.clip?.controller;
    if (!controller || controller.getSnapshot().disabled) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      controller.cycleFadeShape(this.#edge(), "keyboard", event);
      return;
    }
    if (controller.edgeKeyDown(this.target(), event)) {
      event.preventDefault();
      if (event.key === "Delete" || event.key === "Backspace") {
        // Taking the fade away, not the clip.
        event.stopPropagation();
      }
    }
  }

  protected override listen(signal: AbortSignal) {
    this.addEventListener(
      "dblclick",
      (event) => {
        const controller = this.clip?.controller;
        if (controller && !controller.getSnapshot().disabled) {
          controller.cycleFadeShape(this.#edge(), "double-click", event);
        }
      },
      { signal }
    );
  }

  #edge(): "in" | "out" {
    return this.getAttribute("edge") === "out" ? "out" : "in";
  }
}

const SAMPLES = 16;

/** The fade's ramp as points in a unit square, from the clip's edge: a fade-in climbs, a fade-out falls. */
function ramp(shape: FadeShape, edge: "in" | "out") {
  const points: string[] = [];
  for (let index = 0; index <= SAMPLES; index += 1) {
    const x = index / SAMPLES;
    const gain = fadeGain(shape, edge === "in" ? x : 1 - x);
    points.push(`${x} ${1 - gain}`);
  }
  return points;
}

/**
 * Renders the fade at its `edge` (`in` or `out`) over the clip: the gain
 * ramp as a line in `currentColor`, with the attenuated area shaded by
 * `--clip-fade-shade` (the line color by default). Spans the clip's height,
 * is hidden while the fade is empty, and ignores the pointer.
 */
export class TimelineClipFadeElement extends TimelineClipPartElement {
  static readonly observedAttributes = ["edge"];

  readonly #svg = document.createElementNS(SVG, "svg");
  readonly #shade = document.createElementNS(SVG, "path");
  readonly #line = document.createElementNS(SVG, "path");

  constructor() {
    super();
    reflect(this.#svg, {
      "aria-hidden": "true",
      focusable: "false",
      preserveAspectRatio: "none",
      viewBox: "0 0 1 1",
    });
    Object.assign(this.#svg.style, {
      display: "block",
      height: "100%",
      width: "100%",
    });
    this.#shade.style.fill = "var(--clip-fade-shade, currentColor)";
    reflect(this.#line, {
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.5",
      "vector-effect": "non-scaling-stroke",
    });
    this.#svg.appendChild(this.#shade);
    this.#svg.appendChild(this.#line);
  }

  attributeChangedCallback() {
    this.draw();
  }

  override draw() {
    super.draw();
    const value = this.clip?.controller?.getSnapshot().value;
    if (!value) {
      return;
    }
    const edge = this.getAttribute("edge") === "out" ? "out" : "in";
    const { fadeIn, fadeInShape, fadeOut, fadeOutShape } = value;
    const length = edge === "in" ? fadeIn : fadeOut;
    const shape = (edge === "in" ? fadeInShape : fadeOutShape) ?? "linear";
    const points = ramp(shape, edge);
    this.setAttribute("aria-hidden", "true");
    this.setAttribute("data-edge", edge);
    this.#shade.setAttribute("d", `M0 0H1L${[...points].reverse().join("L")}Z`);
    this.#line.setAttribute("d", `M${points.join("L")}`);
    const property = edge === "in" ? "--clip-fade-in" : "--clip-fade-out";
    Object.assign(this.style, {
      display: length > 0 ? "" : "none",
      insetInlineEnd: edge === "in" ? "" : "0",
      insetInlineStart: edge === "in" ? "0" : "",
      width: `calc(var(--clip-unit) * var(${property}))`,
    });
  }

  protected override attached(timeline: TimelineElement) {
    if (this.#svg.parentNode !== this) {
      this.appendChild(this.#svg);
    }
    super.attached(timeline);
  }
}
