import {
  type Axis,
  createXYPadController,
  type XYPadChangeEventReason,
  type XYPadCommitEventReason,
  type XYPadController,
  type XYPadOptions,
  type XYPadPoint,
  type XYPadSnapshot,
} from "@audio-ui/core/xypad";
import {
  ensureId,
  hideVisually,
  jsonAttribute,
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

/** The names the XY pad's elements are registered under, frozen: a page cannot rename them by accident. */
export const XYPAD_TAGS = Object.freeze({
  control: "audio-ui-xypad-control",
  label: "audio-ui-xypad-label",
  root: "audio-ui-xypad",
  thumb: "audio-ui-xypad-thumb",
  value: "audio-ui-xypad-value",
} as const);

/** What an XY pad's `input` and `change` events carry, besides the pad itself as their target. */
export interface XYPadEventDetail<Reason extends string> {
  /** What changed it: `press`, `drag`, `keyboard`, `wheel`, `reset` or `input-change`. */
  reason: Reason;
  value: XYPadPoint;
}

/** Fired on every change. Cancel it, with `preventDefault()`, to refuse the point. */
export type XYPadInputEvent = CustomEvent<
  XYPadEventDetail<XYPadChangeEventReason>
>;
/** Fired once a gesture ends with a new point. */
export type XYPadChangeEvent = CustomEvent<
  XYPadEventDetail<XYPadCommitEventReason>
>;

/** The events an XY pad fires, as `addEventListener` types them. */
export interface XYPadElementEventMap
  extends Omit<HTMLElementEventMap, "change" | "input"> {
  change: XYPadChangeEvent;
  input: XYPadInputEvent;
}

/** A point attribute, `"x y"` or `"x, y"`, or `undefined` when it is missing or not two numbers. */
function pointAttribute(
  element: Element,
  name: string
): XYPadPoint | undefined {
  const [x, y] = listAttribute(element, name).map(Number);
  return x !== undefined &&
    y !== undefined &&
    Number.isFinite(x) &&
    Number.isFinite(y)
    ? { x, y }
    : undefined;
}

/** The state every part carries, as the React parts do: `data-disabled`, `data-dragging`. */
const stateAttributes = (snapshot: XYPadSnapshot) => ({
  "data-disabled": snapshot.disabled ? "" : null,
  "data-dragging": snapshot.dragging ? "" : null,
});

/**
 * Groups all parts of the pad and owns its two-dimensional value. Exposes the
 * point's place as CSS variables for crosshairs and guides: `--xy-pad-x`
 * from the left and `--xy-pad-y` from the top, as percentages. Every change
 * fires an `input` event, which `preventDefault()` refuses, and a gesture
 * that ends with a new point fires a `change`. Its attributes are the React
 * `XYPad.Root`'s props: `min-x`, `max-x`, `min-y`, `max-y` (0 to 100 by
 * default), `step-x`, `step-y`, `value` and `default-value` as `"x y"`,
 * `disabled`, `format` (`Intl.NumberFormat` options as JSON), `locale` and
 * `name`, under which its two inputs submit as `name.x` and `name.y`.
 */
export class XYPadElement extends ControlRoot<XYPadSnapshot> {
  static readonly observedAttributes = [
    "default-value",
    "disabled",
    "format",
    "locale",
    "max-x",
    "max-y",
    "min-x",
    "min-y",
    "name",
    "step-x",
    "step-y",
    "value",
  ];

  /** The framework-agnostic pad behind every part: gestures, keys, the wheel, typed values. */
  readonly controller: XYPadController = createXYPadController();
  /** The thumb's X input, which takes focus when the pad is pressed. */
  input: HTMLInputElement | null = null;
  /** The label's id, which names the inputs when the thumb has no name of its own. */
  labelId: string | undefined;

  #value: XYPadPoint | undefined;
  #format: Intl.NumberFormatOptions | undefined;

  attributeChangedCallback(name: string) {
    if (name === "value") {
      this.#value = pointAttribute(this, "value");
    }
    this.configure();
    this.paint();
  }

  override addEventListener<K extends keyof XYPadElementEventMap>(
    type: K,
    listener: (this: XYPadElement, event: XYPadElementEventMap[K]) => unknown,
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

  /** The point as displayed, `{ x, y }`. Set it to move the pad; a gesture moves it from there. */
  get value(): XYPadPoint {
    return this.controller.getSnapshot().value;
  }

  set value(value: XYPadPoint) {
    this.#value = { x: Number(value.x), y: Number(value.y) };
    this.configure();
    this.paint();
  }

  /** How each axis is written: `Intl.NumberFormat` options. Takes over from the `format` attribute. */
  get format(): Intl.NumberFormatOptions | undefined {
    return this.#format ?? jsonAttribute(this, "format");
  }

  set format(format: Intl.NumberFormatOptions | undefined) {
    this.#format = format;
    this.configure();
    this.paint();
  }

  protected snapshot() {
    return this.controller.getSnapshot();
  }

  protected subscribe(listener: () => void) {
    return this.controller.subscribe(listener);
  }

  protected rootAttributes(snapshot: XYPadSnapshot) {
    this.style.setProperty("--xy-pad-x", `${snapshot.percentX * 100}%`);
    this.style.setProperty("--xy-pad-y", `${100 - snapshot.percentY * 100}%`);
    return stateAttributes(snapshot);
  }

  protected configure() {
    const options: XYPadOptions = {
      defaultValue: pointAttribute(this, "default-value"),
      disabled: this.hasAttribute("disabled"),
      format: this.format,
      locale: localeOf(this),
      maxX: numberAttribute(this, "max-x"),
      maxY: numberAttribute(this, "max-y"),
      minX: numberAttribute(this, "min-x"),
      minY: numberAttribute(this, "min-y"),
      onValueChange: (value, details) => {
        if (!reportChange(this, { reason: details.reason, value })) {
          details.cancel();
          return;
        }
        // A point set from outside is kept up to date, so the next gesture starts from it.
        if (this.#value !== undefined) {
          this.#value = value;
          this.controller.setOptions({ ...options, value });
        }
      },
      onValueCommitted: (value, details) =>
        reportCommit(this, { reason: details.reason, value }),
      stepX: numberAttribute(this, "step-x"),
      stepY: numberAttribute(this, "step-y"),
      value: this.#value,
    };
    this.controller.setOptions(options);
  }
}

/** What every part of the pad does: find its pad, and carry its state. */
abstract class XYPadPartElement extends ControlPart<
  XYPadElement,
  XYPadSnapshot
> {
  protected readonly rootTag = XYPAD_TAGS.root;

  protected isRoot(element: Element | null) {
    return element instanceof XYPadElement;
  }

  protected state(snapshot: XYPadSnapshot): Record<string, string | null> {
    return stateAttributes(snapshot);
  }
}

/**
 * The pad's surface: a press jumps the point to the pointer and a drag
 * follows it; the mouse wheel and the trackpad move it too, and a double
 * click returns it to its default. Its structural style sets
 * `touch-action: none`, so a touch drag does not scroll the page.
 */
export class XYPadControlElement extends XYPadPartElement {
  #release: AbortController | undefined;
  #unwheel: (() => void) | undefined;

  protected override attached(pad: XYPadElement) {
    this.#release = new AbortController();
    const { signal } = this.#release;
    const disabled = () => pad.controller.getSnapshot().disabled;
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (disabled() || event.button !== 0) {
          return;
        }
        event.preventDefault();
        pad.input?.focus({ focusVisible: false, preventScroll: true });
        pad.controller.press(event, this);
      },
      { signal }
    );
    this.addEventListener(
      "dblclick",
      (event) => {
        if (!disabled()) {
          pad.controller.reset(event);
        }
      },
      { signal }
    );
    this.#unwheel = pad.controller.attachWheel(this);
  }

  protected override detached() {
    this.#release?.abort();
    this.#unwheel?.();
  }
}

/** The thumb's attributes that name its inputs instead. */
const NAMES = [
  "aria-describedby",
  "aria-label",
  "aria-labelledby",
  "label-x",
  "label-y",
];

/**
 * Marks the point on the pad (`left` and `top` as percentages, centered
 * with `translate`). Holds two native `<input type="range">`s, one per
 * axis: the X input takes focus, both carry the accessible name, and the
 * arrow keys move both axes. Its `aria-label` names the axes after it
 * ("Filter X", "Filter Y"), `label-x` and `label-y` name each one, and
 * `aria-labelledby` and `aria-describedby` go to both.
 */
export class XYPadThumbElement extends XYPadPartElement {
  static readonly observedAttributes = NAMES;

  readonly #inputs: Record<Axis, HTMLInputElement> = {
    x: document.createElement("input"),
    y: document.createElement("input"),
  };
  readonly #names = new Map<string, string>();

  constructor() {
    super();
    for (const axis of ["x", "y"] as const) {
      const input = this.#inputs[axis];
      input.type = "range";
      hideVisually(input);
      input.addEventListener("keydown", (event) => {
        if (this.root?.controller.keyDown(event)) {
          event.preventDefault();
        }
      });
      // Assistive technology may set an input's value directly; the pad reports it as its own change.
      input.addEventListener("input", (event) => {
        event.stopPropagation();
        this.root?.controller.type(axis, Number(input.value), event);
      });
      input.addEventListener("change", (event) => event.stopPropagation());
    }
    this.#inputs.y.tabIndex = -1;
  }

  /** The X axis's native range input, which takes focus. */
  get input(): HTMLInputElement {
    return this.#inputs.x;
  }

  attributeChangedCallback(
    name: string,
    _previous: string | null,
    next: string | null
  ) {
    // A name never stays on the thumb, so only its own removal of it comes with no value.
    if (next === null) {
      return;
    }
    if (next === "") {
      this.#names.delete(name);
    } else {
      this.#names.set(name, next);
    }
    this.removeAttribute(name);
    this.root?.paint();
  }

  protected override attached(pad: XYPadElement) {
    for (const input of [this.#inputs.x, this.#inputs.y]) {
      if (input.parentNode !== this) {
        this.appendChild(input);
      }
    }
    pad.input = this.#inputs.x;
  }

  protected override detached(pad: XYPadElement) {
    if (pad.input === this.#inputs.x) {
      pad.input = null;
    }
  }

  override paint(snapshot: XYPadSnapshot) {
    super.paint(snapshot);
    Object.assign(this.style, {
      left: `${snapshot.percentX * 100}%`,
      top: `${100 - snapshot.percentY * 100}%`,
      translate: "-50% -50%",
    });
    const name = this.root?.getAttribute("name");
    for (const axis of ["x", "y"] as const) {
      const input = this.#inputs[axis];
      input.min = String(axis === "x" ? snapshot.minX : snapshot.minY);
      input.max = String(axis === "x" ? snapshot.maxX : snapshot.maxY);
      input.step = String(axis === "x" ? snapshot.stepX : snapshot.stepY);
      input.value = String(snapshot.value[axis]);
      input.disabled = snapshot.disabled;
      const own = this.#names.get(`label-${axis}`);
      const shared = this.#names.get("aria-label");
      const label = own ?? (shared ? `${shared} ${axis.toUpperCase()}` : null);
      reflect(input, {
        "aria-describedby": this.#names.get("aria-describedby") ?? null,
        "aria-label": label,
        "aria-labelledby":
          this.#names.get("aria-labelledby") ??
          (label ? null : (this.root?.labelId ?? null)),
        "aria-orientation": axis === "x" ? "horizontal" : "vertical",
        "aria-valuetext": snapshot.formatted[axis],
        name: name ? `${name}.${axis}` : null,
      });
    }
  }
}

/** The formatted point (`format` and `locale` on the pad), `"x, y"`, as its text. */
export class XYPadValueElement extends XYPadPartElement {
  readonly #text = new ValueText();

  protected override attached() {
    this.#text.mount(this);
  }

  override paint(snapshot: XYPadSnapshot) {
    super.paint(snapshot);
    this.#text.write(snapshot.formattedPair);
  }
}

/** The accessible label, which names both axis inputs when the thumb has no name of its own. */
export class XYPadLabelElement extends XYPadPartElement {
  protected override attached(pad: XYPadElement) {
    pad.labelId = ensureId(this, XYPAD_TAGS.label);
    pad.paint();
  }

  protected override detached(pad: XYPadElement) {
    if (pad.labelId === this.id) {
      pad.labelId = undefined;
      pad.paint();
    }
  }
}
