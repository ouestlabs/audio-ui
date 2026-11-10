import {
  createTrackController,
  type TimelineSnapshot,
  type TrackController,
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
  TimelinePartElement,
} from "./root.ts";

/**
 * One track of the arrangement: a row holding a header beside a lane. Its
 * `height`, in px, is yours to hold: leave it out and the row shares the
 * room it is given, set it and the row keeps it. An
 * `<audio-ui-timeline-track-resize-handle>` changes it, firing
 * `heightinput` (which `preventDefault()` refuses) and `heightchange` with
 * `{ value, reason }`, the value `undefined` when a double click gives the
 * height up. `min-height` (32), `max-height` (480), `step` (8) and
 * `large-step` (32) bound and step it. `selected` marks the picked track,
 * for styling. It carries `data-resizing` and `data-selected`.
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

  /** The height in px, or undefined while the row shares the room there is. Set it to resize the track. */
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
 * The strip beside a track's lane that names it and holds what sets it. It
 * stays at the left edge while the lane scrolls under it, above the lane's
 * parts at the stacking level of `--timeline-track-header-z` (20).
 */
export class TimelineTrackHeaderElement extends TimelineTrackPartElement {}

/**
 * Sets the track's height: by dragging, or from the keyboard through the
 * native `<input type="range">` it holds, which carries the accessible
 * name: the arrows move by a step (Down is taller), Page Up and Down by a
 * large one, Home and End to the minimum and the maximum. Place it along
 * the track's lower edge. A double click gives the height up, so the track
 * shares the room again.
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
