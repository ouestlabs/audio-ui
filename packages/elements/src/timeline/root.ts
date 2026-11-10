import {
  clampFinite,
  createStore,
  type Source,
  type Store,
} from "@audio-ui/core";
import {
  createTimelineController,
  type Grid,
  type TimelineController,
  type TimelineOptions,
  type TimelinePositionChangeEventDetails,
  type TimelinePositionCommitEventDetails,
  type TimelineSnapshot,
  type TimelineZoomChangeEventDetails,
  type ZoomAnchor,
} from "@audio-ui/core/timeline";
import {
  listAttribute,
  numberAttribute,
  reflect,
} from "../internal/element.ts";
import {
  ControlPart,
  ControlRoot,
  reportChange,
  reportCommit,
} from "../internal/parts.ts";

/** The names the timeline's elements are registered under, frozen: a page cannot rename them by accident. */
export const TIMELINE_TAGS = Object.freeze({
  clip: "audio-ui-timeline-clip",
  clipFade: "audio-ui-timeline-clip-fade",
  clipFadeHandle: "audio-ui-timeline-clip-fade-handle",
  clipHandle: "audio-ui-timeline-clip-handle",
  clipHeader: "audio-ui-timeline-clip-header",
  lane: "audio-ui-timeline-lane",
  mark: "audio-ui-timeline-mark",
  navigator: "audio-ui-timeline-navigator",
  navigatorHandle: "audio-ui-timeline-navigator-handle",
  navigatorWindow: "audio-ui-timeline-navigator-window",
  playhead: "audio-ui-timeline-playhead",
  range: "audio-ui-timeline-range",
  rangeHandle: "audio-ui-timeline-range-handle",
  root: "audio-ui-timeline",
  ruler: "audio-ui-timeline-ruler",
  track: "audio-ui-timeline-track",
  trackHeader: "audio-ui-timeline-track-header",
  trackResizeHandle: "audio-ui-timeline-track-resize-handle",
  viewport: "audio-ui-timeline-viewport",
});

/** Set on every lane: the width of one unit of time, so parts place themselves with `calc()`. */
export const UNIT_PROPERTY = "--timeline-unit";
/** Set on every placed part: where it sits, in units. */
export const OFFSET_PROPERTY = "--timeline-offset";
/** Set on every part that spans a stretch of the lane: how long it is, in units. */
export const LENGTH_PROPERTY = "--timeline-length";

/** How the viewport is scrolled and zoomed, as last laid out. */
export interface ViewportMetrics {
  /** Where value 0 sits in the scrolled content, in px: for example, past a column of headers. */
  origin: number;
  scrollStart: number;
  /** Visible width, in px. */
  width: number;
  /** px per unit as drawn: the zoom, or what fitting the width gives. */
  zoom: number;
}

/** What the timeline's parts measure and step by, as its attributes set them. */
export interface TimelineSettings {
  duration: number;
  grid: Grid;
  largeStep: number;
  maxZoom: number;
  minZoom: number;
  step: number;
}

/** What a timeline's `input` and `change` events carry, besides the timeline itself as their target. */
export interface TimelineEventDetail<Reason extends string> {
  /** What moved it: `press`, `drag`, `keyboard` or `input-change`. */
  reason: Reason;
  value: number;
}

/** Fired on every move of the position. Cancel it, with `preventDefault()`, to refuse it. */
export type TimelineInputEvent = CustomEvent<
  TimelineEventDetail<TimelinePositionChangeEventDetails["reason"]>
>;
/** Fired once a gesture that moved the position ends. */
export type TimelineChangeEvent = CustomEvent<
  TimelineEventDetail<TimelinePositionCommitEventDetails["reason"]>
>;
/** Fired when the zoom changes, already clamped. Cancel it to keep the zoom where it was. */
export type TimelineZoomEvent = CustomEvent<{
  reason: TimelineZoomChangeEventDetails["reason"];
  value: number;
}>;

/** The events a timeline fires, as `addEventListener` types them. */
export interface TimelineElementEventMap
  extends Omit<HTMLElementEventMap, "change" | "input"> {
  change: TimelineChangeEvent;
  input: TimelineInputEvent;
  zoomchange: TimelineZoomEvent;
}

/** The width of one unit: px when zoomed, a share of the lane when fitted. */
export function unitLength(zoom: number | null, duration: number): string {
  return zoom === null
    ? `calc(100% / ${duration > 0 ? duration : 1})`
    : `${zoom}px`;
}

/** Turns a number into the round form a position is announced in by default. */
export const describeNumber = (value: number) =>
  String(Math.round(value * 100) / 100);

/** Returns how a position is announced. */
export type TimelineDescribe = (value: number, duration: number) => string;

/** The state every part carries, as the React parts do: `data-disabled`, `data-fitted`, `data-scrubbing`. */
export const stateAttributes = (snapshot: TimelineSnapshot) => ({
  "data-disabled": snapshot.disabled ? "" : null,
  "data-fitted": snapshot.fitted ? "" : null,
  "data-scrubbing": snapshot.scrubbing ? "" : null,
});

/**
 * Groups the parts of a timeline and owns what they share: its length, its
 * zoom, its grid and the playback position. Units are yours: seconds,
 * beats, pulses or steps. `zoom` is how many px one unit takes; leave it out
 * and the timeline fits the width it is given. The position is its
 * `position`, or a live `source` property the playhead follows as it
 * changes. With a `snap-step`, every gesture lands on the grid unless
 * Cmd/Ctrl is held, and `snap-points` (the edges of other clips, the
 * locators) pull a dragged clip or range onto them from a few px away.
 * Moving the position fires `input`, which `preventDefault()` refuses, and
 * `change` when the gesture ends; a new zoom fires `zoomchange`. Its
 * attributes are the React `Timeline.Root`'s props: `duration` (1),
 * `position`, `default-position`, `zoom`, `default-zoom`, `min-zoom`,
 * `max-zoom`, `step`, `large-step`, `snap-step`, `snap-offset`,
 * `snap-points` and `disabled`.
 */
export class TimelineElement extends ControlRoot<TimelineSnapshot> {
  static readonly observedAttributes = [
    "default-position",
    "default-zoom",
    "disabled",
    "duration",
    "large-step",
    "max-zoom",
    "min-zoom",
    "position",
    "snap-offset",
    "snap-points",
    "snap-step",
    "step",
    "zoom",
  ];

  /** The framework-agnostic position and zoom behind every part: scrubbing, keys, zoom. */
  readonly controller: TimelineController = createTimelineController({
    duration: 1,
    grid: { offset: 0, step: 0 },
    largeStep: 0.1,
    maxZoom: Number.POSITIVE_INFINITY,
    minZoom: 0,
    step: 0.01,
  });
  /** The position as displayed, for the playhead and the ruler to follow. */
  readonly positionStore: Store<number> = createStore(0);
  /** How the viewport is scrolled and zoomed, for the navigator. */
  readonly viewport: Store<ViewportMetrics> = createStore<ViewportMetrics>({
    origin: 0,
    scrollStart: 0,
    width: 0,
    zoom: 0,
  });
  /** Where the next zoom holds still; the viewport applies it once laid out. */
  anchor: ZoomAnchor | null = null;
  /** Set by the viewport: scrolls it and reports at once. */
  scroller: ((left: number) => void) | null = null;

  #settings: TimelineSettings = {
    duration: 1,
    grid: { offset: 0, step: 0 },
    largeStep: 0.1,
    maxZoom: Number.POSITIVE_INFINITY,
    minZoom: 0,
    step: 0.01,
  };
  #lanes: HTMLElement[] = [];
  #position: number | undefined;
  #zoom: number | null | undefined;
  #source: Source<number> | undefined;
  #snapPoints: readonly number[] | undefined;
  #unfollow: (() => void) | undefined;

  override connectedCallback() {
    super.connectedCallback();
    this.#follow();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#unfollow?.();
    this.#unfollow = undefined;
  }

  attributeChangedCallback(name: string) {
    if (name === "position") {
      this.#position = numberAttribute(this, "position");
    } else if (name === "zoom") {
      this.#zoom = numberAttribute(this, "zoom");
    }
    this.configure();
    this.paint();
  }

  override addEventListener<K extends keyof TimelineElementEventMap>(
    type: K,
    listener: (
      this: TimelineElement,
      event: TimelineElementEventMap[K]
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

  /** The playback position, from 0 to `duration`. Set it to move the playhead; a gesture moves it from there. */
  get position(): number {
    return this.controller.getSnapshot().position;
  }

  set position(position: number) {
    this.#position = Number(position);
    this.configure();
    this.paint();
  }

  /** The zoom in px per unit, or null while the timeline fits its width. */
  get zoom(): number | null {
    return this.controller.getSnapshot().zoom;
  }

  set zoom(zoom: number | null) {
    this.#zoom = zoom === null ? null : Number(zoom);
    this.configure();
    this.paint();
  }

  /** A live position followed as it changes; takes precedence over `position`. */
  get source(): Source<number> | undefined {
    return this.#source;
  }

  set source(source: Source<number> | undefined) {
    this.#source = source;
    this.configure();
    this.#follow();
  }

  /** Places that pull a dragged clip or range onto them. Takes over from the `snap-points` attribute. */
  get snapPoints(): readonly number[] | undefined {
    return this.#snapPoints ?? this.#snapPointsAttribute();
  }

  set snapPoints(points: readonly number[] | undefined) {
    this.#snapPoints = points;
    this.configure();
    this.paint();
  }

  /** What the parts measure and step by. */
  get settings(): TimelineSettings {
    return this.#settings;
  }

  /** The first lane connected: where value 0 is measured from. */
  get originLane(): HTMLElement | null {
    return this.#lanes[0] ?? null;
  }

  /** Records a lane; returns what forgets it. */
  registerLane(lane: HTMLElement): () => void {
    this.#lanes.push(lane);
    return () => {
      this.#lanes = this.#lanes.filter((each) => each !== lane);
    };
  }

  /** Clamps and proposes a zoom, held still around `anchor`. Returns whether it is applied. */
  zoomTo(
    next: number,
    details: TimelineZoomChangeEventDetails,
    anchor?: ZoomAnchor
  ): boolean {
    if (!this.controller.zoomTo(next, details)) {
      return false;
    }
    this.anchor = anchor ?? null;
    return true;
  }

  /** Scrolls the viewport to `left` px. */
  scrollViewTo(left: number) {
    this.scroller?.(left);
  }

  /** The timeline's snapshot, as the parts draw it. */
  snapshot(): TimelineSnapshot {
    return this.controller.getSnapshot();
  }

  protected subscribe(listener: () => void) {
    return this.controller.subscribe(listener);
  }

  protected rootAttributes(snapshot: TimelineSnapshot) {
    this.positionStore.set(
      clampFinite(snapshot.position, 0, snapshot.duration)
    );
    return stateAttributes(snapshot);
  }

  protected configure() {
    const duration = numberAttribute(this, "duration") ?? 1;
    const snapStep = numberAttribute(this, "snap-step") ?? 0;
    const step =
      numberAttribute(this, "step") ??
      (snapStep > 0 ? snapStep : duration / 100);
    const grid: Grid = {
      offset: numberAttribute(this, "snap-offset") ?? 0,
      points: this.snapPoints,
      step: snapStep,
    };
    const previous = this.#settings.grid;
    this.#settings = {
      duration,
      // The same grid while it says the same, so the parts keep theirs.
      grid:
        previous.offset === grid.offset &&
        previous.step === grid.step &&
        previous.points === grid.points
          ? previous
          : grid,
      largeStep: numberAttribute(this, "large-step") ?? step * 10,
      maxZoom: numberAttribute(this, "max-zoom") ?? Number.POSITIVE_INFINITY,
      minZoom: numberAttribute(this, "min-zoom") ?? 0,
      step,
    };
    const options: TimelineOptions = {
      ...this.#settings,
      defaultPosition: numberAttribute(this, "default-position") ?? 0,
      defaultZoom: numberAttribute(this, "default-zoom") ?? null,
      disabled: this.hasAttribute("disabled"),
      onPositionChange: (value, details) => {
        if (!reportChange(this, { reason: details.reason, value })) {
          details.cancel();
          return;
        }
        // A position set from outside is kept up to date, so the next gesture starts from it.
        if (this.#position !== undefined) {
          this.#position = value;
          this.controller.setOptions({ ...options, position: value });
        }
      },
      onPositionCommitted: (value, details) =>
        reportCommit(this, { reason: details.reason, value }),
      onZoomChange: (value, details) => {
        if (
          !reportChange(this, { reason: details.reason, value }, "zoomchange")
        ) {
          details.cancel();
          return;
        }
        if (this.#zoom !== undefined) {
          this.#zoom = value;
          this.controller.setOptions({ ...options, zoom: value });
        }
      },
      position: this.#position,
      source: this.#source,
      zoom: this.#zoom,
    };
    this.controller.setOptions(options);
  }

  #snapPointsAttribute(): readonly number[] | undefined {
    const points = listAttribute(this, "snap-points")
      .map(Number)
      .filter(Number.isFinite);
    return points.length > 0 ? points : undefined;
  }

  /** Moves the playhead with the live source, without painting every part. */
  #follow() {
    this.#unfollow?.();
    this.#unfollow = undefined;
    const source = this.#source;
    if (source && this.isConnected) {
      const follow = () => {
        const { duration, position } = this.controller.getSnapshot();
        this.positionStore.set(clampFinite(position, 0, duration));
      };
      follow();
      this.#unfollow = source.subscribe(follow);
    }
  }
}

/** What every part of the timeline does: find its timeline, and carry its state. */
export abstract class TimelinePartElement extends ControlPart<
  TimelineElement,
  TimelineSnapshot
> {
  protected readonly rootTag = TIMELINE_TAGS.root;

  protected isRoot(element: Element | null) {
    return element instanceof TimelineElement;
  }

  protected state(snapshot: TimelineSnapshot): Record<string, string | null> {
    return stateAttributes(snapshot);
  }

  /** Paints the part again from its timeline, after one of its own attributes changed. */
  protected repaint() {
    if (this.root) {
      this.paint(this.root.snapshot());
    }
  }
}

/** Places `element` at `value` on its lane, through `--timeline-offset`. */
export function placeAt(element: HTMLElement, value: number) {
  element.style.setProperty(OFFSET_PROPERTY, String(value));
}

/** Places `element` from `start`, `length` units long. */
export function placeOver(element: HTMLElement, start: number, length: number) {
  placeAt(element, start);
  element.style.setProperty(LENGTH_PROPERTY, String(length));
}

/** The lane a part sits in: the closest element marked as one. */
export const laneOf = (element: Element): HTMLElement | null =>
  element.closest<HTMLElement>("[data-timeline-lane]");

/** Reflects the state of a part that holds a value of its own, over the timeline's. */
export function reflectOwn(
  element: Element,
  timeline: TimelineSnapshot,
  own: Record<string, string | null>
) {
  reflect(element, { ...stateAttributes(timeline), ...own });
}
