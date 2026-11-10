import {
  createChangeEventDetails,
  isBlackKey,
  pitchName,
} from "@audio-ui/core";
import {
  createPianoRollController,
  type Note,
  type NoteId,
  type NoteLevel,
  type PianoRollChangeEventDetails,
  type PianoRollCommitEventDetails,
  type PianoRollController,
  type PianoRollKeyDetails,
  type PianoRollNoteOffEventDetails,
  type PianoRollOptions,
  type PianoRollSnapshot,
  selectionSpan,
  spatialOrder,
} from "@audio-ui/core/piano-roll";
import { SCALES, type Scale, type ScaleName } from "@audio-ui/core/pitch";
import type { TimelineSnapshot } from "@audio-ui/core/timeline";
import {
  connectPart,
  listAttribute,
  numberAttribute,
  reflect,
} from "../internal/element.ts";
import {
  INPUT_NAMES,
  inputNames,
  rangeInput,
  takeName,
} from "../internal/input.ts";
import {
  ControlPart,
  ControlRoot,
  reportChange,
  reportCommit,
} from "../internal/parts.ts";
import { Stamp } from "../internal/stamp.ts";
import { PIANO_TAGS, type PianoElement } from "../piano/elements.ts";
import {
  placeAt,
  placeOver,
  TIMELINE_TAGS,
  TimelineElement,
  UNIT_PROPERTY,
  unitLength,
} from "../timeline/root.ts";

/** The names the piano roll's elements are registered under, frozen: a page cannot rename them by accident. */
export const PIANO_ROLL_TAGS = Object.freeze({
  grid: "audio-ui-piano-roll-grid",
  keys: "audio-ui-piano-roll-keys",
  marquee: "audio-ui-piano-roll-marquee",
  note: "audio-ui-piano-roll-note",
  noteHandle: "audio-ui-piano-roll-note-handle",
  notes: "audio-ui-piano-roll-notes",
  root: "audio-ui-piano-roll",
  row: "audio-ui-piano-roll-row",
  rows: "audio-ui-piano-roll-rows",
  selectionSpan: "audio-ui-piano-roll-selection-span",
  stretchHandle: "audio-ui-piano-roll-stretch-handle",
  velocities: "audio-ui-piano-roll-velocities",
  velocity: "audio-ui-piano-roll-velocity",
  velocityLane: "audio-ui-piano-roll-velocity-lane",
});

/** Set on the root: how many rows the roll draws. */
const ROWS_PROPERTY = "--piano-roll-rows";
/** Set on every part placed on a row: which one, from the top. */
const ROW_PROPERTY = "--piano-roll-row";

const formatPosition = (value: number) => String(Math.round(value * 100) / 100);

/** A note's accessible name by default: its pitch, and where it starts and ends, such as "C4, 4 to 6". */
const describeNote = (note: Note) =>
  `${pitchName(note.pitch)}, ${formatPosition(note.start)} to ${formatPosition(note.start + note.length)}`;

const describeLevel = (level: number) => `${Math.round(level * 100)}%`;

/** The roll's state on every part: `data-disabled`, `data-editing`, `data-folded`. */
const stateAttributes = (snapshot: PianoRollSnapshot) => ({
  "data-disabled": snapshot.disabled ? "" : null,
  "data-editing": snapshot.editing ? "" : null,
  "data-folded": snapshot.folded ? "" : null,
});

/** What a roll's `input` and `change` events carry, besides the roll itself as their target. */
export interface PianoRollEventDetail<Reason extends string> {
  /** What changed the notes: `draw`, `drag`, `keyboard`, `double-click` or `input-change`. */
  reason: Reason;
  value: Note[];
}

/** The events a piano roll fires, as `addEventListener` types them. */
export interface PianoRollElementEventMap
  extends Omit<HTMLElementEventMap, "change" | "input"> {
  change: CustomEvent<
    PianoRollEventDetail<PianoRollCommitEventDetails["reason"]>
  >;
  input: CustomEvent<
    PianoRollEventDetail<PianoRollChangeEventDetails["reason"]>
  >;
  noteoff: CustomEvent<{ event: Event; pitch: number; reason: string }>;
  noteon: CustomEvent<{
    event: Event;
    pitch: number;
    reason: string;
    velocity: number;
  }>;
  noteselect: CustomEvent<{ reason: string; selection: readonly NoteId[] }>;
}

const isTimeline = (element: Element | null): element is TimelineElement =>
  element instanceof TimelineElement;

/**
 * Groups the parts of a piano roll and owns its notes, its selection and
 * the pitches it draws. It sits inside an `<audio-ui-timeline>`, which gives
 * it its length, zoom, grid and position: a note starts and lasts in the
 * timeline's units, and every gesture lands on its grid unless Cmd/Ctrl is
 * held. Its notes are its `value` property, `{ id, pitch, start, length,
 * velocity?, chance?, muted? }[]`, and its selection its `selection`
 * property, the ids. Rows run from `max-pitch` (72) at the top down to
 * `min-pitch` (48); with `folded` only the pitches carrying notes have one,
 * and with `folded="scale"` those in the scale as well, set with `scale`
 * (`major`, `minor`, `dorian`…) and `scale-root` (0 for C). `mode` is what a
 * press on empty grid does: `select` (the default) or `draw`, which
 * `draw-style="paint"` turns into a brush. Changing the notes fires
 * `input`, which `preventDefault()` refuses, and `change` when the gesture
 * ends, with `{ value, reason }`; the selection fires `noteselect` with `{
 * selection, reason }`; a pitch that should sound fires `noteon`, which
 * `preventDefault()` keeps silent, and `noteoff`. Its `--piano-roll-rows`
 * CSS variable is how many rows there are, and it carries `data-editing`,
 * `data-folded`, `data-mode` and `data-has-selection`.
 */
export class PianoRollElement extends ControlRoot<PianoRollSnapshot> {
  static readonly observedAttributes = [
    "active-pitches",
    "disabled",
    "draw-style",
    "folded",
    "max-pitch",
    "min-length",
    "min-pitch",
    "mode",
    "scale",
    "scale-root",
  ];

  /** The framework-agnostic roll behind every part: notes, selection, gestures, keys. */
  readonly controller: PianoRollController = createPianoRollController({
    timeline: {
      duration: 1,
      grid: { offset: 0, step: 0 },
      position: () => 0,
      step: 0.01,
      zoom: null,
    },
  });
  /** The timeline the roll sits in. */
  timeline: TimelineElement | null = null;
  /** The grid notes are drawn on: what a pointer is measured against. */
  grid: HTMLElement | null = null;
  /** The notes' elements, by id, for focus to go to. */
  readonly noteNodes = new Map<NoteId, HTMLElement>();
  /** Returns a note's accessible name. Defaults to its pitch and where it starts and ends, such as "C4, 4 to 6". */
  getNoteLabel: (note: Note) => string = describeNote;
  /** Returns the id of a note drawn, added or duplicated. Defaults to `"note-<n>"`, skipping ids in use. */
  createNoteId: (() => NoteId) | undefined;

  #value: readonly Note[] | undefined;
  #selection: readonly NoteId[] | undefined;
  #scale: Scale | null | undefined;
  #seen: { disabled: boolean; duration: number; zoom: number | null } | null =
    null;
  #stopTimeline: (() => void) | undefined;

  override connectedCallback() {
    super.connectedCallback();
    connectPart(this, TIMELINE_TAGS.root, isTimeline, (timeline) => {
      this.timeline = timeline;
      // The roll follows the timeline's length, zoom and state; the position it reads as it needs it.
      this.#stopTimeline = timeline.controller.subscribe(() => {
        if (this.#timelineChanged(timeline.snapshot())) {
          this.configure();
          this.paint();
        }
      });
      this.#timelineChanged(timeline.snapshot());
      this.configure();
      this.paint();
    });
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#stopTimeline?.();
    this.#stopTimeline = undefined;
    this.timeline = null;
  }

  attributeChangedCallback() {
    this.configure();
    this.paint();
  }

  override addEventListener<K extends keyof PianoRollElementEventMap>(
    type: K,
    listener: (
      this: PianoRollElement,
      event: PianoRollElementEventMap[K]
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

  /** The notes. Set them to draw the roll; a gesture changes them from there. */
  get value(): readonly Note[] {
    return this.controller.getSnapshot().notes;
  }

  set value(value: readonly Note[]) {
    this.#value = value;
    this.configure();
    this.paint();
  }

  /** The ids of the selected notes. */
  get selection(): readonly NoteId[] {
    return [...this.controller.getSnapshot().selection];
  }

  set selection(selection: readonly NoteId[]) {
    this.#selection = selection;
    this.configure();
    this.paint();
  }

  /** The scale whose rows are marked `data-in-scale`, such as `{ name: "major", root: 0 }`. Takes over from `scale` and `scale-root`. */
  get scale(): Scale | null {
    return this.#scale ?? this.#scaleAttribute();
  }

  set scale(scale: Scale | null) {
    this.#scale = scale;
    this.configure();
    this.paint();
  }

  /** Records a note's element, for focus to go to. */
  registerNote(id: NoteId, element: HTMLElement) {
    this.noteNodes.set(id, element);
  }

  forgetNote(id: NoteId, element: HTMLElement) {
    if (this.noteNodes.get(id) === element) {
      this.noteNodes.delete(id);
    }
  }

  protected snapshot() {
    return this.controller.getSnapshot();
  }

  protected subscribe(listener: () => void) {
    return this.controller.subscribe(listener);
  }

  protected rootAttributes(snapshot: PianoRollSnapshot) {
    this.style.setProperty(ROWS_PROPERTY, String(snapshot.rows.pitches.length));
    return {
      ...stateAttributes(snapshot),
      "data-has-selection": snapshot.selection.size > 0 ? "" : null,
      "data-mode": snapshot.mode,
    };
  }

  protected configure() {
    const { timeline } = this;
    const settings = timeline?.settings;
    const shown = timeline?.snapshot();
    const folded = this.getAttribute("folded");
    const activePitches = listAttribute(this, "active-pitches")
      .map(Number)
      .filter(Number.isFinite);
    const options: PianoRollOptions = {
      activePitches,
      createNoteId: this.createNoteId,
      disabled: this.hasAttribute("disabled") || Boolean(shown?.disabled),
      drawStyle:
        this.getAttribute("draw-style") === "paint" ? "paint" : "stretch",
      folded: folded === null ? false : folded === "scale" || "scale",
      maxPitch: numberAttribute(this, "max-pitch") ?? 72,
      minLength: numberAttribute(this, "min-length"),
      minPitch: numberAttribute(this, "min-pitch") ?? 48,
      mode: this.getAttribute("mode") === "draw" ? "draw" : "select",
      onNoteOff: (pitch, details) =>
        this.dispatchEvent(
          new CustomEvent("noteoff", {
            bubbles: true,
            composed: true,
            detail: { event: details.event, pitch, reason: details.reason },
          })
        ),
      onNoteOn: (pitch, details) => {
        const detail = {
          event: details.event,
          pitch,
          reason: details.reason,
          velocity: details.velocity,
        };
        if (!reportChange(this, detail, "noteon")) {
          details.cancel();
        }
      },
      onSelectionChange: (selection, details) => {
        const detail = { reason: details.reason, selection };
        if (!reportChange(this, detail, "noteselect")) {
          details.cancel();
          return;
        }
        // A selection set from outside is kept up to date.
        if (this.#selection !== undefined) {
          this.#selection = selection;
          this.controller.setOptions({ ...options, selection });
        }
      },
      onValueChange: (value, details) => {
        if (!reportChange(this, { reason: details.reason, value })) {
          details.cancel();
          return;
        }
        // Notes set from outside are kept up to date, so the next gesture starts from them.
        if (this.#value !== undefined) {
          this.#value = value;
          this.controller.setOptions({ ...options, value });
        }
      },
      onValueCommitted: (value, details) =>
        reportCommit(this, { reason: details.reason, value }),
      requestFocus: (target) => this.#requestFocus(target),
      scale: this.scale,
      selection: this.#selection,
      timeline: {
        duration: shown?.duration ?? 1,
        grid: settings?.grid ?? { offset: 0, step: 0 },
        position: () => timeline?.positionStore.get() ?? 0,
        step: settings?.step ?? 0.01,
        zoom: shown?.zoom ?? null,
      },
      value: this.#value,
    };
    this.controller.setOptions(options);
  }

  #scaleAttribute(): Scale | null {
    const name = this.getAttribute("scale");
    return name !== null && name in SCALES
      ? {
          name: name as ScaleName,
          root: numberAttribute(this, "scale-root") ?? 0,
        }
      : null;
  }

  /** Whether the timeline's length, zoom or state moved since the roll last read them. */
  #timelineChanged({ disabled, duration, zoom }: TimelineSnapshot) {
    const seen = this.#seen;
    if (
      seen &&
      seen.disabled === disabled &&
      seen.duration === duration &&
      seen.zoom === zoom
    ) {
      return false;
    }
    this.#seen = { disabled, duration, zoom };
    return true;
  }

  /** Focuses a note, or the grid with `null`, once the roll has painted and made the note. */
  #requestFocus(target: NoteId | null) {
    queueMicrotask(() => {
      const element = target === null ? this.grid : this.noteNodes.get(target);
      element?.focus({ preventScroll: true });
    });
  }
}

/** What every part of the roll does: find its roll, and carry its state. */
abstract class PianoRollPartElement extends ControlPart<
  PianoRollElement,
  PianoRollSnapshot
> {
  protected readonly rootTag = PIANO_ROLL_TAGS.root;

  protected isRoot(element: Element | null) {
    return element instanceof PianoRollElement;
  }

  protected state(snapshot: PianoRollSnapshot): Record<string, string | null> {
    return stateAttributes(snapshot);
  }
}

/** A part of the roll that is also a lane of its timeline: it registers with it, and sets the unit its parts place themselves with. */
abstract class PianoRollLaneElement extends PianoRollPartElement {
  #unregister: (() => void) | undefined;
  #timeline: TimelineElement | null = null;

  override paint(snapshot: PianoRollSnapshot) {
    super.paint(snapshot);
    const timeline = this.root?.timeline ?? null;
    if (timeline !== this.#timeline) {
      this.#unregister?.();
      this.#unregister = timeline?.registerLane(this);
      this.#timeline = timeline;
    }
    if (!timeline) {
      return;
    }
    const { duration, zoom } = timeline.snapshot();
    this.style.setProperty(UNIT_PROPERTY, unitLength(zoom, duration));
    this.style.minWidth = zoom === null ? "" : `${duration * zoom}px`;
  }

  protected override attached(_roll: PianoRollElement) {
    // What the timeline's parts dragged over it find it by.
    this.setAttribute("data-timeline-lane", "");
  }

  protected override detached(_roll: PianoRollElement) {
    this.#unregister?.();
    this.#unregister = undefined;
    this.#timeline = null;
  }
}

/**
 * The surface notes are drawn on: a timeline lane, with the roll's rows
 * stacked down it, and a group that takes focus. A press on empty grid
 * draws a note (`mode="draw"`) or starts a selection rectangle, Shift adding
 * to what is selected; in that mode a double click draws. Focused, Enter
 * adds a note at the playback position, Escape clears the selection and
 * Cmd/Ctrl+A selects every note. From the grid or a note, Cmd/Ctrl+D
 * repeats the selection right after itself, Cmd/Ctrl+C, X and V copy, cut
 * and paste at the playback position, and Q snaps the starts of the
 * selection to the grid.
 */
export class PianoRollGridElement extends PianoRollLaneElement {
  #release: AbortController | undefined;

  override paint(snapshot: PianoRollSnapshot) {
    super.paint(snapshot);
    this.setAttribute("role", "group");
    this.tabIndex = snapshot.disabled ? -1 : 0;
  }

  protected override attached(roll: PianoRollElement) {
    super.attached(roll);
    roll.grid = this;
    this.#release = new AbortController();
    const { signal } = this.#release;
    const { controller } = roll;
    const disabled = () => controller.getSnapshot().disabled;
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0 || disabled()) {
          return;
        }
        event.preventDefault();
        this.focus({ focusVisible: false, preventScroll: true });
        controller.pressGrid(event, this);
      },
      { signal }
    );
    this.addEventListener(
      "dblclick",
      (event) => controller.doubleClickGrid(event, this),
      { signal }
    );
    this.addEventListener(
      "keydown",
      (event) => {
        if (disabled()) {
          return;
        }
        if (controller.keyGrid(event)) {
          event.preventDefault();
          return;
        }
        if (event.key === "Enter" && event.target === this) {
          event.preventDefault();
          controller.addAtPlayback(event);
        }
      },
      { signal }
    );
  }

  protected override detached(roll: PianoRollElement) {
    super.detached(roll);
    this.#release?.abort();
    if (roll.grid === this) {
      roll.grid = null;
    }
  }
}

/** Makes one item per key, again whenever the keys change. */
abstract class PianoRollMakerElement<
  Key extends number | string,
> extends PianoRollPartElement {
  protected abstract readonly stamp: Stamp<Key>;
  #keys = "";

  /** The keys the snapshot calls for, in order. */
  protected abstract keys(snapshot: PianoRollSnapshot): readonly Key[];

  override paint(snapshot: PianoRollSnapshot) {
    const keys = this.keys(snapshot);
    const joined = keys.join("\u0000");
    if (joined !== this.#keys) {
      this.#keys = joined;
      this.stamp.update(keys);
    }
  }

  protected override attached() {
    this.stamp.connect();
  }

  protected override detached() {
    this.stamp.disconnect();
  }

  protected override state() {
    return {};
  }
}

/**
 * Makes one `<audio-ui-piano-roll-row>` per row, highest pitch first, each
 * holding what its `<template>` holds, if it has one. It takes no room of
 * its own.
 */
export class PianoRollRowsElement extends PianoRollMakerElement<number> {
  protected readonly stamp = new Stamp<number>(
    this,
    PIANO_ROLL_TAGS.row,
    "pitch"
  );

  protected keys(snapshot: PianoRollSnapshot) {
    return snapshot.rows.pitches;
  }
}

/**
 * The band a `pitch` takes across the grid, for shading black-key rows, the
 * rows of the roll's scale, or ruling where an octave starts. It lets
 * presses through and is hidden from assistive technology. It carries
 * `data-active` while its pitch sounds, `data-color` (`black` or `white`),
 * `data-in-scale` and `data-octave` on a C.
 */
export class PianoRollRowElement extends PianoRollPartElement {
  override paint(snapshot: PianoRollSnapshot) {
    super.paint(snapshot);
    const pitch = numberAttribute(this, "pitch") ?? 0;
    const pitchClass = ((pitch % 12) + 12) % 12;
    this.style.setProperty(ROW_PROPERTY, String(snapshot.rows.rowOf(pitch)));
    reflect(this, {
      "aria-hidden": "true",
      "data-active": snapshot.active.has(pitch) ? "" : null,
      "data-color": isBlackKey(pitch) ? "black" : "white",
      "data-in-scale": snapshot.rows.scale?.includes(pitchClass) ? "" : null,
      "data-octave": pitchClass === 0 ? "" : null,
    });
  }
}

/** The ids of the notes in the order they are read, held still while a gesture edits them so the tab order doesn't jump. */
function noteOrder(
  snapshot: PianoRollSnapshot,
  frozen: { ids: readonly NoteId[] | null }
): NoteId[] {
  const ordered = spatialOrder(snapshot.notes).map((note) => note.id);
  if (!snapshot.editing) {
    frozen.ids = null;
    return ordered;
  }
  frozen.ids ??= ordered;
  const known = new Set(ordered);
  const kept = frozen.ids.filter((id) => known.has(id));
  return [...kept, ...ordered.filter((id) => !frozen.ids?.includes(id))];
}

/** Gives an item made for a note the note's id as the roll holds it. */
function keepKey(item: Element, key: NoteId) {
  if (item instanceof PianoRollNotePartElement) {
    item.noteKey = key;
  }
}

/**
 * Makes one `<audio-ui-piano-roll-note>` per note, in the order they are
 * read (by start, then from the highest pitch down), which is also the tab
 * order, each holding what its `<template>` holds: its
 * `<audio-ui-piano-roll-note-handle>`s, a label. It takes no room of its own.
 */
export class PianoRollNotesElement extends PianoRollMakerElement<NoteId> {
  protected readonly stamp = new Stamp<NoteId>(
    this,
    PIANO_ROLL_TAGS.note,
    "note-id",
    keepKey
  );
  readonly #frozen: { ids: readonly NoteId[] | null } = { ids: null };

  protected keys(snapshot: PianoRollSnapshot) {
    return noteOrder(snapshot, this.#frozen);
  }
}

/** A part drawn for one note, its `note-id`: a note, or its velocity bar. */
abstract class PianoRollNotePartElement extends PianoRollPartElement {
  /** The id of the note it stands for, as the roll holds it, when its maker made it: an attribute is only text. */
  noteKey: NoteId | undefined;

  /** The id of the note it stands for. */
  get noteId(): NoteId {
    return this.noteKey ?? this.getAttribute("note-id") ?? "";
  }

  /** Its note as the roll shows it, or undefined while it is being removed. */
  protected note(snapshot: PianoRollSnapshot): Note | undefined {
    return snapshot.noteById.get(this.noteId);
  }

  protected noteState(snapshot: PianoRollSnapshot, note: Note) {
    return {
      "data-disabled": snapshot.disabled ? "" : null,
      "data-muted": note.muted ? "" : null,
      "data-selected": snapshot.selection.has(note.id) ? "" : null,
    };
  }
}

/**
 * One note, placed at its start and pitch: on the timeline's units across
 * and on its row down. Dragging it moves it, and the rest of the selection
 * with it, on the grid unless Cmd/Ctrl is held; with Alt the drag carries
 * copies off. Shift + click adds it to the selection or takes it out, a
 * double click removes it. Focused, the arrow keys move it (Up and Down by
 * a semitone, an octave with Shift), Shift + Left and Right change its
 * length, Enter or Space selects it and Delete removes it, all of them
 * acting on the selection when the note is part of it. It is a toggle
 * button pressed while selected, named by the roll's `getNoteLabel`. Its
 * `--piano-roll-velocity` and `--piano-roll-chance` CSS variables are its
 * velocity and how likely it is to play, and it carries `data-selected` and
 * `data-muted`.
 */
export class PianoRollNoteElement extends PianoRollNotePartElement {
  #release: AbortController | undefined;
  #id: NoteId = "";

  override paint(snapshot: PianoRollSnapshot) {
    const note = this.note(snapshot);
    const roll = this.root;
    if (!(note && roll)) {
      return;
    }
    placeOver(this, note.start, note.length);
    this.style.setProperty(
      ROW_PROPERTY,
      String(snapshot.rows.rowOf(note.pitch))
    );
    this.style.setProperty("--piano-roll-velocity", String(note.velocity ?? 1));
    this.style.setProperty("--piano-roll-chance", String(note.chance ?? 1));
    this.tabIndex = snapshot.disabled ? -1 : 0;
    const selected = snapshot.selection.has(note.id);
    reflect(this, {
      ...this.noteState(snapshot, note),
      "aria-disabled": snapshot.disabled ? "true" : null,
      "aria-label": roll.getNoteLabel(note),
      "aria-pressed": String(selected),
      role: "button",
    });
  }

  protected override attached(roll: PianoRollElement) {
    this.#id = this.noteId;
    roll.registerNote(this.#id, this);
    this.#release = new AbortController();
    const { signal } = this.#release;
    const { controller } = roll;
    const disabled = () => controller.getSnapshot().disabled;
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0) {
          return;
        }
        event.stopPropagation();
        if (disabled() || !roll.grid) {
          return;
        }
        event.preventDefault();
        this.focus({ focusVisible: false, preventScroll: true });
        controller.pressNote(this.noteId, "move", event, this, roll.grid);
      },
      { signal }
    );
    this.addEventListener(
      "keydown",
      (event) => {
        if (disabled()) {
          return;
        }
        if (controller.shortcut(event)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (controller.keyNote(this.noteId, event)) {
          event.preventDefault();
        }
      },
      { signal }
    );
    this.addEventListener(
      "keyup",
      (event) => {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          controller.releaseKey(event);
        }
      },
      { signal }
    );
    this.addEventListener("blur", (event) => controller.releaseKey(event), {
      signal,
    });
    this.addEventListener(
      "dblclick",
      (event) => {
        event.stopPropagation();
        if (!disabled()) {
          controller.doubleClickNote(this.noteId, event);
        }
      },
      { signal }
    );
  }

  protected override detached(roll: PianoRollElement) {
    this.#release?.abort();
    roll.forgetNote(this.#id, this);
  }
}

/**
 * One `edge` of the note it sits in, `start` or `end`, dragged to change
 * the note's length: the end makes it longer or shorter, the start trims it
 * from the front while its end stays put. On the grid unless Cmd/Ctrl is
 * held, and for the whole selection when the note is part of it. Shift +
 * Left and Right on the note do the same from the keyboard, so the handle is
 * hidden from assistive technology. It carries `data-edge`.
 */
export class PianoRollNoteHandleElement extends PianoRollPartElement {
  #release: AbortController | undefined;

  override paint(snapshot: PianoRollSnapshot) {
    super.paint(snapshot);
    const note = this.#note();
    const id = note?.noteId;
    reflect(this, {
      "aria-hidden": "true",
      "data-edge": this.#edge(),
      "data-selected":
        id !== undefined && snapshot.selection.has(id) ? "" : null,
    });
  }

  protected override attached(roll: PianoRollElement) {
    this.#release = new AbortController();
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0) {
          return;
        }
        event.stopPropagation();
        const note = this.#note();
        if (roll.controller.getSnapshot().disabled || !(roll.grid && note)) {
          return;
        }
        event.preventDefault();
        note.focus({ focusVisible: false, preventScroll: true });
        roll.controller.pressNote(
          note.noteId,
          this.#edge(),
          event,
          this,
          roll.grid
        );
      },
      { signal: this.#release.signal }
    );
  }

  protected override detached() {
    this.#release?.abort();
  }

  #note(): PianoRollNoteElement | null {
    const note = this.closest(PIANO_ROLL_TAGS.note);
    return note instanceof PianoRollNoteElement ? note : null;
  }

  #edge(): "end" | "start" {
    return this.getAttribute("edge") === "start" ? "start" : "end";
  }
}

/** The selection rectangle being dragged across the grid; hidden the rest of the time, and from assistive technology. */
export class PianoRollMarqueeElement extends PianoRollPartElement {
  override paint(snapshot: PianoRollSnapshot) {
    super.paint(snapshot);
    const { band } = snapshot;
    this.setAttribute("aria-hidden", "true");
    Object.assign(
      this.style,
      band
        ? {
            display: "",
            height: `${band.height}px`,
            left: `${band.left}px`,
            top: `${band.top}px`,
            width: `${band.width}px`,
          }
        : { display: "none" }
    );
  }
}

/**
 * The time the selected notes cover, from the earliest start to the latest
 * end, as a band from top to bottom of what it sits in: the grid, the
 * velocity lane or the ruler. Hidden with no note selected. It lets presses
 * through, all but its `<audio-ui-piano-roll-stretch-handle>`s, and is
 * hidden from assistive technology.
 */
export class PianoRollSelectionSpanElement extends PianoRollPartElement {
  override paint(snapshot: PianoRollSnapshot) {
    super.paint(snapshot);
    const span = selectionSpan(snapshot.notes, snapshot.selection);
    this.setAttribute("aria-hidden", "true");
    this.style.display = span ? "" : "none";
    if (span) {
      placeOver(this, span.start, span.end - span.start);
    }
  }
}

/**
 * One `edge` of the selection's span: a drag stretches the selected notes in
 * time from the other edge, on the grid unless Cmd/Ctrl is held. It carries
 * `data-edge`.
 */
export class PianoRollStretchHandleElement extends PianoRollPartElement {
  #release: AbortController | undefined;

  override paint(snapshot: PianoRollSnapshot) {
    super.paint(snapshot);
    reflect(this, { "aria-hidden": "true", "data-edge": this.#edge() });
    this.style.left = this.#edge() === "start" ? "0" : "";
    this.style.right = this.#edge() === "end" ? "0" : "";
  }

  protected override attached(roll: PianoRollElement) {
    this.#release = new AbortController();
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (roll.grid) {
          event.stopPropagation();
          roll.controller.pressStretch(this.#edge(), event, this, roll.grid);
        }
      },
      { signal: this.#release.signal }
    );
  }

  protected override detached() {
    this.#release?.abort();
  }

  #edge(): "end" | "start" {
    return this.getAttribute("edge") === "start" ? "start" : "end";
  }
}

/** The level a velocity lane, or a bar in it, stands for. */
const levelOf = (element: Element): NoteLevel =>
  element.closest(PIANO_ROLL_TAGS.velocityLane)?.getAttribute("level") ===
  "chance"
    ? "chance"
    : "velocity";

/**
 * A strip under the grid where each note's velocity, or with
 * `level="chance"` its chance to play, stands as a bar placed at the note's
 * start: a timeline lane, like the grid. In draw mode it is a brush: a drag
 * across it sets every bar under the pointer, in the grid cell it is over,
 * to the pointer's height. Put an `<audio-ui-piano-roll-velocities>` in it.
 */
export class PianoRollVelocityLaneElement extends PianoRollLaneElement {
  #release: AbortController | undefined;

  override paint(snapshot: PianoRollSnapshot) {
    super.paint(snapshot);
    reflect(this, { "data-level": levelOf(this), role: "group" });
  }

  protected override attached(roll: PianoRollElement) {
    super.attached(roll);
    this.#release = new AbortController();
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (!event.defaultPrevented) {
          roll.controller.paintLevels(event, this, levelOf(this));
        }
      },
      { signal: this.#release.signal }
    );
  }

  protected override detached(roll: PianoRollElement) {
    super.detached(roll);
    this.#release?.abort();
  }
}

/** Makes one `<audio-ui-piano-roll-velocity>` per note, each holding what its `<template>` holds, if it has one. */
export class PianoRollVelocitiesElement extends PianoRollMakerElement<NoteId> {
  protected readonly stamp = new Stamp<NoteId>(
    this,
    PIANO_ROLL_TAGS.velocity,
    "note-id",
    keepKey
  );
  readonly #frozen: { ids: readonly NoteId[] | null } = { ids: null };

  protected keys(snapshot: PianoRollSnapshot) {
    return noteOrder(snapshot, this.#frozen);
  }
}

/**
 * One note's velocity, or its chance in a `level="chance"` lane, as a bar
 * from the bottom of the lane: its height is the value, through the
 * `--piano-roll-level` CSS variable. Dragging it changes the value of the
 * selection by the same amount when the note is part of it; Shift + click
 * toggles the note in the selection. On a velocity bar, Cmd/Ctrl + drag sets
 * how far the velocity may stray, its `--piano-roll-deviation`. The native
 * `<input type="range">` it holds takes the arrow keys and carries the
 * accessible name, the note's unless it has an `aria-label`. Its
 * `getAriaValueText(level)` property says how the value is announced, a
 * percentage by default.
 */
export class PianoRollVelocityElement extends PianoRollNotePartElement {
  static readonly observedAttributes = INPUT_NAMES;

  /** Returns how a value, 0…1, is announced. Defaults to a percentage. */
  getAriaValueText: ((level: number) => string) | undefined;

  readonly #input = rangeInput();
  readonly #names = new Map<string, string>();
  #release: AbortController | undefined;

  constructor() {
    super();
    this.#input.min = "0";
    this.#input.max = "1";
    this.#input.addEventListener("keydown", (event) => {
      const roll = this.root;
      if (
        roll &&
        !roll.controller.getSnapshot().disabled &&
        roll.controller.keyVelocity(this.noteId, event, levelOf(this))
      ) {
        event.preventDefault();
      }
    });
    this.#input.addEventListener("input", (event) => {
      event.stopPropagation();
      this.root?.controller.setVelocity(
        this.noteId,
        Number(this.#input.value),
        event,
        levelOf(this)
      );
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

  override paint(snapshot: PianoRollSnapshot) {
    const note = this.note(snapshot);
    const roll = this.root;
    if (!(note && roll)) {
      return;
    }
    const level = note[levelOf(this)] ?? 1;
    placeAt(this, note.start);
    const properties: Record<string, string> = {
      "--piano-roll-chance": String(note.chance ?? 1),
      "--piano-roll-deviation": String(note.deviation ?? 0),
      "--piano-roll-level": String(level),
      "--piano-roll-velocity": String(note.velocity ?? 1),
    };
    for (const [name, value] of Object.entries(properties)) {
      this.style.setProperty(name, value);
    }
    reflect(this, this.noteState(snapshot, note));
    const input = this.#input;
    input.value = String(level);
    input.disabled = snapshot.disabled;
    const named =
      this.#names.has("aria-label") || this.#names.has("aria-labelledby");
    reflect(input, {
      ...inputNames(this.#names),
      "aria-label": named
        ? (this.#names.get("aria-label") ?? null)
        : roll.getNoteLabel(note),
      "aria-valuetext": (this.getAriaValueText ?? describeLevel)(level),
    });
  }

  protected override attached(roll: PianoRollElement) {
    if (this.#input.parentNode !== this) {
      this.appendChild(this.#input);
    }
    this.#release = new AbortController();
    this.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0 || roll.controller.getSnapshot().disabled) {
          return;
        }
        event.preventDefault();
        this.#input.focus({ focusVisible: false, preventScroll: true });
        roll.controller.pressVelocity(
          this.noteId,
          event,
          this,
          this.closest(PIANO_ROLL_TAGS.velocityLane),
          levelOf(this)
        );
      },
      { signal: this.#release.signal }
    );
  }

  protected override detached() {
    this.#release?.abort();
  }
}

/**
 * The keyboard down the side of the roll: it lays the `<audio-ui-piano>` it
 * holds on the roll's rows, low end at the bottom, and lights the pitches
 * that sound. Pressing a key sounds it through the roll's `noteon`; with
 * Shift, pressing it selects every note on its row, or deselects them when
 * they all are.
 */
export class PianoRollKeysElement extends PianoRollPartElement {
  #piano: PianoElement | null = null;
  #release: AbortController | undefined;

  override paint(snapshot: PianoRollSnapshot) {
    super.paint(snapshot);
    const piano = this.#findPiano();
    if (!piano) {
      return;
    }
    reflect(piano, {
      disabled: snapshot.disabled ? "" : null,
      layout: "even",
      orientation: "vertical",
    });
    piano.pitches = snapshot.rows.pitches;
    piano.activeNotes = [...snapshot.active];
  }

  protected override attached(roll: PianoRollElement) {
    this.#release = new AbortController();
    const { signal } = this.#release;
    // The piano's own events stop here: the roll reports what sounds.
    this.addEventListener(
      "noteon",
      (event) => {
        if (
          !(
            event.target instanceof Element &&
            event.target.closest(PIANO_TAGS.root)
          )
        ) {
          return;
        }
        event.stopPropagation();
        const { event: cause, pitch, reason } = (event as CustomEvent).detail;
        const details = createChangeEventDetails(
          reason,
          cause
        ) as PianoRollKeyDetails;
        roll.controller.keyOn(pitch, details);
        if (details.isCanceled) {
          event.preventDefault();
        }
      },
      { signal }
    );
    this.addEventListener(
      "noteoff",
      (event) => {
        if (
          !(
            event.target instanceof Element &&
            event.target.closest(PIANO_TAGS.root)
          )
        ) {
          return;
        }
        event.stopPropagation();
        const { event: cause, pitch, reason } = (event as CustomEvent).detail;
        roll.controller.keyOff(pitch, {
          event: cause,
          reason,
        } as PianoRollNoteOffEventDetails);
      },
      { signal }
    );
  }

  protected override detached() {
    this.#release?.abort();
    this.#piano = null;
  }

  #findPiano(): PianoElement | null {
    this.#piano ??= this.querySelector(PIANO_TAGS.root);
    return this.#piano;
  }
}
