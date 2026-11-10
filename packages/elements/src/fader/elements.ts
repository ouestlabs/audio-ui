import {
  createFaderController,
  type FaderChangeEventReason,
  type FaderCommitEventReason,
  type FaderController,
  type FaderOptions,
  type FaderOrientation,
  type FaderSnapshot,
} from "@audio-ui/core/fader";
import {
  ensureId,
  jsonAttribute,
  localeOf,
  numberAttribute,
  reflect,
} from "../internal/element.ts";
import { INPUT_NAMES, ThumbInput, ValueText } from "../internal/input.ts";
import {
  ControlPart,
  ControlRoot,
  reportChange,
  reportCommit,
} from "../internal/parts.ts";

/** The names the fader's elements are registered under, frozen: a page cannot rename them by accident. */
export const FADER_TAGS = Object.freeze({
  control: "audio-ui-fader-control",
  indicator: "audio-ui-fader-indicator",
  label: "audio-ui-fader-label",
  root: "audio-ui-fader",
  thumb: "audio-ui-fader-thumb",
  track: "audio-ui-fader-track",
  value: "audio-ui-fader-value",
});

/** What a fader's `input` and `change` events carry, besides the fader itself as their target. */
export interface FaderEventDetail<Reason extends string> {
  /** What changed it: `drag`, `track-press`, `keyboard`, `wheel`, `reset` or `input-change`. */
  reason: Reason;
  value: number;
}

/** Fired on every change. Cancel it, with `preventDefault()`, to refuse the value. */
export type FaderInputEvent = CustomEvent<
  FaderEventDetail<FaderChangeEventReason>
>;
/** Fired once a gesture ends with a new value. */
export type FaderChangeEvent = CustomEvent<
  FaderEventDetail<FaderCommitEventReason>
>;

/** The events a fader fires, as `addEventListener` types them. */
export interface FaderElementEventMap
  extends Omit<HTMLElementEventMap, "change" | "input"> {
  change: FaderChangeEvent;
  input: FaderInputEvent;
}

/** The state every part carries, as the React parts do: `data-disabled`, `data-dragging`, `data-orientation`. */
const stateAttributes = (snapshot: FaderSnapshot) => ({
  "data-disabled": snapshot.disabled ? "" : null,
  "data-dragging": snapshot.dragging ? "" : null,
  "data-orientation": snapshot.orientation,
});

/**
 * Groups all parts of the fader, with audio defaults (vertical, -60 to +6)
 * and mouse-wheel stepping, and owns its value. Every change fires an `input`
 * event, which `preventDefault()` refuses, and a gesture that ends with a new
 * value fires a `change`. While a pointer drags it, the thumb follows the
 * pointer even when a value set from outside lags behind, as with a seek bar
 * driven by playback. Its attributes are the React `Fader.Root`'s props:
 * `min`, `max`, `step`, `large-step`, `value`, `default-value`, `anchor`,
 * `disabled`, `orientation`, `format` (`Intl.NumberFormat` options as JSON),
 * `locale` and `name`. It is a group, named by its label.
 */
export class FaderElement extends ControlRoot<FaderSnapshot> {
  static readonly observedAttributes = [
    "anchor",
    "default-value",
    "disabled",
    "format",
    "large-step",
    "locale",
    "max",
    "min",
    "name",
    "orientation",
    "step",
    "value",
  ];

  /** The framework-agnostic fader behind every part: gestures, keys, the wheel, typed values. */
  readonly controller: FaderController = createFaderController();
  /** The thumb's input, which takes focus when the fader is pressed. */
  input: HTMLInputElement | null = null;
  /** The thumb, which a press drags from where it was taken rather than jumping. */
  thumb: HTMLElement | null = null;
  /** The label's id, which names the group and the input when the thumb has no name of its own. */
  labelId: string | undefined;

  #value: number | undefined;
  #format: Intl.NumberFormatOptions | undefined;

  attributeChangedCallback(name: string) {
    if (name === "value") {
      this.#value = numberAttribute(this, "value");
    }
    this.configure();
    this.paint();
  }

  override addEventListener<K extends keyof FaderElementEventMap>(
    type: K,
    listener: (this: FaderElement, event: FaderElementEventMap[K]) => unknown,
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

  /** The value as displayed. Set it to move the fader; a gesture moves it from there. */
  get value(): number {
    return this.controller.getSnapshot().value;
  }

  set value(value: number) {
    this.#value = Number(value);
    this.configure();
    this.paint();
  }

  /** How the value is written: `Intl.NumberFormat` options. Takes over from the `format` attribute. */
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

  protected rootAttributes(snapshot: FaderSnapshot) {
    return {
      ...stateAttributes(snapshot),
      "aria-labelledby": this.labelId ?? null,
      role: "group",
    };
  }

  protected configure() {
    const orientation = this.getAttribute(
      "orientation"
    ) as FaderOrientation | null;
    const options: FaderOptions = {
      anchor: numberAttribute(this, "anchor"),
      defaultValue: numberAttribute(this, "default-value"),
      disabled: this.hasAttribute("disabled"),
      format: this.format,
      largeStep: numberAttribute(this, "large-step"),
      locale: localeOf(this),
      max: numberAttribute(this, "max"),
      min: numberAttribute(this, "min"),
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
      orientation: orientation === "horizontal" ? "horizontal" : "vertical",
      step: numberAttribute(this, "step"),
      value: this.#value,
    };
    this.controller.setOptions(options);
  }
}

/** What every part of the fader does: find its fader, and carry its state. */
abstract class FaderPartElement extends ControlPart<
  FaderElement,
  FaderSnapshot
> {
  protected readonly rootTag = FADER_TAGS.root;

  protected isRoot(element: Element | null) {
    return element instanceof FaderElement;
  }

  protected state(snapshot: FaderSnapshot) {
    return stateAttributes(snapshot);
  }
}

/**
 * The interactive area: a press on the track jumps to the value under it, a
 * press on the thumb drags it from where it was taken, and the mouse wheel
 * steps. A double click, an Alt + click or the Delete key return to the
 * default. Its structural style sets `touch-action: none`, so a touch drag
 * does not scroll the page.
 */
export class FaderControlElement extends FaderPartElement {
  #release: AbortController | undefined;
  #unwheel: (() => void) | undefined;

  protected override attached(fader: FaderElement) {
    this.#release = new AbortController();
    const { signal } = this.#release;
    const enabled = () => !fader.controller.getSnapshot().disabled;
    // An Alt + click returns to the default before a press could move the thumb.
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (event.altKey && event.button === 0 && enabled()) {
          event.preventDefault();
          event.stopPropagation();
          fader.controller.reset(event);
        }
      },
      { capture: true, signal }
    );
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (!enabled() || event.button !== 0) {
          return;
        }
        event.preventDefault();
        fader.input?.focus({ preventScroll: true });
        fader.controller.press(event, this, fader.thumb);
      },
      { signal }
    );
    this.addEventListener(
      "dblclick",
      (event) => {
        if (enabled()) {
          fader.controller.reset(event);
        }
      },
      { signal }
    );
    this.addEventListener(
      "keydown",
      (event) => {
        if (
          enabled() &&
          (event.key === "Delete" || event.key === "Backspace")
        ) {
          event.preventDefault();
          fader.controller.reset(event);
        }
      },
      { signal }
    );
    this.#unwheel = fader.controller.attachWheel(this);
  }

  protected override detached() {
    this.#release?.abort();
    this.#unwheel?.();
  }
}

/** The full range of travel, which the indicator and the thumb are placed in. */
export class FaderTrackElement extends FaderPartElement {}

/**
 * The filled part of the track: from `min` up to the value, or between the
 * fader's `anchor` and the value, on whichever side of it the value is.
 */
export class FaderIndicatorElement extends FaderPartElement {
  override paint(snapshot: FaderSnapshot) {
    super.paint(snapshot);
    const { from, to } = snapshot.fill;
    const vertical = snapshot.orientation === "vertical";
    Object.assign(this.style, {
      bottom: vertical ? `${from}%` : "",
      height: vertical ? `${to - from}%` : "inherit",
      insetInlineStart: vertical ? "" : `${from}%`,
      width: vertical ? "inherit" : `${to - from}%`,
    });
  }
}

/**
 * The draggable thumb, placed along the track at the value. Holds the
 * fader's native `<input type="range">`, which takes focus, carries the
 * accessible name and the form value (the fader's `name`), and handles the
 * keyboard. Its `aria-label`, `aria-labelledby` and `aria-describedby` go to
 * that input; set one to `""` to take it away.
 */
export class FaderThumbElement extends FaderPartElement {
  static readonly observedAttributes = INPUT_NAMES;

  readonly #input = new ThumbInput();
  /** 1, or -1 on a page that reads right to left, where the horizontal travel and the arrows are reversed. */
  #direction = 1;

  constructor() {
    super();
    const input = this.#input.element;
    input.addEventListener("keydown", (event) => {
      if (this.root?.controller.keyDown(event, input)) {
        event.preventDefault();
      }
    });
    // Assistive technology may set the input's value directly; the fader reports it as its own change.
    input.addEventListener("input", (event) => {
      event.stopPropagation();
      this.root?.controller.type(Number(input.value), event);
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
      this.root?.paint();
    }
  }

  protected override attached(fader: FaderElement) {
    if (this.input.parentNode !== this) {
      this.appendChild(this.input);
    }
    this.#direction = getComputedStyle(this).direction === "rtl" ? -1 : 1;
    fader.input = this.input;
    fader.thumb = this;
  }

  protected override detached(fader: FaderElement) {
    if (fader.input === this.input) {
      fader.input = null;
    }
    if (fader.thumb === this) {
      fader.thumb = null;
    }
  }

  override paint(snapshot: FaderSnapshot) {
    super.paint(snapshot);
    const vertical = snapshot.orientation === "vertical";
    Object.assign(this.style, {
      bottom: vertical ? `${snapshot.share}%` : "",
      insetInlineStart: vertical ? "" : `${snapshot.share}%`,
      left: vertical ? "50%" : "",
      position: "absolute",
      top: vertical ? "" : "50%",
      translate: vertical ? "-50% 50%" : `${-50 * this.#direction}% -50%`,
      zIndex: snapshot.dragging ? "1" : "",
    });
    // The hidden input covers the thumb, standing up on a vertical fader.
    Object.assign(this.input.style, {
      height: "100%",
      width: "100%",
      writingMode: vertical ? "vertical-lr" : "",
    });
    reflect(this.input, { "aria-orientation": snapshot.orientation });
    this.#input.write({
      ...snapshot,
      labelId: this.root?.labelId,
      name: this.root?.getAttribute("name") ?? null,
    });
  }
}

/** The formatted value (`format` and `locale` on the fader), as its text. */
export class FaderValueElement extends FaderPartElement {
  readonly #text = new ValueText();

  protected override attached() {
    this.#text.mount(this);
  }

  override paint(snapshot: FaderSnapshot) {
    super.paint(snapshot);
    this.#text.write(snapshot.formatted);
  }
}

/** The accessible label: it names the fader's group, and the thumb's input when the thumb has no name of its own. */
export class FaderLabelElement extends FaderPartElement {
  protected override attached(fader: FaderElement) {
    fader.labelId = ensureId(this, FADER_TAGS.label);
    fader.paint();
  }

  protected override detached(fader: FaderElement) {
    if (fader.labelId === this.id) {
      fader.labelId = undefined;
      fader.paint();
    }
  }
}
