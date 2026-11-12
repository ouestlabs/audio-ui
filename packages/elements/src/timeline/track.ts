import {
  createTrackController,
  type TimelineSnapshot,
  type TrackController,
  type TrackHeightChangeEventDetails,
  type TrackHeightCommitEventDetails,
  type TrackOptions,
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
  reflectOwn,
  TIMELINE_TAGS,
  type TimelineElement,
  type TimelineEventDetail,
  TimelinePartElement,
} from "./root.ts";

/** The events a track fires, as `addEventListener` types them: its height, in pixels. */
export interface TimelineTrackElementEventMap extends HTMLElementEventMap {
  /** Fired once a resize ends. */
  heightchange: CustomEvent<
    TimelineEventDetail<TrackHeightCommitEventDetails["reason"]>
  >;
  /** Fired on every change of the height. Cancel it, with `preventDefault()`, to refuse it. */
  heightinput: CustomEvent<
    TimelineEventDetail<TrackHeightChangeEventDetails["reason"]>
  >;
}

/**
 * A track: a row with a header and a lane. `height` sets its height in
 * pixels; when unset, rows share the available space. An
 * `<audio-ui-timeline-track-resize-handle>` changes it and fires
 * `heightinput`, cancelable with `preventDefault()`, and `heightchange` with
 * `{ value, reason }`, where `value` is `undefined` when a double click
 * releases the height. `min-height` (32), `max-height` (480), `step` (8) and
 * `large-step` (32) bound and step it. `selected` marks the selected track
 * for styling. Carries `data-resizing` and `data-selected`.
 */
export class TimelineTrackElement extends TimelinePartElement {
  static readonly observedAttributes = [
    "height",
    "large-step",
    "max-height",
    "min-height",
    "selected",
    "step",
  ];

  override addEventListener<K extends keyof TimelineTrackElementEventMap>(
    type: K,
    listener: (
      this: TimelineTrackElement,
      event: TimelineTrackElementEventMap[K]
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

  /** The framework-agnostic track behind its height: what a drag, a key or a double click asks of it. */
  readonly controller: TrackController = createTrackController({
    largeStep: 32,
    max: 480,
    measure: () => this.getBoundingClientRect().height,
    min: 32,
    step: 8,
  });

  readonly #parts = new Set<TimelineTrackPartElement>();
  #height: number | undefined;
  #stop: (() => void) | undefined;

  attributeChangedCallback(name: string) {
    if (name === "height") {
      this.#height = numberAttribute(this, "height");
    }
    this.#configure();
    this.repaint();
  }

  /** The height in pixels, or `undefined` when the row shares the available space. Setting it resizes the track. */
  get height(): number | undefined {
    return this.#height;
  }

  set height(height: number | undefined) {
    this.#height = height === undefined ? undefined : Number(height);
    this.#configure();
    this.repaint();
  }

  /** Called by a header or a resize handle as it connects: drawn at once, then on every change. */
  attach(part: TimelineTrackPartElement) {
    this.#parts.add(part);
    part.draw();
  }

  detach(part: TimelineTrackPartElement) {
    this.#parts.delete(part);
  }

  /** The bounds and steps of the height, from the attributes. */
  get bounds() {
    return {
      largeStep: numberAttribute(this, "large-step") ?? 32,
      max: numberAttribute(this, "max-height") ?? 480,
      min: numberAttribute(this, "min-height") ?? 32,
      step: numberAttribute(this, "step") ?? 8,
    };
  }

  override paint(snapshot: TimelineSnapshot) {
    super.paint(snapshot);
    this.#draw();
  }

  protected override attached() {
    this.#configure();
    this.#stop = this.controller.subscribe(() => this.#draw());
  }

  protected override detached() {
    this.#stop?.();
  }

  #configure() {
    const options: TrackOptions = {
      ...this.bounds,
      height: this.#height,
      measure: () => this.getBoundingClientRect().height,
      onHeightChange: (value, details) => {
        if (
          !reportChange(this, { reason: details.reason, value }, "heightinput")
        ) {
          details.cancel();
          return;
        }
        // The height is held here, as the track is drawn from it.
        this.#height = value;
        this.controller.setOptions({ ...options, height: value });
        this.#draw();
      },
      onHeightCommitted: (value, details) =>
        reportCommit(this, { reason: details.reason, value }, "heightchange"),
    };
    this.controller.setOptions(options);
  }

  #draw() {
    const { resizing } = this.controller.getSnapshot();
    reflect(this, {
      "data-resizing": resizing ? "" : null,
      "data-selected": this.hasAttribute("selected") ? "" : null,
    });
    this.style.height = this.#height === undefined ? "" : `${this.#height}px`;
    for (const part of this.#parts) {
      part.draw();
    }
  }
}

/** A part of a track: it carries the track's state, and is drawn when the track changes. */
abstract class TimelineTrackPartElement extends TimelinePartElement {
  protected track: TimelineTrackElement | null = null;

  override paint() {
    this.draw();
  }

  /** Draws the part from its track. */
  draw() {
    const { root: timeline, track } = this;
    if (!(track && timeline)) {
      return;
    }
    reflectOwn(this, timeline.snapshot(), {
      "data-resizing": track.controller.getSnapshot().resizing ? "" : null,
      "data-selected": track.hasAttribute("selected") ? "" : null,
    });
  }

  protected override attached(_timeline: TimelineElement) {
    const track = this.closest(TIMELINE_TAGS.track);
    if (track instanceof TimelineTrackElement) {
      this.track = track;
      track.attach(this);
    }
  }

  protected override detached() {
    this.track?.detach(this);
    this.track = null;
  }
}

/**
 * The header beside a track's lane, for its name and controls. Pinned to the
 * left edge while the lane scrolls, above the lane's parts at
 * `--timeline-track-header-z` (20).
 */
export class TimelineTrackHeaderElement extends TimelineTrackPartElement {}

/**
 * Sets the track's height by drag, or through the native `<input
 * type="range">` it contains, which carries the accessible name: the arrow
 * keys step (Down is taller), Page Up and Page Down take larger steps, and
 * Home and End go to the minimum and maximum. Place it along the track's
 * bottom edge. A double click releases the height, so the track shares the
 * available space again.
 */
export class TimelineTrackResizeHandleElement extends TimelineTrackPartElement {
  static readonly observedAttributes = INPUT_NAMES;

  readonly #input = rangeInput();
  readonly #names = new Map<string, string>();
  #release: AbortController | undefined;

  constructor() {
    super();
    this.#input.setAttribute("aria-orientation", "vertical");
    this.#input.addEventListener("keydown", (event) => {
      if (this.track?.controller.keyDown(event)) {
        event.preventDefault();
      }
    });
    this.#input.addEventListener("input", (event) => {
      event.stopPropagation();
      this.track?.controller.typeAt(Number(this.#input.value), event);
    });
    this.#input.addEventListener("change", (event) => event.stopPropagation());
  }

  attributeChangedCallback(
    name: string,
    _previous: string | null,
    next: string | null
  ) {
    if (takeName(this, this.#names, name, next)) {
      reflect(this.#input, inputNames(this.#names));
    }
  }

  override draw() {
    super.draw();
    const { track } = this;
    if (!track) {
      return;
    }
    const { max, min } = track.bounds;
    this.#input.min = String(min);
    this.#input.max = String(max);
    this.#input.value = String(track.height ?? min);
  }

  protected override attached(timeline: TimelineElement) {
    if (this.#input.parentNode !== this) {
      this.appendChild(this.#input);
    }
    reflect(this.#input, inputNames(this.#names));
    super.attached(timeline);
    this.#release = new AbortController();
    const { signal } = this.#release;
    this.addEventListener(
      "pointerdown",
      (event) => {
        event.stopPropagation();
        if (event.button !== 0) {
          return;
        }
        this.#input.focus({ focusVisible: false, preventScroll: true });
        this.track?.controller.press(event, this);
      },
      { signal }
    );
    this.addEventListener(
      "dblclick",
      (event) => this.track?.controller.reset(event),
      { signal }
    );
  }

  protected override detached() {
    super.detached();
    this.#release?.abort();
  }
}
