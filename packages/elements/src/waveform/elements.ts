import {
  clampFinite,
  createStore,
  normalizeRange,
  type Source,
  type Store,
} from "@audio-ui/core";
import {
  attachWaveformBars,
  attachWaveformCanvas,
  createWaveformController,
  createWaveformRegionController,
  isAudible,
  type WaveformIdle,
  type WaveformPeaks,
  type WaveformRegionController,
  type WaveformRegionEdge,
  type WaveformRegionOptions,
  type WaveformRegionValue,
  type WaveformSeekChangeEventDetails,
  type WaveformSeekCommitEventDetails,
  type WaveformSeekController,
  type WaveformSeekOptions,
  type WaveformSeekSnapshot,
  type WaveformVariant,
} from "@audio-ui/core/waveform";
import {
  ElementBase,
  hideVisually,
  listAttribute,
  numberAttribute,
  reflect,
} from "../internal/element.ts";
import { INPUT_NAMES, ValueText } from "../internal/input.ts";
import {
  ControlPart,
  ControlRoot,
  reportChange,
  reportCommit,
} from "../internal/parts.ts";
import { Stamp } from "../internal/stamp.ts";

/** The names the waveform's elements are registered under, frozen: a page cannot rename them by accident. */
export const WAVEFORM_TAGS = Object.freeze({
  bar: "audio-ui-waveform-bar",
  bars: "audio-ui-waveform-bars",
  canvas: "audio-ui-waveform-canvas",
  control: "audio-ui-waveform-control",
  hover: "audio-ui-waveform-hover",
  marker: "audio-ui-waveform-marker",
  playhead: "audio-ui-waveform-playhead",
  region: "audio-ui-waveform-region",
  regionHandle: "audio-ui-waveform-region-handle",
  root: "audio-ui-waveform",
  thumb: "audio-ui-waveform-thumb",
} as const);

/** What a waveform's `input` and `change` events carry, besides the waveform itself as their target. */
export interface WaveformEventDetail<Reason extends string> {
  /** What moved it: `press`, `drag`, `keyboard` or `input-change`. */
  reason: Reason;
  value: number;
}

/** Fired on every seek. Cancel it, with `preventDefault()`, to refuse the position. */
export type WaveformInputEvent = CustomEvent<
  WaveformEventDetail<WaveformSeekChangeEventDetails["reason"]>
>;
/** Fired once a seek that moved the position ends. */
export type WaveformChangeEvent = CustomEvent<
  WaveformEventDetail<WaveformSeekCommitEventDetails["reason"]>
>;

/** The events a waveform fires, as `addEventListener` types them. */
export interface WaveformElementEventMap
  extends Omit<HTMLElementEventMap, "change" | "input"> {
  change: WaveformChangeEvent;
  input: WaveformInputEvent;
}

/** What a selection's and a region's events carry: the stretch, `[start, end]` in `duration` units. */
export interface WaveformRangeDetail {
  /** What moved, on a region: one edge, or the whole of it with `"both"`. */
  edge?: WaveformRegionEdge;
  reason: string;
  value: WaveformRegionValue;
}

/** A live playback position, in `duration` units. */
export type WaveformPositionSource = Source<number>;
/** A live signal: the current levels, 0…1 each, or raw samples for the `scope` variant. */
export type WaveformLevelsSource = Source<ArrayLike<number>>;
/** Returns how a position is announced. */
export type WaveformDescribe = (value: number, duration: number) => string;

/** A share of the track is meaningful whatever unit `duration` is in. */
const describeAsPercent: WaveformDescribe = (value, duration) =>
  `${Math.round((duration > 0 ? value / duration : 0) * 100)}%`;

/** A range attribute, `"start end"`, or `undefined` when it is missing or not two numbers. */
function rangeAttribute(
  element: Element,
  name: string
): WaveformRegionValue | undefined {
  const [start, end] = listAttribute(element, name).map(Number);
  return start !== undefined &&
    end !== undefined &&
    Number.isFinite(start) &&
    Number.isFinite(end)
    ? [start, end]
    : undefined;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** Whether the operating system asks for reduced motion. */
const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia(REDUCED_MOTION).matches;

/** The state every part carries, as the React parts do: `data-disabled`, `data-dragging`, `data-loading`. */
const stateAttributes = (snapshot: WaveformSeekSnapshot) => ({
  "data-disabled": snapshot.disabled ? "" : null,
  "data-dragging": snapshot.dragging ? "" : null,
  "data-loading": snapshot.loading ? "" : null,
});

/**
 * Groups the parts of a waveform and owns what they show: the audio's shape
 * (its `peaks` property, known upfront, or a live `levels` signal) and, for
 * a seekable one, the playback position in `duration` units. The position
 * comes from `value`, or from a live `source` property it follows as it
 * changes; it is the `--waveform-position` CSS variable (a percentage).
 * Every seek fires an `input` event, which `preventDefault()` refuses, and a
 * seek that moved the position fires a `change` when it ends. Its
 * attributes are the React `Waveform.Root`'s props: `duration` (1 by
 * default), `value`, `default-value`, `step` and `large-step` (a hundredth
 * and a tenth of the duration), `range` (`"start end"`, the stretch shown,
 * the whole audio by default), `loading` and `disabled`. While a live signal
 * is audible it carries `data-active`, and while the position is outside the
 * stretch shown, `data-outside`.
 */
export class WaveformElement extends ControlRoot<WaveformSeekSnapshot> {
  static readonly observedAttributes = [
    "default-value",
    "disabled",
    "duration",
    "large-step",
    "loading",
    "range",
    "step",
    "value",
  ];

  /** The framework-agnostic seek behind the waveform: the position, scrubbing, keys, selection. */
  readonly controller: WaveformSeekController = createWaveformController({
    duration: 1,
    largeStep: 0.1,
    range: [0, 1],
    step: 0.01,
  });
  /** The played share of the stretch shown, 0…1, for the parts that draw it. */
  readonly played: Store<number> = createStore(0);

  #value: number | undefined;
  #range: WaveformRegionValue | undefined;
  #peaks: WaveformPeaks | undefined;
  #levels: WaveformLevelsSource | undefined;
  #source: WaveformPositionSource | undefined;
  #unfollow: (() => void) | undefined;
  #unmark: (() => void) | undefined;

  override connectedCallback() {
    super.connectedCallback();
    this.#follow();
    this.#markLevels();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#unfollow?.();
    this.#unfollow = undefined;
    this.#unmark?.();
    this.#unmark = undefined;
  }

  attributeChangedCallback(name: string) {
    if (name === "value") {
      this.#value = numberAttribute(this, "value");
    }
    this.configure();
    this.paint();
  }

  override addEventListener<K extends keyof WaveformElementEventMap>(
    type: K,
    listener: (
      this: WaveformElement,
      event: WaveformElementEventMap[K]
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

  /** The playback position, from 0 to `duration`. Set it to seek; a gesture moves it from there. */
  get value(): number {
    return this.controller.getSnapshot().value;
  }

  set value(value: number) {
    this.#value = Number(value);
    this.configure();
    this.paint();
  }

  /** The stretch of the audio shown, `[start, end]` in `duration` units. Takes over from the `range` attribute. */
  get range(): readonly [number, number] {
    return this.controller.getSnapshot().range;
  }

  set range(range: WaveformRegionValue | undefined) {
    this.#range = range;
    this.configure();
    this.paint();
  }

  /**
   * The audio's shape, at any resolution: a level per slice (0…1), or the
   * lowest and highest sample of each (`{ min, max }`, -1…1). The parts fit
   * it to their size.
   */
  get peaks(): WaveformPeaks | undefined {
    return this.#peaks;
  }

  set peaks(peaks: WaveformPeaks | undefined) {
    this.#peaks = peaks;
    this.paint();
  }

  /** A live signal drawn instead of `peaks`: a microphone, an analyser, a stream. */
  get levels(): WaveformLevelsSource | undefined {
    return this.#levels;
  }

  set levels(levels: WaveformLevelsSource | undefined) {
    this.#levels = levels;
    this.#markLevels();
    this.paint();
  }

  /** A live position, followed as it changes; takes precedence over `value`. */
  get source(): WaveformPositionSource | undefined {
    return this.#source;
  }

  set source(source: WaveformPositionSource | undefined) {
    this.#source = source;
    this.configure();
    this.#follow();
  }

  protected snapshot() {
    return this.controller.getSnapshot();
  }

  protected subscribe(listener: () => void) {
    return this.controller.subscribe(listener);
  }

  protected rootAttributes(snapshot: WaveformSeekSnapshot) {
    const share = this.controller.toShare(
      clampFinite(snapshot.value, 0, snapshot.duration)
    );
    this.style.setProperty(
      "--waveform-position",
      `${Math.min(1, Math.max(0, share)) * 100}%`
    );
    this.played.set(share);
    return {
      ...stateAttributes(snapshot),
      // Outside the stretch shown, a playhead has nowhere true to stand.
      "data-outside": share < 0 || share > 1 ? "" : null,
    };
  }

  protected configure() {
    const duration = numberAttribute(this, "duration") ?? 1;
    const asked = this.#range ?? rangeAttribute(this, "range");
    const [start, end] = asked
      ? normalizeRange(asked, duration)
      : [0, duration];
    const options: WaveformSeekOptions = {
      defaultValue: numberAttribute(this, "default-value"),
      disabled: this.hasAttribute("disabled"),
      duration,
      largeStep: numberAttribute(this, "large-step") ?? duration / 10,
      loading: this.hasAttribute("loading"),
      onValueChange: (value, details) => {
        if (!reportChange(this, { reason: details.reason, value })) {
          details.cancel();
          return;
        }
        // A position set from outside is kept up to date, so the next seek starts from it.
        if (this.#value !== undefined) {
          this.#value = value;
          this.controller.setOptions({ ...options, value });
        }
      },
      onValueCommitted: (value, details) =>
        reportCommit(this, { reason: details.reason, value }),
      range: end > start ? [start, end] : [0, duration],
      source: this.#source,
      step: numberAttribute(this, "step") ?? duration / 100,
      value: this.#value,
    };
    this.controller.setOptions(options);
  }

  /** Paints the position from the live source as it changes. */
  #follow() {
    this.#unfollow?.();
    this.#unfollow = undefined;
    const source = this.#source;
    if (source && this.isConnected) {
      this.#unfollow = source.subscribe(() => this.paint());
    }
    this.paint();
  }

  /** Marks `data-active` while the live signal is audible. */
  #markLevels() {
    this.#unmark?.();
    this.#unmark = undefined;
    this.removeAttribute("data-active");
    const levels = this.#levels;
    if (!(levels && this.isConnected)) {
      return;
    }
    const mark = () =>
      this.toggleAttribute("data-active", isAudible(levels.getSnapshot()));
    mark();
    this.#unmark = levels.subscribe(mark);
  }
}

/** What every part of the waveform does: find its waveform, and carry its state. */
abstract class WaveformPartElement extends ControlPart<
  WaveformElement,
  WaveformSeekSnapshot
> {
  protected readonly rootTag = WAVEFORM_TAGS.root;

  protected isRoot(element: Element | null) {
    return element instanceof WaveformElement;
  }

  protected state(
    snapshot: WaveformSeekSnapshot
  ): Record<string, string | null> {
    return stateAttributes(snapshot);
  }

  /** Paints the part again from its waveform, after one of its own attributes changed. */
  protected repaint() {
    if (this.root) {
      this.paint(this.root.controller.getSnapshot());
    }
  }
}

/** The hidden native range input a part holds: it takes focus and the keys, and carries the names set on the part. */
function rangeInput(): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "range";
  input.step = "any";
  hideVisually(input);
  return input;
}

/** Moves a name just set on `part` onto its input's names. Returns whether they changed. */
function takeName(
  part: Element,
  names: Map<string, string>,
  name: string,
  next: string | null
): boolean {
  // A name never stays on the part, so only its own removal of it comes with no value.
  if (next === null) {
    return false;
  }
  if (next === "") {
    names.delete(name);
  } else {
    names.set(name, next);
  }
  part.removeAttribute(name);
  return true;
}

/** The names an input carries, from the ones its part was given. */
const inputNames = (names: Map<string, string>) => ({
  "aria-describedby": names.get("aria-describedby") ?? null,
  "aria-label": names.get("aria-label") ?? null,
  "aria-labelledby": names.get("aria-labelledby") ?? null,
});

/**
 * The seekable surface: a press jumps to the pointer and a drag scrubs. It
 * tracks the hovered position for `<audio-ui-waveform-hover>`, sets
 * `touch-action: none`, and holds the native `<input type="range">` that
 * takes focus and the keys and carries the accessible name: its
 * `aria-label`, `aria-labelledby` and `aria-describedby` move onto it. Its
 * `getAriaValueText(value, duration)` property says how the position is
 * announced, the played share by default ("30%"). With `selectable`, a drag
 * with Shift held selects a stretch instead, firing `selectioninput` (which
 * `preventDefault()` refuses) and `selectioncommit` with `[start, end]`:
 * not `selectionchange`, the browser's own event for text selection.
 * Leave it out for a waveform that is only shown.
 */
export class WaveformControlElement extends WaveformPartElement {
  static readonly observedAttributes = [...INPUT_NAMES, "selectable"];

  /** Returns how the position is announced, e.g. `"0:12 of 1:42"`. Defaults to the played share, e.g. `"30%"`. */
  getAriaValueText: WaveformDescribe | undefined;

  readonly #input = rangeInput();
  readonly #names = new Map<string, string>();
  #release: AbortController | undefined;

  constructor() {
    super();
    this.#input.addEventListener("keydown", (event) => {
      if (this.root?.controller.keyDown(event)) {
        event.preventDefault();
      }
    });
    // Assistive technology may set the input's value directly; the waveform reports it as its own seek.
    this.#input.addEventListener("input", (event) => {
      event.stopPropagation();
      this.root?.controller.typeAt(Number(this.#input.value), event);
    });
    this.#input.addEventListener("change", (event) => event.stopPropagation());
  }

  /** The native range input, which takes focus. */
  get input(): HTMLInputElement {
    return this.#input;
  }

  attributeChangedCallback(
    name: string,
    _previous: string | null,
    next: string | null
  ) {
    if (name === "selectable") {
      this.#select();
      return;
    }
    if (takeName(this, this.#names, name, next)) {
      reflect(this.#input, inputNames(this.#names));
    }
  }

  override paint(snapshot: WaveformSeekSnapshot) {
    super.paint(snapshot);
    const input = this.#input;
    const [min, max] = snapshot.range;
    input.min = String(min);
    input.max = String(max);
    input.disabled = snapshot.disabled;
    const value = clampFinite(snapshot.value, 0, snapshot.duration);
    // Written when the words change: a live position paints every frame.
    const text = (this.getAriaValueText ?? describeAsPercent)(
      value,
      snapshot.duration
    );
    if (input.getAttribute("aria-valuetext") !== text) {
      input.setAttribute("aria-valuetext", text);
      input.value = String(value);
    }
  }

  protected override attached(waveform: WaveformElement) {
    if (this.#input.parentNode !== this) {
      this.appendChild(this.#input);
    }
    reflect(this.#input, inputNames(this.#names));
    this.#select();
    this.#release = new AbortController();
    const { signal } = this.#release;
    const { controller } = waveform;
    // Nothing to seek while disabled, or before the audio is there.
    const inert = () => {
      const { disabled, loading } = controller.getSnapshot();
      return disabled || loading;
    };
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (inert() || event.button !== 0) {
          return;
        }
        event.preventDefault();
        this.#input.focus({ focusVisible: false, preventScroll: true });
        controller.pressSeek(event, this);
      },
      { signal }
    );
    this.addEventListener(
      "pointermove",
      (event) => {
        if (!inert()) {
          controller.hoverAt(event.clientX, this);
        }
      },
      { signal }
    );
    this.addEventListener("pointerleave", () => controller.leave(), {
      signal,
    });
  }

  protected override detached(waveform: WaveformElement) {
    this.#release?.abort();
    waveform.controller.setSelection({});
  }

  /** Gives the waveform this control's selection listeners, while it is `selectable`. */
  #select() {
    this.root?.controller.setSelection(
      this.hasAttribute("selectable")
        ? {
            onSelectionChange: (value, details) => {
              const detail = { reason: details.reason, value };
              if (!reportChange(this, detail, "selectioninput")) {
                details.cancel();
              }
            },
            onSelectionCommitted: (value, details) =>
              reportCommit(
                this,
                { reason: details.reason, value },
                "selectioncommit"
              ),
          }
        : {}
    );
  }
}

/** A handle centered on the playback position, through `--waveform-position`. Hidden from assistive technology. */
export class WaveformThumbElement extends WaveformPartElement {
  override paint(snapshot: WaveformSeekSnapshot) {
    super.paint(snapshot);
    this.setAttribute("aria-hidden", "true");
  }
}

/** A marker at the playback position, with no interaction of its own. Hidden from assistive technology. */
export class WaveformPlayheadElement extends WaveformPartElement {
  override paint(snapshot: WaveformSeekSnapshot) {
    super.paint(snapshot);
    this.setAttribute("aria-hidden", "true");
  }
}

/**
 * Shown while the pointer is over the control, at the hovered point. Its
 * `format(value, duration)` property writes the hovered position as its
 * text, such as a time; without it, it keeps what it holds. Hidden from
 * assistive technology.
 */
export class WaveformHoverElement extends WaveformPartElement {
  readonly #text = new ValueText();
  #format: WaveformDescribe | undefined;
  #stop: (() => void) | undefined;

  /** Writes the hovered position, in `duration` units, as the text shown. */
  get format(): WaveformDescribe | undefined {
    return this.#format;
  }

  set format(format: WaveformDescribe | undefined) {
    this.#format = format;
    if (format) {
      this.#text.mount(this);
    }
    this.repaint();
  }

  override paint(snapshot: WaveformSeekSnapshot) {
    super.paint(snapshot);
    this.setAttribute("aria-hidden", "true");
    const waveform = this.root;
    const hovered = waveform?.controller.hover.get() ?? null;
    const shown = hovered !== null && !(snapshot.disabled || snapshot.loading);
    this.style.display = shown ? "" : "none";
    if (!(waveform && shown)) {
      return;
    }
    this.style.left = `${waveform.controller.toShare(hovered) * 100}%`;
    if (this.#format) {
      this.#text.write(this.#format(hovered, snapshot.duration));
    }
  }

  protected override attached(waveform: WaveformElement) {
    this.#stop = waveform.controller.hover.subscribe(() => this.repaint());
  }

  protected override detached() {
    this.#stop?.();
  }
}

/** A point of interest, such as a cue or a chapter, placed at its `value`. Its content labels it. */
export class WaveformMarkerElement extends WaveformPartElement {
  static readonly observedAttributes = ["value"];

  attributeChangedCallback() {
    this.repaint();
  }

  override paint(snapshot: WaveformSeekSnapshot) {
    super.paint(snapshot);
    const value = clampFinite(
      numberAttribute(this, "value") ?? 0,
      0,
      snapshot.duration
    );
    this.style.left = `${(this.root?.controller.toShare(value) ?? 0) * 100}%`;
  }
}

/** The element a region's pixels are measured on: the track it is positioned in. */
const trackOf = (region: HTMLElement): Element | null =>
  region.offsetParent ?? region.parentElement;

/**
 * A stretch of the audio, such as a loop or a selection, laid over the
 * waveform from `value`'s start to its end (`"start end"` in `duration`
 * units, the whole audio by default). Dragging its body moves it, unless
 * `movable="false"`; an `<audio-ui-waveform-region-handle>` per edge resizes
 * it. Moving it fires `regioninput`, with `{ value, edge, reason }`, which
 * `preventDefault()` refuses, and `regionchange` when the move ends: names
 * of their own, so a listener for the waveform's seeks never takes them. `min-length`
 * is the shortest it can be, the waveform's `step` by default.
 */
export class WaveformRegionElement extends WaveformPartElement {
  static readonly observedAttributes = [
    "default-value",
    "disabled",
    "min-length",
    "movable",
    "value",
  ];

  /** The framework-agnostic region behind it: its span, the drags of its body and edges, the keys. */
  readonly controller: WaveformRegionController =
    createWaveformRegionController({
      duration: 1,
      largeStep: 0.1,
      minLength: 0.01,
      step: 0.01,
    });

  #value: WaveformRegionValue | undefined;
  #release: AbortController | undefined;
  #stop: (() => void) | undefined;

  attributeChangedCallback(name: string) {
    if (name === "value") {
      this.#value = rangeAttribute(this, "value");
    }
    this.repaint();
  }

  /** The region, `[start, end]` in `duration` units. Set it to move the region; a drag moves it from there. */
  get value(): WaveformRegionValue {
    return this.controller.getSnapshot().value;
  }

  set value(value: WaveformRegionValue) {
    this.#value = [Number(value[0]), Number(value[1])];
    this.repaint();
  }

  override paint(snapshot: WaveformSeekSnapshot) {
    this.#configure(snapshot);
    this.#draw(snapshot);
  }

  /** Starts a drag of `edge` from `handle`, unless the region is disabled. Returns whether it started. */
  press(edge: WaveformRegionEdge, event: PointerEvent, handle: Element) {
    if (event.button !== 0) {
      return false;
    }
    // The press stops here, so the control underneath doesn't take it for a seek.
    event.stopPropagation();
    const waveform = this.root;
    if (!waveform || this.controller.getSnapshot().disabled) {
      return false;
    }
    event.preventDefault();
    this.controller.press(
      edge,
      event,
      handle,
      trackOf(this),
      waveform.controller.getSnapshot().range
    );
    return true;
  }

  protected override attached(waveform: WaveformElement) {
    this.#stop = this.controller.subscribe(() =>
      this.#draw(waveform.controller.getSnapshot())
    );
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
    this.#stop?.();
    this.#release?.abort();
  }

  #configure(snapshot: WaveformSeekSnapshot) {
    const options: WaveformRegionOptions = {
      defaultValue: rangeAttribute(this, "default-value"),
      disabled: snapshot.disabled || this.hasAttribute("disabled"),
      duration: snapshot.duration,
      largeStep: snapshot.largeStep,
      minLength: numberAttribute(this, "min-length") ?? snapshot.step,
      onValueChange: (value, details) => {
        const detail = { edge: details.edge, reason: details.reason, value };
        if (!reportChange(this, detail, "regioninput")) {
          details.cancel();
          return;
        }
        // A region set from outside is kept up to date, so the next drag starts from it.
        if (this.#value !== undefined) {
          this.#value = value;
          this.controller.setOptions({ ...options, value });
        }
      },
      onValueCommitted: (value, details) =>
        reportCommit(
          this,
          { edge: details.edge, reason: details.reason, value },
          "regionchange"
        ),
      step: snapshot.step,
      value: this.#value,
    };
    this.controller.setOptions(options);
  }

  #draw(waveform: WaveformSeekSnapshot) {
    const { disabled, dragging, value } = this.controller.getSnapshot();
    reflect(this, {
      ...stateAttributes(waveform),
      "data-disabled": disabled ? "" : null,
      "data-dragging": dragging ? "" : null,
    });
    const [from, to] = waveform.range;
    const span = to - from;
    const percent = (length: number) =>
      `${(span > 0 ? length / span : 0) * 100}%`;
    this.style.left = percent(value[0] - from);
    this.style.width = percent(value[1] - value[0]);
    for (const handle of this.querySelectorAll(WAVEFORM_TAGS.regionHandle)) {
      if (handle instanceof WaveformRegionHandleElement) {
        handle.draw();
      }
    }
  }
}

/**
 * Resizes one `edge` of the region it sits in, `start` or `end`: by
 * dragging, or from the keyboard through the native `<input type="range">`
 * it holds, which carries the accessible name (its `aria-label` moves onto
 * it). Its `getAriaValueText(value, duration)` property says how the edge's
 * position is announced, its share of the audio by default. It carries
 * `data-edge`.
 */
export class WaveformRegionHandleElement extends WaveformPartElement {
  static readonly observedAttributes = [...INPUT_NAMES, "edge"];

  /** Returns how the edge's position is announced, e.g. `"0:12"`. Defaults to its share of the audio, e.g. `"30%"`. */
  getAriaValueText: WaveformDescribe | undefined;

  readonly #input = rangeInput();
  readonly #names = new Map<string, string>();
  #region: WaveformRegionElement | null = null;
  #release: AbortController | undefined;

  constructor() {
    super();
    this.#input.addEventListener("keydown", (event) => {
      if (this.#region?.controller.keyDown(this.#edge(), event)) {
        event.preventDefault();
      }
    });
    this.#input.addEventListener("input", (event) => {
      event.stopPropagation();
      this.#region?.controller.typeAt(
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

  /** Paints the handle from its region. */
  draw() {
    const region = this.#region;
    const waveform = this.root;
    if (!(region && waveform)) {
      return;
    }
    const edge = this.#edge();
    const { disabled, dragging, value } = region.controller.getSnapshot();
    const { duration } = waveform.controller.getSnapshot();
    const current = edge === "start" ? value[0] : value[1];
    // How far this edge can go before it meets the other one.
    const [min, max] = region.controller.edgeRange(edge);
    reflect(this, {
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
      (this.getAriaValueText ?? describeAsPercent)(current, duration)
    );
  }

  protected override attached() {
    const region = this.closest(WAVEFORM_TAGS.region);
    if (!(region instanceof WaveformRegionElement)) {
      return;
    }
    this.#region = region;
    if (this.#input.parentNode !== this) {
      this.appendChild(this.#input);
    }
    reflect(this.#input, inputNames(this.#names));
    this.#release = new AbortController();
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (region.press(this.#edge(), event, this)) {
          this.#input.focus({ focusVisible: false, preventScroll: true });
        }
      },
      { signal: this.#release.signal }
    );
    this.draw();
  }

  protected override detached() {
    this.#release?.abort();
    this.#region = null;
  }

  #edge(): "end" | "start" {
    return this.getAttribute("edge") === "end" ? "end" : "start";
  }
}

/**
 * A part that draws the audio with one of the core painters: it starts it
 * again whenever what it draws from changes, and stops it when it leaves.
 */
abstract class WaveformPainterElement extends WaveformPartElement {
  /** Whether the operating system asks for reduced motion, kept current while connected. */
  protected reduced = false;
  #stop: (() => void) | undefined;
  #drawn: unknown[] = [];
  #settings: unknown[] = [];
  #motion: AbortController | undefined;

  attributeChangedCallback() {
    this.#settings = this.settings();
    this.repaint();
  }

  override paint(snapshot: WaveformSeekSnapshot) {
    super.paint(snapshot);
    this.setAttribute("aria-hidden", "true");
    const waveform = this.root;
    if (!waveform) {
      return;
    }
    const inputs = [
      waveform.peaks,
      waveform.levels,
      snapshot.duration,
      snapshot.loading,
      snapshot.range[0],
      snapshot.range[1],
      this.reduced,
      ...this.#settings,
    ];
    if (
      this.#stop &&
      inputs.length === this.#drawn.length &&
      inputs.every((input, index) => Object.is(input, this.#drawn[index]))
    ) {
      return;
    }
    this.#drawn = inputs;
    this.#stop?.();
    this.#stop = this.start(waveform, snapshot);
  }

  protected override attached() {
    this.#settings = this.settings();
    this.reduced = reducedMotion();
    if (typeof matchMedia === "function") {
      this.#motion = new AbortController();
      matchMedia(REDUCED_MOTION).addEventListener(
        "change",
        () => {
          this.reduced = reducedMotion();
          this.repaint();
        },
        { signal: this.#motion.signal }
      );
    }
  }

  protected override detached() {
    this.#motion?.abort();
    this.#stop?.();
    this.#stop = undefined;
    this.#drawn = [];
  }

  /** The part's own settings, from its attributes: a change of any starts the painter again. */
  protected abstract settings(): unknown[];

  /** Starts the painter; returns what stops it. */
  protected abstract start(
    waveform: WaveformElement,
    snapshot: WaveformSeekSnapshot
  ): () => void;
}

const IDLE: readonly string[] = ["none", "pulse", "wave"];
const VARIANTS: readonly string[] = ["bars", "line", "mirror", "scope"];

/** An attribute that names one of `choices`, or `undefined`. */
function choiceAttribute<T extends string>(
  element: Element,
  name: string,
  choices: readonly string[]
): T | undefined {
  const value = element.getAttribute(name);
  return value !== null && choices.includes(value) ? (value as T) : undefined;
}

/**
 * Draws the waveform on a canvas it holds, laid out on the device pixel
 * grid: as many bars as fit its width, every edge on a physical pixel, so it
 * stays sharp at any pixel density. It paints only when something changed,
 * and not while off screen. The played part is drawn in the
 * `--waveform-progress-color` CSS color and the rest in `--waveform-color`,
 * both the text color by default. Its attributes are the React
 * `Waveform.Canvas`'s props: `variant` (`mirror`, `bars`, `line`, or `scope`
 * for raw samples), `bar-width` (2), `bar-gap` (1), `bar-radius` (or the
 * `--waveform-bar-radius` CSS length), `min-bar-height` (2), `gain`,
 * `mirrored`, `idle` (`none`, `pulse` or `wave`), `mode` (`static` or
 * `scrolling`, for a live signal), `scroll-speed` (60 px per second) and
 * `line-width` (1.5, for `scope`).
 */
export class WaveformCanvasElement extends WaveformPainterElement {
  static readonly observedAttributes = [
    "bar-gap",
    "bar-radius",
    "bar-width",
    "gain",
    "idle",
    "line-width",
    "min-bar-height",
    "mirrored",
    "mode",
    "scroll-speed",
    "variant",
  ];

  readonly #canvas = document.createElement("canvas");

  constructor() {
    super();
    Object.assign(this.#canvas.style, {
      display: "block",
      height: "100%",
      width: "100%",
    });
  }

  /** The canvas it draws on. */
  get canvas(): HTMLCanvasElement {
    return this.#canvas;
  }

  protected override attached() {
    super.attached();
    if (this.#canvas.parentNode !== this) {
      this.appendChild(this.#canvas);
    }
  }

  protected settings() {
    return WaveformCanvasElement.observedAttributes.map((name) =>
      this.getAttribute(name)
    );
  }

  protected start(waveform: WaveformElement, snapshot: WaveformSeekSnapshot) {
    return attachWaveformCanvas(this.#canvas, {
      barGap: numberAttribute(this, "bar-gap"),
      barRadius: numberAttribute(this, "bar-radius"),
      barWidth: numberAttribute(this, "bar-width"),
      duration: snapshot.duration,
      gain: numberAttribute(this, "gain"),
      idle: choiceAttribute<WaveformIdle>(this, "idle", IDLE),
      levels: waveform.levels,
      lineWidth: numberAttribute(this, "line-width"),
      loading: snapshot.loading,
      minBarHeight: numberAttribute(this, "min-bar-height"),
      mirrored: this.hasAttribute("mirrored"),
      mode: this.getAttribute("mode") === "scrolling" ? "scrolling" : "static",
      peaks: waveform.peaks,
      played: waveform.played,
      range: snapshot.range,
      reducedMotion: this.reduced,
      scrollSpeed: numberAttribute(this, "scroll-speed"),
      variant: choiceAttribute<WaveformVariant>(this, "variant", VARIANTS),
    });
  }
}

const DEFAULT_BAR_COUNT = 24;
const DEFAULT_MIN_LEVEL = 0.08;

/**
 * Draws the waveform as a row of `count` elements (24), one
 * `<audio-ui-waveform-bar>` each, for a visualizer styled in plain CSS: each
 * bar's level, 0…1, is its `--waveform-level` CSS variable, rising at once
 * and falling smoothly, and nothing is written while they rest or sit off
 * screen. Bars the position has passed carry `data-played`. Each bar holds
 * what its `<template>` holds, if it has one. Its attributes are the React
 * `Waveform.Bars`'s props: `count`, `gain`, `idle`, `min-level` (0.08) and
 * `mirrored`.
 */
export class WaveformBarsElement extends WaveformPainterElement {
  static readonly observedAttributes = [
    "count",
    "gain",
    "idle",
    "min-level",
    "mirrored",
  ];

  readonly #stamp = new Stamp(this, WAVEFORM_TAGS.bar, "index", (bar) =>
    (bar as HTMLElement).style.setProperty(
      "--waveform-level",
      String(this.#minLevel())
    )
  );
  #bars: Element[] = [];

  protected override attached() {
    super.attached();
    this.#stamp.connect();
  }

  protected override detached() {
    super.detached();
    this.#stamp.disconnect();
  }

  protected settings() {
    return WaveformBarsElement.observedAttributes.map((name) =>
      this.getAttribute(name)
    );
  }

  protected start(waveform: WaveformElement, snapshot: WaveformSeekSnapshot) {
    const count = Math.max(
      0,
      Math.round(numberAttribute(this, "count") ?? DEFAULT_BAR_COUNT)
    );
    this.#stamp.update(Array.from({ length: count }, (_, index) => index));
    this.#bars = this.#stamp.items();
    return attachWaveformBars(
      this,
      (index) => this.#bars[index] as HTMLElement | undefined,
      {
        count,
        duration: snapshot.duration,
        gain: numberAttribute(this, "gain"),
        idle: choiceAttribute<WaveformIdle>(this, "idle", IDLE),
        levels: waveform.levels,
        loading: snapshot.loading,
        minLevel: this.#minLevel(),
        mirrored: this.hasAttribute("mirrored"),
        peaks: waveform.peaks,
        played: waveform.played,
        range: snapshot.range,
        reducedMotion: this.reduced,
      }
    );
  }

  #minLevel() {
    return numberAttribute(this, "min-level") ?? DEFAULT_MIN_LEVEL;
  }
}

/** One bar of `<audio-ui-waveform-bars>`, for its `index`: size it from `--waveform-level`, such as `height: calc(var(--waveform-level) * 100%)`. */
export class WaveformBarElement extends ElementBase {}
