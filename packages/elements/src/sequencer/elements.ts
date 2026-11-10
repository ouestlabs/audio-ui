import {
  type CellAddress,
  cellKey,
  createSequencerController,
  DEFAULT_VELOCITY,
  isOn,
  type Pattern,
  type SequencerController,
  type SequencerOptions,
  type SequencerSnapshot,
  type SequencerValueChangeEventDetails,
  type SequencerValueCommitEventDetails,
  type SequencerVelocityChangeEventDetails,
  type SequencerVelocityCommitEventDetails,
  type Velocities,
} from "@audio-ui/core/sequencer";
import {
  ElementBase,
  hideVisually,
  numberAttribute,
  reflect,
} from "../internal/element.ts";
import {
  ControlPart,
  ControlRoot,
  type Painted,
  reportChange,
  reportCommit,
} from "../internal/parts.ts";
import { Stamp } from "../internal/stamp.ts";

/** The names the sequencer's elements are registered under, frozen: a page cannot rename them by accident. */
export const SEQUENCER_TAGS = Object.freeze({
  cell: "audio-ui-sequencer-cell",
  root: "audio-ui-sequencer",
  row: "audio-ui-sequencer-row",
  rows: "audio-ui-sequencer-rows",
  step: "audio-ui-sequencer-step",
  steps: "audio-ui-sequencer-steps",
  velocity: "audio-ui-sequencer-velocity",
});

/** A live value followed without rendering: here, the step being played. */
export interface SequencerSource {
  getSnapshot: () => number;
  subscribe: (listener: () => void) => () => void;
}

/** What a sequencer's `input` and `change` events carry. */
export interface SequencerEventDetail<Reason extends string> {
  reason: Reason;
  /** The pattern: a row per sound, each a list of steps. */
  value: boolean[][];
}

/** What a sequencer's `velocityinput` and `velocitychange` events carry. */
export interface SequencerVelocityDetail<Reason extends string> {
  reason: Reason;
  /** How loud each step plays, 0 to 1, a row per sound. */
  velocities: number[][];
}

/** Fired while cells are flipped. Cancel it, with `preventDefault()`, to keep the pattern as it was. */
export type SequencerInputEvent = CustomEvent<
  SequencerEventDetail<SequencerValueChangeEventDetails["reason"]>
>;
/** Fired when a press, a paint or a key press that changed the pattern ends. */
export type SequencerChangeEvent = CustomEvent<
  SequencerEventDetail<SequencerValueCommitEventDetails["reason"]>
>;
/** Fired while a velocity is drawn or nudged. Cancel it to keep the velocities as they were. */
export type SequencerVelocityInputEvent = CustomEvent<
  SequencerVelocityDetail<SequencerVelocityChangeEventDetails["reason"]>
>;
/** Fired when a drag, a key press or a reset that changed a velocity ends. */
export type SequencerVelocityChangeEvent = CustomEvent<
  SequencerVelocityDetail<SequencerVelocityCommitEventDetails["reason"]>
>;

/** The events a sequencer fires, as `addEventListener` types them. */
export interface SequencerElementEventMap
  extends Omit<HTMLElementEventMap, "change" | "input"> {
  change: SequencerChangeEvent;
  input: SequencerInputEvent;
  velocitychange: SequencerVelocityChangeEvent;
  velocityinput: SequencerVelocityInputEvent;
}

const ROW_SEPARATOR = /\s+/;
const ON = new Set(["x", "X", "1", "*"]);

/** A pattern attribute: a word per row, a character per step, `x` for a step on and `.` for one off: `"x...x... ..x...x."`. */
function patternAttribute(
  element: Element,
  name: string
): boolean[][] | undefined {
  const text = element.getAttribute(name)?.trim();
  if (!text) {
    return;
  }
  return text
    .split(ROW_SEPARATOR)
    .map((row) => [...row].map((step) => ON.has(step)));
}

/** What the arrow keys change a velocity by; Page Up and Page Down move five times as far. */
const VELOCITY_STEP = 0.05;
const VELOCITY_LARGE_STEP = 0.25;

/**
 * A grid of steps to switch on and off, a row per sound: the pattern of a
 * drum machine. Pressing a cell flips it, and dragging on carries the new
 * state across every cell the pointer crosses. The cells are one tab stop,
 * walked with the arrow keys. `value` (or `default-value`) is the pattern as
 * text, a word per row and `x` for a step on (`"x...x... ..x...x."`); the
 * `value` and `velocities` properties take arrays. Flipping cells fires
 * `input`, which `preventDefault()` refuses, then `change`; drawing
 * velocities fires `velocityinput` and `velocitychange`. Its `source`
 * property, the step being played, marks that step's cells with
 * `data-current` as the clock ticks. It is a group.
 */
export class SequencerElement extends ControlRoot<SequencerSnapshot> {
  static readonly observedAttributes = ["default-value", "disabled", "value"];

  /** The framework-agnostic grid behind its cells: the pattern, the velocities, the gestures. */
  readonly controller: SequencerController = createSequencerController({});
  /** The cell elements, by `row:step`: what a paint gesture crosses. */
  readonly cellNodes = new Map<string, HTMLElement>();
  /** The velocity bars, by `row:step`: what a draw gesture crosses. */
  readonly velocityNodes = new Map<string, HTMLElement>();

  #value: Pattern | undefined;
  #velocities: Velocities | undefined;
  #defaultVelocities: Velocities | undefined;
  #source: SequencerSource | undefined;
  #current: number | null = null;
  #unsubscribe: (() => void) | undefined;

  override connectedCallback() {
    super.connectedCallback();
    this.#follow();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#stopFollowing();
  }

  attributeChangedCallback(name: string) {
    if (name === "value") {
      this.#value = patternAttribute(this, "value");
    }
    this.configure();
    this.paint();
  }

  override addEventListener<K extends keyof SequencerElementEventMap>(
    type: K,
    listener: (
      this: SequencerElement,
      event: SequencerElementEventMap[K]
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

  /** The pattern: a row per sound, each a list of steps. Set it to change the pattern; a gesture changes it from there. */
  get value(): Pattern {
    return this.controller.getSnapshot().value;
  }

  set value(value: Pattern) {
    this.#value = value;
    this.configure();
    this.paint();
  }

  /** How loud each step plays, 0 to 1, a row per sound. */
  get velocities(): Velocities {
    return this.controller.getSnapshot().velocities;
  }

  set velocities(velocities: Velocities | undefined) {
    this.#velocities = velocities;
    this.configure();
    this.paint();
  }

  /** The velocities it starts with, when they are not set. */
  get defaultVelocities(): Velocities | undefined {
    return this.#defaultVelocities;
  }

  set defaultVelocities(velocities: Velocities | undefined) {
    this.#defaultVelocities = velocities;
    this.configure();
    this.paint();
  }

  /** The step being played, a live value: its cells get `data-current`. */
  get source(): SequencerSource | undefined {
    return this.#source;
  }

  set source(source: SequencerSource | undefined) {
    this.#source = source;
    this.#follow();
  }

  override attach(part: Painted<SequencerSnapshot>) {
    super.attach(part);
    // A cell that arrives while a step plays is marked at once.
    if (part instanceof SequencerCellElement && this.#current !== null) {
      part.toggleAttribute(
        "data-current",
        part.address?.step === this.#current
      );
    }
  }

  /** Focuses the cell at `cell`. */
  focusCell(cell: CellAddress) {
    this.cellNodes.get(cellKey(cell))?.focus({ preventScroll: true });
  }

  protected snapshot() {
    return this.controller.getSnapshot();
  }

  protected subscribe(listener: () => void) {
    return this.controller.subscribe(listener);
  }

  protected rootAttributes(snapshot: SequencerSnapshot) {
    return {
      "data-disabled": snapshot.disabled ? "" : null,
      "data-painting": snapshot.painting ? "" : null,
      role: "group",
    };
  }

  protected configure() {
    const options: SequencerOptions = {
      defaultValue: patternAttribute(this, "default-value"),
      defaultVelocities: this.#defaultVelocities,
      disabled: this.hasAttribute("disabled"),
      onValueChange: (value, details) => {
        if (!reportChange(this, { reason: details.reason, value })) {
          details.cancel();
          return;
        }
        if (this.#value !== undefined) {
          this.#value = value;
          this.controller.setOptions({ ...options, value });
        }
      },
      onValueCommitted: (value, details) =>
        reportCommit(this, { reason: details.reason, value }),
      onVelocityChange: (velocities, details) => {
        const stands = reportChange(
          this,
          { reason: details.reason, velocities },
          "velocityinput"
        );
        if (!stands) {
          details.cancel();
          return;
        }
        if (this.#velocities !== undefined) {
          this.#velocities = velocities;
          this.controller.setOptions({ ...options, velocities });
        }
      },
      onVelocityCommitted: (velocities, details) =>
        reportCommit(
          this,
          { reason: details.reason, velocities },
          "velocitychange"
        ),
      value: this.#value,
      velocities: this.#velocities,
    };
    this.controller.setOptions(options);
  }

  /** Marks the step being played on its cells, straight in the page, as the source ticks. */
  #follow() {
    this.#stopFollowing();
    const source = this.#source;
    if (!(source && this.isConnected)) {
      return;
    }
    const follow = () => {
      const step = source.getSnapshot();
      const { steps } = this.controller.getSnapshot();
      const next = step >= 0 && step < steps ? Math.floor(step) : null;
      if (next !== this.#current) {
        this.#mark(this.#current, false);
        this.#mark(next, true);
        this.#current = next;
      }
    };
    follow();
    this.#unsubscribe = source.subscribe(follow);
  }

  #stopFollowing() {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#mark(this.#current, false);
    this.#current = null;
  }

  #mark(step: number | null, on: boolean) {
    if (step === null) {
      return;
    }
    for (const [key, node] of this.cellNodes) {
      if (key.endsWith(`:${step}`)) {
        node.toggleAttribute("data-current", on);
      }
    }
  }
}

/** What every part of the sequencer does: find its sequencer, and carry its state. */
abstract class SequencerPartElement extends ControlPart<
  SequencerElement,
  SequencerSnapshot
> {
  protected readonly rootTag = SEQUENCER_TAGS.root;

  protected isRoot(element: Element | null) {
    return element instanceof SequencerElement;
  }

  protected state(snapshot: SequencerSnapshot): Record<string, string | null> {
    return {
      "data-disabled": snapshot.disabled ? "" : null,
      "data-painting": snapshot.painting ? "" : null,
    };
  }
}

/** The labels of a rows element: names separated by commas, as some hold spaces ("Closed hat"). */
const labelList = (element: Element) =>
  (element.getAttribute("labels") ?? "")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);

/**
 * Makes one `<audio-ui-sequencer-row>` per row of the pattern, each holding
 * what its `<template>` holds. `labels` names them in order, separated by
 * commas ("Kick, Snare, Closed hat"). It takes no room of its own.
 */
export class SequencerRowsElement extends SequencerPartElement {
  readonly #stamp = new Stamp(
    this,
    SEQUENCER_TAGS.row,
    "index",
    (row, index) => {
      const label = labelList(this)[index];
      if (label) {
        row.setAttribute("aria-label", label);
      }
    }
  );
  #rows = -1;

  override paint(snapshot: SequencerSnapshot) {
    if (snapshot.rows !== this.#rows) {
      this.#rows = snapshot.rows;
      this.#stamp.update(
        Array.from({ length: snapshot.rows }, (_, index) => index)
      );
    }
  }

  protected override attached() {
    this.#stamp.connect();
  }

  protected override detached() {
    this.#stamp.disconnect();
  }

  protected override state() {
    return {};
  }
}

/** One sound's row of steps, a group, for its `index` from the top. Name it with `aria-label`, such as "Kick". */
export class SequencerRowElement extends SequencerPartElement {
  /** Which row it is, from the top. */
  get index(): number {
    return numberAttribute(this, "index") ?? 0;
  }

  override paint(snapshot: SequencerSnapshot) {
    super.paint(snapshot);
    this.setAttribute("role", "group");
  }
}

/**
 * Makes one `<audio-ui-sequencer-step>` per step of the row it is in, each
 * holding what its `<template>` holds: a cell, a velocity bar, or both. It
 * takes no room of its own, and neither do its steps (`display: contents`),
 * so the cells are the grid's own items.
 */
export class SequencerStepsElement extends SequencerPartElement {
  readonly #stamp = new Stamp(this, SEQUENCER_TAGS.step, "index");
  #steps = -1;

  override paint(snapshot: SequencerSnapshot) {
    if (snapshot.steps !== this.#steps) {
      this.#steps = snapshot.steps;
      this.#stamp.update(
        Array.from({ length: snapshot.steps }, (_, index) => index)
      );
    }
  }

  protected override attached() {
    this.#stamp.connect();
  }

  protected override detached() {
    this.#stamp.disconnect();
  }

  protected override state() {
    return {};
  }
}

/** One step a steps element made, for its `index`: what the cells and bars inside it read their step from. */
export class SequencerStepElement extends ElementBase {}

/** Where a cell or a bar sits: its row from the row around it, its step from its own `step` or the step around it. */
function addressOf(element: Element): CellAddress | null {
  const row = element.closest(SEQUENCER_TAGS.row);
  const step =
    numberAttribute(element, "step") ??
    numberAttribute(element.closest(SEQUENCER_TAGS.step) ?? element, "index");
  return row && step !== undefined
    ? { row: numberAttribute(row, "index") ?? 0, step }
    : null;
}

/**
 * One step of a row: a toggle button, pressed when the step is on
 * (`data-on`). Press it and drag on to paint the same state across the
 * cells you cross; focused, Space or Enter flips it, and the arrow keys
 * move to the next cell. It is named after its row and step ("Kick, step
 * 5") unless it has an `aria-label`. The step being played gets
 * `data-current`.
 */
export class SequencerCellElement extends SequencerPartElement {
  /** Its row and step, read when it connects. */
  address: CellAddress | null = null;
  #release: AbortController | undefined;

  override paint(snapshot: SequencerSnapshot) {
    super.paint(snapshot);
    const cell = this.address;
    if (!cell) {
      return;
    }
    const on = isOn(snapshot.value, cell);
    const stop =
      snapshot.tabStop.row === cell.row && snapshot.tabStop.step === cell.step;
    this.tabIndex = stop && !snapshot.disabled ? 0 : -1;
    reflect(this, {
      "aria-disabled": snapshot.disabled ? "true" : null,
      "aria-pressed": String(on),
      "data-on": on ? "" : null,
    });
  }

  protected override attached(sequencer: SequencerElement) {
    const cell = addressOf(this);
    this.address = cell;
    if (!cell) {
      return;
    }
    sequencer.cellNodes.set(cellKey(cell), this);
    this.setAttribute("role", "button");
    if (!this.hasAttribute("aria-label")) {
      const row = this.closest(SEQUENCER_TAGS.row)?.getAttribute("aria-label");
      const step = `step ${cell.step + 1}`;
      this.setAttribute(
        "aria-label",
        row ? `${row}, ${step}` : `Step ${cell.step + 1}`
      );
    }
    this.#release = new AbortController();
    const { signal } = this.#release;
    const disabled = () => sequencer.controller.getSnapshot().disabled;
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (disabled() || event.button !== 0) {
          return;
        }
        event.preventDefault();
        sequencer.setPointerCapture?.(event.pointerId);
        sequencer.controller.setTabStop(cell);
        sequencer.focusCell(cell);
        sequencer.controller.pressCell(
          cell,
          event,
          sequencer,
          sequencer.cellNodes
        );
      },
      { signal }
    );
    this.addEventListener(
      "keydown",
      (event) => {
        if (disabled()) {
          return;
        }
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          sequencer.controller.toggleCell(cell, event);
          return;
        }
        const next = sequencer.controller.moveFocusFrom(cell, event);
        if (next) {
          event.preventDefault();
          sequencer.focusCell(next);
        }
      },
      { signal }
    );
    this.addEventListener(
      "focus",
      () => sequencer.controller.setTabStop(cell),
      {
        signal,
      }
    );
  }

  protected override detached(sequencer: SequencerElement) {
    this.#release?.abort();
    const cell = this.address;
    if (cell && sequencer.cellNodes.get(cellKey(cell)) === this) {
      sequencer.cellNodes.delete(cellKey(cell));
    }
  }
}

/**
 * How loud one step plays, as a bar from the bottom of its box: the height
 * is the velocity, through the `--sequencer-velocity` CSS variable. Pressing
 * it sets the velocity where the pointer is, and dragging on draws across
 * the steps of the row. Alt + click or Delete bring it back to full. A
 * native `<input type="range">` inside takes the arrow keys (Page Up and
 * Page Down for larger steps, Home and End for silent and full) and carries
 * the accessible name: "Step 5" unless it has an `aria-label`.
 */
export class SequencerVelocityElement extends SequencerPartElement {
  static readonly observedAttributes = ["aria-label"];

  address: CellAddress | null = null;
  readonly #input = document.createElement("input");
  #label: string | undefined;
  #release: AbortController | undefined;

  constructor() {
    super();
    this.#input.type = "range";
    this.#input.min = "0";
    this.#input.max = "1";
    this.#input.step = "any";
    hideVisually(this.#input);
  }

  attributeChangedCallback(
    _name: string,
    _previous: string | null,
    next: string | null
  ) {
    // The name goes to the input; left on the bar too, it would be read twice.
    if (next === null) {
      return;
    }
    this.#label = next || undefined;
    this.removeAttribute("aria-label");
    this.root?.paint();
  }

  override paint(snapshot: SequencerSnapshot) {
    super.paint(snapshot);
    const cell = this.address;
    if (!cell) {
      return;
    }
    const velocity =
      snapshot.velocities[cell.row]?.[cell.step] ?? DEFAULT_VELOCITY;
    const on = isOn(snapshot.value, cell);
    this.style.setProperty("--sequencer-velocity", String(velocity));
    this.style.touchAction = "none";
    this.toggleAttribute("data-on", on);
    this.#input.value = String(velocity);
    this.#input.disabled = snapshot.disabled;
    reflect(this.#input, {
      "aria-label": this.#label ?? `Step ${cell.step + 1}`,
      "aria-valuetext": `${Math.round(velocity * 100)}%`,
    });
  }

  protected override attached(sequencer: SequencerElement) {
    const cell = addressOf(this);
    this.address = cell;
    if (!cell) {
      return;
    }
    sequencer.velocityNodes.set(cellKey(cell), this);
    if (this.#input.parentNode !== this) {
      this.appendChild(this.#input);
    }
    this.#release = new AbortController();
    const { signal } = this.#release;
    const disabled = () => sequencer.controller.getSnapshot().disabled;
    const velocity = () =>
      sequencer.controller.getSnapshot().velocities[cell.row]?.[cell.step] ??
      DEFAULT_VELOCITY;
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (disabled() || event.button !== 0) {
          return;
        }
        event.preventDefault();
        this.#input.focus({ focusVisible: false, preventScroll: true });
        if (event.altKey) {
          sequencer.controller.setVelocity(
            cell,
            DEFAULT_VELOCITY,
            "reset",
            event
          );
          return;
        }
        sequencer.setPointerCapture?.(event.pointerId);
        sequencer.controller.pressVelocity(
          cell,
          event,
          sequencer,
          sequencer.velocityNodes
        );
      },
      { signal }
    );
    this.#input.addEventListener(
      "keydown",
      (event) => {
        if (disabled()) {
          return;
        }
        if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          sequencer.controller.setVelocity(
            cell,
            DEFAULT_VELOCITY,
            "reset",
            event
          );
          return;
        }
        const now = velocity();
        const target = {
          ArrowDown: now - VELOCITY_STEP,
          ArrowLeft: now - VELOCITY_STEP,
          ArrowRight: now + VELOCITY_STEP,
          ArrowUp: now + VELOCITY_STEP,
          End: 1,
          Home: 0,
          PageDown: now - VELOCITY_LARGE_STEP,
          PageUp: now + VELOCITY_LARGE_STEP,
        }[event.key];
        if (target === undefined) {
          return;
        }
        event.preventDefault();
        sequencer.controller.setVelocity(cell, target, "keyboard", event);
      },
      { signal }
    );
    this.#input.addEventListener(
      "input",
      (event) => {
        event.stopPropagation();
        sequencer.controller.setVelocity(
          cell,
          Number(this.#input.value),
          "input-change",
          event
        );
      },
      { signal }
    );
    this.#input.addEventListener("change", (event) => event.stopPropagation(), {
      signal,
    });
  }

  protected override detached(sequencer: SequencerElement) {
    this.#release?.abort();
    const cell = this.address;
    if (cell && sequencer.velocityNodes.get(cellKey(cell)) === this) {
      sequencer.velocityNodes.delete(cellKey(cell));
    }
  }
}
