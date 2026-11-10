import {
  anchoredScroll,
  createNavigatorController,
  createRangeController,
  createWheelZoom,
  type NavigatorController,
  type NavigatorPart,
  type RangeController,
  type RangeOptions,
  type TimelineSelectionHandlers,
  type TimelineSnapshot,
  thumbOf,
  valueAtOffset,
  visibleRange,
  type WheelZoomController,
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
  placeAt,
  TIMELINE_TAGS,
  type TimelineDescribe,
  type TimelineElement,
  TimelinePartElement,
  UNIT_PROPERTY,
  unitLength,
} from "./root.ts";

/**
 * How much the transforms of the element's ancestors scale it, such as a
 * dialog that zooms in: what `getBoundingClientRect` gives is divided by it
 * to get back to layout px, which `scrollLeft` and `clientWidth` are in.
 */
function layoutScale(element: HTMLElement) {
  const drawn = element.getBoundingClientRect().width;
  const laid = element.offsetWidth;
  return drawn > 0 && laid > 0 ? drawn / laid : 1;
}

/**
 * The scrolling window onto the timeline. Cmd/Ctrl + wheel (and pinch on a
 * trackpad) zooms around the pointer; a bare wheel scrolls as usual. Every
 * zoom change keeps its anchor point in place, or the middle of the view
 * when there is none. A clip moved or trimmed with the pointer held near
 * its edges scrolls it. It reports its scroll offset and width for the
 * navigator. Its structural style sets `overflow-x: auto`.
 */
export class TimelineViewportElement extends TimelinePartElement {
  /** The zoom and scroll the last layout was at: holding a point still through a zoom needs where it was before. */
  #previous: { scrollStart: number; zoom: number } | null = null;
  #wheel: WheelZoomController | undefined;
  #release: AbortController | undefined;
  #observer: ResizeObserver | undefined;
  #frame = 0;
  /** The settling queued after the current paint, if one is. */
  #settling: Promise<void> | null = null;

  override paint(snapshot: TimelineSnapshot) {
    super.paint(snapshot);
    const timeline = this.root;
    if (!timeline) {
      return;
    }
    this.#wheel?.setOptions(this.#wheelOptions(timeline));
    // Once every part is painted: the lanes' new width is what a zoom scrolls across.
    this.#settling ??= Promise.resolve().then(() => {
      this.#settling = null;
      this.#settle();
    });
  }

  protected override attached(timeline: TimelineElement) {
    // What a clip dragged near its edges scrolls, and finds its lanes in.
    this.setAttribute("data-timeline-viewport", "");
    this.#wheel = createWheelZoom(this.#wheelOptions(timeline));
    timeline.scroller = (left) => {
      this.scrollLeft = left;
      if (this.#previous) {
        this.#previous.scrollStart = this.scrollLeft;
      }
      this.#report();
    };
    this.#release = new AbortController();
    const { signal } = this.#release;
    this.addEventListener(
      "scroll",
      () => {
        if (this.#previous) {
          this.#previous.scrollStart = this.scrollLeft;
        }
        this.#report();
      },
      { signal }
    );
    // Not passive: a wheel that zooms must not scroll the page too.
    this.addEventListener(
      "wheel",
      (event) => {
        this.#wheel?.wheel(event, this);
      },
      { passive: false, signal }
    );
    if (typeof ResizeObserver !== "undefined") {
      // A resize is reported on the next frame, outside the layout pass that measured it.
      this.#observer = new ResizeObserver(() => {
        cancelAnimationFrame(this.#frame);
        this.#frame = requestAnimationFrame(() => this.#report());
      });
      this.#observer.observe(this);
    }
  }

  protected override detached(timeline: TimelineElement) {
    this.#release?.abort();
    this.#observer?.disconnect();
    cancelAnimationFrame(this.#frame);
    this.#wheel?.dispose();
    this.#previous = null;
    timeline.scroller = null;
  }

  #wheelOptions(timeline: TimelineElement) {
    return {
      disabled: timeline.snapshot().disabled,
      drawnZoom: () => this.#drawnZoom(),
      duration: timeline.settings.duration,
      origin: () => this.#origin(),
      zoomTo: timeline.zoomTo.bind(timeline),
    };
  }

  /** Where value 0 sits in the scrolled content, in px. */
  #origin(): number {
    const lane = this.root?.originLane;
    if (!lane) {
      return 0;
    }
    return (
      (lane.getBoundingClientRect().left - this.getBoundingClientRect().left) /
        layoutScale(this) +
      this.scrollLeft
    );
  }

  /** px per unit as drawn: the zoom, or what fitting the width gives. */
  #drawnZoom(): number {
    const timeline = this.root;
    if (!timeline) {
      return 0;
    }
    const { duration, zoom } = timeline.snapshot();
    if (zoom !== null) {
      return zoom;
    }
    const width =
      (timeline.originLane?.getBoundingClientRect().width ?? 0) /
      layoutScale(this);
    return width / Math.max(duration, Number.MIN_VALUE);
  }

  /** Holds the anchor of a zoom that just happened still, then reports. */
  #settle() {
    const timeline = this.root;
    if (!timeline) {
      return;
    }
    const current = this.#drawnZoom();
    const previous = this.#previous;
    if (previous && previous.zoom > 0 && previous.zoom !== current) {
      const middle = this.clientWidth / 2;
      const anchor = timeline.anchor ?? {
        offset: middle,
        value: valueAtOffset(
          middle,
          previous.scrollStart,
          previous.zoom,
          this.#origin()
        ),
      };
      timeline.anchor = null;
      this.scrollLeft = anchoredScroll(anchor, current, this.#origin());
    }
    this.#previous = { scrollStart: this.scrollLeft, zoom: current };
    this.#report();
  }

  #report() {
    const timeline = this.root;
    if (!timeline) {
      return;
    }
    const next = {
      origin: this.#origin(),
      scrollStart: this.scrollLeft,
      width: this.clientWidth,
      zoom: this.#drawnZoom(),
    };
    const current = timeline.viewport.get();
    if (
      current.origin !== next.origin ||
      current.scrollStart !== next.scrollStart ||
      current.width !== next.width ||
      current.zoom !== next.zoom
    ) {
      timeline.viewport.set(next);
    }
  }
}

/** The selection listeners of a lane or a ruler that is `selectable`: they fire `selectioninput` and `selectioncommit` on it. */
function selectionOf(element: Element): TimelineSelectionHandlers | undefined {
  if (!element.hasAttribute("selectable")) {
    return;
  }
  return {
    onSelectionChange: (value, details) => {
      const detail = { reason: details.reason, value };
      if (!reportChange(element, detail, "selectioninput")) {
        details.cancel();
      }
    },
    onSelectionCommitted: (value, details) =>
      reportCommit(
        element,
        { reason: details.reason, value },
        "selectioncommit"
      ),
  };
}

/** What every lane shares: it registers with the timeline, so the first one is where value 0 is measured from, and it sets the unit its parts place themselves with. */
abstract class TimelineLaneBase extends TimelinePartElement {
  #unregister: (() => void) | undefined;

  override paint(snapshot: TimelineSnapshot) {
    super.paint(snapshot);
    const { duration, zoom } = snapshot;
    this.style.setProperty(UNIT_PROPERTY, unitLength(zoom, duration));
    // Zoomed, the lane is at least as long as the timeline; fitted, it takes the width it is given.
    this.style.minWidth = zoom === null ? "" : `${duration * zoom}px`;
  }

  protected override attached(timeline: TimelineElement) {
    // What a clip dragged over it finds it by.
    this.setAttribute("data-timeline-lane", "");
    this.#unregister = timeline.registerLane(this);
  }

  protected override detached(_timeline: TimelineElement) {
    this.#unregister?.();
  }
}

/**
 * A strip along the timeline that its parts are placed on: a track, a row of
 * markers. Zoomed, it is as long as the timeline; fitted, it takes the width
 * it is given and the timeline is spread across it. Its `--timeline-unit`
 * CSS variable is the width of one unit. With `seekable`, a press on its
 * bare area moves the position and a drag scrubs; with `selectable` too, a
 * drag selects a stretch of time instead, firing `selectioninput` (which
 * `preventDefault()` refuses) and `selectioncommit` with `[start, end]`.
 */
export class TimelineLaneElement extends TimelineLaneBase {
  #release: AbortController | undefined;

  protected override attached(timeline: TimelineElement) {
    super.attached(timeline);
    this.#release = new AbortController();
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (
          !this.hasAttribute("seekable") ||
          timeline.snapshot().disabled ||
          event.button !== 0 ||
          event.target !== this
        ) {
          return;
        }
        timeline.controller.pressSeek(event, this, this, selectionOf(this));
      },
      { signal: this.#release.signal }
    );
  }

  protected override detached(timeline: TimelineElement) {
    super.detached(timeline);
    this.#release?.abort();
  }
}

/**
 * The lane that moves the position: a press jumps to the pointer and a drag
 * scrubs, both on the grid unless Cmd/Ctrl is held; with Shift held the drag
 * scrubs four times finer. With `selectable`, a drag that starts with Shift
 * held selects a stretch instead, to loop, firing `selectioninput` and
 * `selectioncommit`. It holds the native `<input type="range">` that takes
 * focus and the keys and carries the accessible name: its `aria-label`
 * moves onto it. Its `getAriaValueText(value, duration)` property says how
 * the position is announced, the number by default. Place
 * `<audio-ui-timeline-mark>`s in it for its labels.
 */
export class TimelineRulerElement extends TimelineLaneBase {
  static readonly observedAttributes = [...INPUT_NAMES, "selectable"];

  /** Returns how the position is announced, e.g. `"bar 3, beat 2"`. Defaults to the number. */
  getAriaValueText: TimelineDescribe | undefined;

  readonly #input = rangeInput();
  readonly #names = new Map<string, string>();
  #release: AbortController | undefined;
  #stop: (() => void) | undefined;

  constructor() {
    super();
    this.#input.min = "0";
    this.#input.addEventListener("keydown", (event) => {
      if (this.root?.controller.keyDown(event)) {
        event.preventDefault();
      }
    });
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
      this.root?.controller.setSelection(selectionOf(this) ?? {});
    } else if (takeName(this, this.#names, name, next)) {
      reflect(this.#input, inputNames(this.#names));
    }
  }

  override paint(snapshot: TimelineSnapshot) {
    super.paint(snapshot);
    this.#input.max = String(snapshot.duration);
    this.#input.disabled = snapshot.disabled;
    this.#follow();
  }

  protected override attached(timeline: TimelineElement) {
    super.attached(timeline);
    if (this.#input.parentNode !== this) {
      this.appendChild(this.#input);
    }
    reflect(this.#input, inputNames(this.#names));
    timeline.controller.setSelection(selectionOf(this) ?? {});
    this.#stop = timeline.positionStore.subscribe(() => this.#follow());
    this.#release = new AbortController();
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (timeline.snapshot().disabled || event.button !== 0) {
          return;
        }
        event.preventDefault();
        this.#input.focus({ focusVisible: false, preventScroll: true });
        timeline.controller.pressRuler(event, this, this);
      },
      { signal: this.#release.signal }
    );
  }

  protected override detached(timeline: TimelineElement) {
    super.detached(timeline);
    this.#release?.abort();
    this.#stop?.();
    timeline.controller.setSelection({});
  }

  /** The input follows the position as it moves, like the playhead. */
  #follow() {
    const timeline = this.root;
    if (!timeline) {
      return;
    }
    const value = timeline.positionStore.get();
    const text = (this.getAriaValueText ?? describeNumber)(
      value,
      timeline.settings.duration
    );
    if (this.#input.getAttribute("aria-valuetext") !== text) {
      this.#input.setAttribute("aria-valuetext", text);
    }
    this.#input.value = String(value);
  }
}

/**
 * A marker at the playback position, on the lane it sits in. It follows the
 * position through its own `--timeline-offset` CSS variable. Hidden from
 * assistive technology.
 */
export class TimelinePlayheadElement extends TimelinePartElement {
  #stop: (() => void) | undefined;

  override paint(snapshot: TimelineSnapshot) {
    super.paint(snapshot);
    this.setAttribute("aria-hidden", "true");
  }

  protected override attached(timeline: TimelineElement) {
    const follow = () => placeAt(this, timeline.positionStore.get());
    follow();
    this.#stop = timeline.positionStore.subscribe(follow);
  }

  protected override detached() {
    this.#stop?.();
  }
}

/** How far a press can wander, in px, and still be a press and not a drag. */
const PRESS_SLOP_PX = 3;

/** Whether an event went to a field you type in, where the arrows and a press are the field's own. */
function inField(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/**
 * Something placed at `value` on a lane: a bar number on the ruler, a cue, a
 * grid line. Its content is its label. With `movable` it moves: a drag takes
 * it along the lane, on the grid unless Cmd/Ctrl is held, landing on a
 * `snap-points` place within a few px, and Left and Right on something
 * focused inside it move it by `step` (the timeline's by default). Moving it
 * fires `markinput`, which `preventDefault()` refuses, and `markchange` with
 * `{ value, reason }`. A press that stays one keeps its click; a drag does
 * not click. It carries `data-dragging` while it moves.
 */
export class TimelineMarkElement extends TimelinePartElement {
  static readonly observedAttributes = ["movable", "step", "value"];

  #controller: RangeController | undefined;
  #value: number | undefined;
  /** Where the press began, and whether it became a drag, which then keeps its click. */
  #press: { moved: boolean; x: number } = { moved: false, x: 0 };
  #release: AbortController | undefined;
  #stop: (() => void) | undefined;

  attributeChangedCallback(name: string) {
    if (name === "value") {
      this.#value = numberAttribute(this, "value");
    }
    this.repaint();
  }

  /** Where the mark sits, in the timeline's units. */
  get value(): number {
    return this.#controller?.getSnapshot().value[0] ?? this.#value ?? 0;
  }

  set value(value: number) {
    this.#value = Number(value);
    this.repaint();
  }

  override paint(snapshot: TimelineSnapshot) {
    super.paint(snapshot);
    const controller = this.#controller;
    if (controller) {
      this.#configure(controller, snapshot);
    }
    this.#draw();
  }

  protected override attached(timeline: TimelineElement) {
    const controller = createRangeController(
      this.#options(timeline.snapshot())
    );
    this.#controller = controller;
    this.#stop = controller.subscribe(() => this.#draw());
    this.#release = new AbortController();
    const { signal } = this.#release;
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (
          !this.hasAttribute("movable") ||
          event.button !== 0 ||
          inField(event.target)
        ) {
          return;
        }
        // The press stops here, so the lane underneath doesn't take it.
        event.stopPropagation();
        this.#press = { moved: false, x: event.clientX };
        // Held by what was pressed, so a press that stays one still clicks it.
        controller.press("both", event, event.target as Element, laneOf(this));
      },
      { signal }
    );
    this.addEventListener(
      "click",
      (event) => {
        if (this.#press.moved) {
          this.#press.moved = false;
          event.preventDefault();
          event.stopPropagation();
        }
      },
      { capture: true, signal }
    );
    this.addEventListener(
      "keydown",
      (event) => {
        if (
          this.hasAttribute("movable") &&
          (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
          !(event.altKey || event.ctrlKey || event.metaKey) &&
          !inField(event.target) &&
          controller.keyDown(event)
        ) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      { signal }
    );
  }

  protected override detached() {
    this.#stop?.();
    this.#release?.abort();
    this.#controller = undefined;
  }

  #options(snapshot: TimelineSnapshot): RangeOptions {
    const settings = this.root?.settings;
    const value = this.#value ?? 0;
    return {
      disabled: snapshot.disabled,
      duration: snapshot.duration,
      grid: settings?.grid ?? { offset: 0, step: 0 },
      largeStep: settings?.largeStep ?? 0.1,
      minLength: 0,
      movable: true,
      onValueChange: (range, details) => {
        if (details.reason === "drag" && !this.#press.moved) {
          if (Math.abs(details.event.clientX - this.#press.x) < PRESS_SLOP_PX) {
            details.cancel();
            return;
          }
          this.#press.moved = true;
        }
        const detail = { reason: details.reason, value: range[0] };
        if (!reportChange(this, detail, "markinput")) {
          details.cancel();
          return;
        }
        // Kept up to date, so the next gesture starts from where this one left it.
        this.#value = range[0];
        if (this.root) {
          this.#controller?.setOptions(this.#options(this.root.snapshot()));
        }
      },
      onValueCommitted: (range, details) =>
        reportCommit(
          this,
          { reason: details.reason, value: range[0] },
          "markchange"
        ),
      step: numberAttribute(this, "step") ?? settings?.step ?? 0.01,
      value: [value, value],
      zoom: snapshot.zoom,
    };
  }

  #configure(controller: RangeController, snapshot: TimelineSnapshot) {
    controller.setOptions(this.#options(snapshot));
  }

  #draw() {
    const snapshot = this.#controller?.getSnapshot();
    placeAt(this, snapshot?.value[0] ?? this.#value ?? 0);
    reflect(this, { "data-dragging": snapshot?.dragging ? "" : null });
  }
}

/**
 * The whole timeline as one bar, with the stretch the viewport shows drawn
 * inside it as `<audio-ui-timeline-navigator-window>`: drag the window to
 * scroll, drag one of its `<audio-ui-timeline-navigator-handle>`s to zoom,
 * double-click to show everything. Place it inside the timeline, outside the
 * viewport. `min-window-width` is the least width the window is drawn at, in
 * px, so its handles keep room at any zoom. Its `getAriaValueText(value,
 * duration)` property says how its window and handles announce a position.
 */
export class TimelineNavigatorElement extends TimelinePartElement {
  static readonly observedAttributes = ["min-window-width"];

  /** Returns how a position is announced by the window and its handles. Defaults to the number. */
  getAriaValueText: TimelineDescribe | undefined;
  /** The framework-agnostic navigator behind the bar, its window and its handles. */
  controller: NavigatorController | undefined;
  /** The window as drawn: where its edges sit and how wide it is, as shares of the bar. */
  thumb = { end: 1, start: 0, width: 1 };
  /** The visible stretch, in units. */
  range: readonly [number, number] = [0, 1];

  readonly #parts = new Set<TimelineNavigatorPartElement>();
  #bar = 0;
  #observer: ResizeObserver | undefined;
  #release: AbortController | undefined;
  #stop: (() => void) | undefined;

  attributeChangedCallback() {
    this.#observe();
    this.repaint();
  }

  /** Called by a window or a handle as it connects: drawn at once, then on every change. */
  attach(part: TimelineNavigatorPartElement) {
    this.#parts.add(part);
    part.draw();
  }

  detach(part: TimelineNavigatorPartElement) {
    this.#parts.delete(part);
  }

  override paint(snapshot: TimelineSnapshot) {
    super.paint(snapshot);
    const timeline = this.root;
    if (!timeline) {
      return;
    }
    const options = {
      disabled: snapshot.disabled,
      duration: snapshot.duration,
      maxZoom: timeline.settings.maxZoom,
      metrics: () => timeline.viewport.get(),
      minWindowWidth: this.#minWindowWidth(),
      scrollTo: (left: number) => timeline.scrollViewTo(left),
      zoomTo: timeline.zoomTo.bind(timeline),
    };
    if (this.controller) {
      this.controller.setOptions(options);
    } else {
      this.controller = createNavigatorController(options);
    }
    this.#measure(snapshot.duration);
  }

  protected override attached(timeline: TimelineElement) {
    this.#stop = timeline.viewport.subscribe(() =>
      this.#measure(timeline.settings.duration)
    );
    this.#release = new AbortController();
    this.addEventListener(
      "dblclick",
      (event) => this.controller?.doubleClick(event),
      { signal: this.#release.signal }
    );
    this.#observe();
  }

  protected override detached() {
    this.#stop?.();
    this.#release?.abort();
    this.#observer?.disconnect();
    this.#observer = undefined;
  }

  #minWindowWidth() {
    return numberAttribute(this, "min-window-width") ?? 0;
  }

  /** Watches the bar's width while the window has a least width to keep. */
  #observe() {
    this.#observer?.disconnect();
    this.#observer = undefined;
    if (this.#minWindowWidth() > 0 && typeof ResizeObserver !== "undefined") {
      this.#observer = new ResizeObserver(() => {
        this.#bar = this.getBoundingClientRect().width;
        this.repaint();
      });
      this.#observer.observe(this);
    }
  }

  #measure(duration: number) {
    const timeline = this.root;
    if (!timeline) {
      return;
    }
    const range = visibleRange(timeline.viewport.get(), duration);
    const minWindowWidth = this.#minWindowWidth();
    const drawn =
      minWindowWidth > 0 && this.#bar > 0 && duration > 0
        ? thumbOf(range, duration, this.#bar, minWindowWidth)
        : null;
    const span = drawn ? this.#bar : Math.max(duration, Number.MIN_VALUE);
    const [from, to] = drawn ?? range;
    this.range = range;
    this.thumb = {
      end: to / span,
      start: from / span,
      width: (to - from) / span,
    };
    for (const part of this.#parts) {
      part.draw();
    }
  }
}

/** The window and its handles: each holds an input, and drags the navigator's `part`. */
abstract class TimelineNavigatorPartElement extends TimelinePartElement {
  static readonly observedAttributes: string[] = INPUT_NAMES;

  protected navigator: TimelineNavigatorElement | null = null;
  protected readonly input = rangeInput();
  readonly #names = new Map<string, string>();
  #release: AbortController | undefined;

  constructor() {
    super();
    this.input.addEventListener("keydown", (event) => {
      if (this.navigator?.controller?.keyDown(this.navigatorPart(), event)) {
        event.preventDefault();
      }
    });
    this.input.addEventListener("input", (event) => {
      event.stopPropagation();
      this.navigator?.controller?.typeAt(
        this.navigatorPart(),
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
    if (takeName(this, this.#names, name, next)) {
      reflect(this.input, inputNames(this.#names));
    }
    this.draw();
  }

  override paint(snapshot: TimelineSnapshot) {
    super.paint(snapshot);
    this.draw();
  }

  /** Draws the part from its navigator. */
  abstract draw(): void;

  /** What dragging it moves. */
  protected abstract navigatorPart(): NavigatorPart;

  protected override attached(timeline: TimelineElement) {
    const navigator = this.closest(TIMELINE_TAGS.navigator);
    if (!(navigator instanceof TimelineNavigatorElement)) {
      return;
    }
    this.navigator = navigator;
    if (this.input.parentNode !== this) {
      this.appendChild(this.input);
    }
    reflect(this.input, inputNames(this.#names));
    this.#release = new AbortController();
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0) {
          return;
        }
        event.stopPropagation();
        if (timeline.snapshot().disabled) {
          return;
        }
        event.preventDefault();
        navigator.controller?.press(
          this.navigatorPart(),
          event,
          this,
          navigator
        );
      },
      { signal: this.#release.signal }
    );
    navigator.attach(this);
  }

  protected override detached() {
    this.#release?.abort();
    this.navigator?.detach(this);
    this.navigator = null;
  }

  protected describe(value: number) {
    const duration = this.root?.settings.duration ?? 1;
    return (this.navigator?.getAriaValueText ?? describeNumber)(
      value,
      duration
    );
  }
}

/**
 * The stretch of the timeline the viewport shows. Dragging it scrolls; the
 * native `<input type="range">` it holds scrolls from the keyboard and
 * carries its accessible name.
 */
export class TimelineNavigatorWindowElement extends TimelineNavigatorPartElement {
  draw() {
    const { navigator, root: timeline } = this;
    if (!(navigator && timeline)) {
      return;
    }
    const [start, end] = navigator.range;
    const { duration } = timeline.settings;
    this.style.left = `${navigator.thumb.start * 100}%`;
    this.style.width = `${navigator.thumb.width * 100}%`;
    this.input.min = "0";
    this.input.max = String(Math.max(0, duration - (end - start)));
    this.input.value = String(start);
    this.input.disabled = timeline.snapshot().disabled;
    this.input.setAttribute(
      "aria-valuetext",
      `${this.describe(start)} to ${this.describe(end)}`
    );
  }

  protected navigatorPart(): NavigatorPart {
    return "window";
  }
}

/**
 * One `edge` of the window, `start` or `end`: dragging it zooms, holding
 * the other edge in place. The native `<input type="range">` it holds does
 * the same from the keyboard and carries its accessible name. It carries
 * `data-edge`.
 */
export class TimelineNavigatorHandleElement extends TimelineNavigatorPartElement {
  static override readonly observedAttributes = [...INPUT_NAMES, "edge"];

  draw() {
    const { navigator, root: timeline } = this;
    if (!(navigator && timeline)) {
      return;
    }
    const edge = this.navigatorPart();
    const [start, end] = navigator.range;
    const current = edge === "start" ? start : end;
    this.setAttribute("data-edge", edge);
    this.style.left = `${(edge === "start" ? navigator.thumb.start : navigator.thumb.end) * 100}%`;
    this.input.min = String(edge === "start" ? 0 : start);
    this.input.max = String(
      edge === "start" ? end : timeline.settings.duration
    );
    this.input.value = String(current);
    this.input.disabled = timeline.snapshot().disabled;
    this.input.setAttribute("aria-valuetext", this.describe(current));
  }

  protected navigatorPart(): "end" | "start" {
    return this.getAttribute("edge") === "end" ? "end" : "start";
  }
}
