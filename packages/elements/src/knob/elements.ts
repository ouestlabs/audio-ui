import type { ParameterScaleProp } from "@audio-ui/core";
import {
  ARC_OUTER_RADIUS,
  arcPath,
  createKnobController,
  DEFAULT_ARC_STROKE_WIDTH,
  type KnobChangeEventReason,
  type KnobCommitEventReason,
  type KnobController,
  type KnobDragMode,
  type KnobOptions,
  type KnobSnapshot,
} from "@audio-ui/core/knob";
import {
  connectPart,
  ElementBase,
  ensureId,
  jsonAttribute,
  localeOf,
  numberAttribute,
  reflect,
} from "../internal/element.ts";
import { INPUT_NAMES, ThumbInput, ValueText } from "../internal/input.ts";

/** The names the knob's elements are registered under, frozen: a page cannot rename them by accident. */
export const KNOB_TAGS = Object.freeze({
  control: "audio-ui-knob-control",
  indicator: "audio-ui-knob-indicator",
  label: "audio-ui-knob-label",
  root: "audio-ui-knob",
  thumb: "audio-ui-knob-thumb",
  track: "audio-ui-knob-track",
  value: "audio-ui-knob-value",
} as const);

/** What a knob's `input` and `change` events carry, besides the knob itself as their target. */
export interface KnobEventDetail<Reason extends string> {
  /** What changed it: `drag`, `keyboard`, `wheel`, `reset` or `input-change`. */
  reason: Reason;
  value: number;
}

/** Fired on every change. Cancel it, with `preventDefault()`, to refuse the value. */
export type KnobInputEvent = CustomEvent<
  KnobEventDetail<KnobChangeEventReason>
>;
/** Fired once a gesture ends with a new value. */
export type KnobChangeEvent = CustomEvent<
  KnobEventDetail<KnobCommitEventReason>
>;

/** The events a knob fires, as `addEventListener` types them. */
export interface KnobElementEventMap
  extends Omit<HTMLElementEventMap, "change" | "input"> {
  change: KnobChangeEvent;
  input: KnobInputEvent;
}

const DRAG_MODES = new Set<KnobDragMode>([
  "circular",
  "revolution",
  "vertical",
]);
const SVG = "http://www.w3.org/2000/svg";

/** The state every part carries, as the React parts do: `data-disabled`, `data-dragging`, `data-drag-mode`. */
const stateAttributes = (snapshot: KnobSnapshot) => ({
  "data-disabled": snapshot.disabled ? "" : null,
  "data-drag-mode": snapshot.dragMode,
  "data-dragging": snapshot.dragging ? "" : null,
});

interface KnobPart extends HTMLElement {
  paint: (snapshot: KnobSnapshot) => void;
}

/**
 * Groups all parts of the knob and owns its value. Dragging the
 * `<audio-ui-knob-control>`, turning the mouse wheel over it, the keyboard on
 * the thumb's input, or a double tap (reset) all report through an `input`
 * event on every change, which `preventDefault()` refuses, and a `change`
 * event when the gesture ends. Its attributes are the React `Knob.Root`'s
 * props: `min`, `max`, `step`, `large-step`, `value`, `default-value`,
 * `anchor`, `disabled`, `drag-mode`, `scale` (`linear` or `log`), `format`
 * (`Intl.NumberFormat` options as JSON), `locale` and `name`.
 */
export class KnobElement extends ElementBase {
  static readonly observedAttributes = [
    "anchor",
    "default-value",
    "disabled",
    "drag-mode",
    "format",
    "large-step",
    "locale",
    "max",
    "min",
    "name",
    "scale",
    "step",
    "value",
  ];

  /** The framework-agnostic knob behind every part: gestures, keys, the wheel, typed values. */
  readonly controller: KnobController = createKnobController();
  /** The thumb's input, which takes focus when the knob is pressed. */
  input: HTMLInputElement | null = null;
  /** The label's id, which names the input when the thumb has no name of its own. */
  labelId: string | undefined;

  readonly #parts = new Set<KnobPart>();
  #value: number | undefined;
  #format: Intl.NumberFormatOptions | undefined;
  #scale: ParameterScaleProp | undefined;
  #stop: (() => void) | undefined;

  connectedCallback() {
    this.#configure();
    this.#stop ??= this.controller.subscribe(() => this.paint());
    this.paint();
  }

  disconnectedCallback() {
    this.#stop?.();
    this.#stop = undefined;
  }

  attributeChangedCallback(name: string) {
    if (name === "value") {
      this.#value = numberAttribute(this, "value");
    }
    this.#configure();
    this.paint();
  }

  override addEventListener<K extends keyof KnobElementEventMap>(
    type: K,
    listener: (this: KnobElement, event: KnobElementEventMap[K]) => unknown,
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

  /** The value as displayed. Set it to move the knob; a gesture moves it from there. */
  get value(): number {
    return this.controller.getSnapshot().value;
  }

  set value(value: number) {
    this.#value = Number(value);
    this.#configure();
    this.paint();
  }

  /** How the value is written: `Intl.NumberFormat` options. Takes over from the `format` attribute. */
  get format(): Intl.NumberFormatOptions | undefined {
    return this.#format ?? jsonAttribute(this, "format");
  }

  set format(format: Intl.NumberFormatOptions | undefined) {
    this.#format = format;
    this.#configure();
    this.paint();
  }

  /** How the value maps onto the dial's travel: `linear`, `log`, or your own `{ toPosition, toValue }`. Takes over from the `scale` attribute. */
  get scale(): ParameterScaleProp {
    return this.#scale ?? this.#scaleAttribute() ?? "linear";
  }

  set scale(scale: ParameterScaleProp | undefined) {
    this.#scale = scale;
    this.#configure();
    this.paint();
  }

  /** Paints the knob and every part from the controller's snapshot. */
  paint() {
    const snapshot = this.controller.getSnapshot();
    reflect(this, stateAttributes(snapshot));
    for (const part of this.#parts) {
      part.paint(snapshot);
    }
  }

  /** Called by a part when it connects: it is painted at once, then on every change. */
  attach(part: KnobPart) {
    this.#parts.add(part);
    part.paint(this.controller.getSnapshot());
  }

  detach(part: KnobPart) {
    this.#parts.delete(part);
  }

  #scaleAttribute(): ParameterScaleProp | undefined {
    const scale = this.getAttribute("scale");
    return scale === "linear" || scale === "log" ? scale : undefined;
  }

  #configure() {
    const dragMode = this.getAttribute("drag-mode") as KnobDragMode | null;
    const options: KnobOptions = {
      anchor: numberAttribute(this, "anchor"),
      defaultValue: numberAttribute(this, "default-value"),
      disabled: this.hasAttribute("disabled"),
      dragMode: dragMode && DRAG_MODES.has(dragMode) ? dragMode : undefined,
      format: this.format,
      largeStep: numberAttribute(this, "large-step"),
      locale: localeOf(this),
      max: numberAttribute(this, "max"),
      min: numberAttribute(this, "min"),
      onValueChange: (value, details) => {
        const event: KnobInputEvent = new CustomEvent("input", {
          bubbles: true,
          cancelable: true,
          composed: true,
          detail: { reason: details.reason, value },
        });
        if (!this.dispatchEvent(event)) {
          details.cancel();
          return;
        }
        // A value set from outside is kept up to date, so the next gesture starts from it.
        if (this.#value !== undefined) {
          this.#value = value;
          this.controller.setOptions({ ...options, value });
        }
      },
      onValueCommitted: (value, details) => {
        const event: KnobChangeEvent = new CustomEvent("change", {
          bubbles: true,
          composed: true,
          detail: { reason: details.reason, value },
        });
        this.dispatchEvent(event);
      },
      scale: this.scale,
      step: numberAttribute(this, "step"),
      value: this.#value,
    };
    this.controller.setOptions(options);
  }
}

const isKnob = (element: Element | null): element is KnobElement =>
  element instanceof KnobElement;

/** What every part of the knob does: find its knob, and carry its state. */
abstract class KnobPartElement extends ElementBase implements KnobPart {
  protected knob: KnobElement | null = null;

  connectedCallback() {
    connectPart(this, KNOB_TAGS.root, isKnob, (knob) => {
      this.knob = knob;
      this.attached(knob);
      knob.attach(this);
    });
  }

  disconnectedCallback() {
    const { knob } = this;
    if (knob) {
      knob.detach(this);
      this.detached(knob);
      this.knob = null;
    }
  }

  paint(snapshot: KnobSnapshot) {
    reflect(this, stateAttributes(snapshot));
  }

  protected attached(_knob: KnobElement): void {
    // A part with nothing of its own to set up.
  }

  protected detached(_knob: KnobElement): void {
    // A part with nothing of its own to let go of.
  }
}

/**
 * The interactive surface: pointer drags (see `drag-mode`), mouse-wheel
 * stepping, and a double tap (or Alt + click) to reset. Its structural style
 * sets `touch-action: none`, so a touch drag does not scroll the page.
 */
export class KnobControlElement extends KnobPartElement {
  #release: AbortController | undefined;
  #unwheel: (() => void) | undefined;

  protected override attached(knob: KnobElement) {
    this.#release = new AbortController();
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (knob.controller.getSnapshot().disabled || event.button !== 0) {
          return;
        }
        event.preventDefault();
        knob.input?.focus({ focusVisible: false, preventScroll: true });
        knob.controller.press(event, this);
      },
      { signal: this.#release.signal }
    );
    this.#unwheel = knob.controller.attachWheel(this);
  }

  protected override detached() {
    this.#release?.abort();
    this.#unwheel?.();
  }
}

/** An arc of the dial, drawn in an `<svg>` it holds: the whole sweep, or from the anchor to the value. */
abstract class KnobArcElement extends KnobPartElement {
  static readonly observedAttributes = ["stroke-width"];

  readonly #svg = document.createElementNS(SVG, "svg");
  readonly #path = document.createElementNS(SVG, "path");

  constructor() {
    super();
    this.#svg.setAttribute("viewBox", "0 0 48 48");
    this.#svg.setAttribute("aria-hidden", "true");
    Object.assign(this.#svg.style, {
      display: "block",
      height: "100%",
      width: "100%",
    });
    this.#path.setAttribute("fill", "none");
    this.#path.setAttribute("stroke", "currentColor");
    this.#path.setAttribute("stroke-linecap", "round");
  }

  attributeChangedCallback() {
    if (this.knob) {
      this.paint(this.knob.controller.getSnapshot());
    }
  }

  protected override attached() {
    if (this.#svg.parentNode !== this) {
      this.append(this.#svg);
    }
  }

  override paint(snapshot: KnobSnapshot) {
    super.paint(snapshot);
    const [from, to] = this.span(snapshot);
    const width =
      numberAttribute(this, "stroke-width") ?? DEFAULT_ARC_STROKE_WIDTH;
    if (Math.abs(to - from) > 0.001) {
      this.#path.setAttribute(
        "d",
        arcPath(ARC_OUTER_RADIUS - width / 2, from, to)
      );
      this.#path.setAttribute("stroke-width", String(width));
      if (this.#path.parentNode !== this.#svg) {
        this.#svg.append(this.#path);
      }
    } else {
      this.#path.remove();
    }
  }

  protected abstract span(snapshot: KnobSnapshot): [number, number];
}

/** The full sweep of the dial, as an SVG arc. `stroke-width` sets its width in the 48×48 viewBox, 3 by default. */
export class KnobTrackElement extends KnobArcElement {
  protected span(): [number, number] {
    return [0, 1];
  }
}

/** The arc from `anchor` to the value, drawn over the track. `stroke-width` as on the track. */
export class KnobIndicatorElement extends KnobArcElement {
  protected span(snapshot: KnobSnapshot): [number, number] {
    return [
      Math.min(snapshot.anchorPercent, snapshot.percent),
      Math.max(snapshot.anchorPercent, snapshot.percent),
    ];
  }
}

/**
 * Rotates with the value (`rotate`, clockwise from 12 o'clock), so a pointer
 * drawn inside it points at the value. Holds the knob's native
 * `<input type="range">`, which takes focus, carries the accessible name and
 * the form value (the knob's `name`), and handles the keyboard. Its
 * `aria-label`, `aria-labelledby` and `aria-describedby` go to that input;
 * set one to `""` to take it away.
 */
export class KnobThumbElement extends KnobPartElement {
  static readonly observedAttributes = INPUT_NAMES;

  readonly #input = new ThumbInput();

  constructor() {
    super();
    const input = this.#input.element;
    input.addEventListener("keydown", (event) => {
      if (this.knob?.controller.keyDown(event)) {
        event.preventDefault();
      }
    });
    // Assistive technology may set the input's value directly; the knob reports it as its own change.
    input.addEventListener("input", (event) => {
      event.stopPropagation();
      this.knob?.controller.type(Number(input.value), event);
    });
    input.addEventListener("change", (event) => event.stopPropagation());
  }

  /** The native range input the thumb holds. */
  get input(): HTMLInputElement {
    return this.#input.element;
  }

  attributeChangedCallback(
    name: string,
    _previous: string | null,
    next: string | null
  ) {
    if (this.#input.take(this, name, next)) {
      this.knob?.paint();
    }
  }

  protected override attached(knob: KnobElement) {
    if (this.input.parentNode !== this) {
      this.append(this.input);
    }
    knob.input = this.input;
  }

  protected override detached(knob: KnobElement) {
    if (knob.input === this.input) {
      knob.input = null;
    }
  }

  override paint(snapshot: KnobSnapshot) {
    super.paint(snapshot);
    this.style.rotate = `${snapshot.angle}deg`;
    this.#input.write({
      ...snapshot,
      labelId: this.knob?.labelId,
      name: this.knob?.getAttribute("name") ?? null,
    });
  }
}

/** The formatted value (`format` and `locale` on the knob), as its text. */
export class KnobValueElement extends KnobPartElement {
  readonly #text = new ValueText();

  protected override attached() {
    this.#text.mount(this);
  }

  override paint(snapshot: KnobSnapshot) {
    super.paint(snapshot);
    this.#text.write(snapshot.formatted);
  }
}

/** The accessible label, which names the thumb's input when the thumb has no name of its own. */
export class KnobLabelElement extends KnobPartElement {
  protected override attached(knob: KnobElement) {
    knob.labelId = ensureId(this, KNOB_TAGS.label);
    knob.paint();
  }

  protected override detached(knob: KnobElement) {
    if (knob.labelId === this.id) {
      knob.labelId = undefined;
      knob.paint();
    }
  }
}
