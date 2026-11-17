import {
  createChange,
  css,
  dispatch,
  type PrimitiveInstance,
  type PropSpec,
  type SlotDefinition,
} from "@ui-sdk/core";
import { isBlackKey, pitchName } from "../pitch";
import {
  type ChangeDetails,
  type CommitDetails,
  definePrimitive,
  flag,
  sourceOf,
  VISUALLY_HIDDEN,
} from "../primitive";
import {
  createPianoRollController,
  type PianoRollBand,
  type PianoRollController,
  type PianoRollSnapshot,
} from "./controller";
import {
  type Note,
  type NoteId,
  type NoteLevel,
  selectionSpan,
  spatialOrder,
} from "./edits";
import type { RollScale, Rows } from "./rows";

export type { ChangeDetails, CommitDetails } from "../primitive";
export type { Note, NoteId, NoteLevel } from "./edits";
export type { RollScale } from "./rows";

/**
 * The piano roll, over its controller (`controller.ts`): the notes and their
 * selection, drawing, moving, resizing, selecting with a marquee, velocity
 * and the commands on the keys, all stay in the controller; the edits it
 * makes are in `edits.ts`, the rows in `rows.ts`.
 *
 * The roll sits on a timeline but has no provider to read it from: it takes
 * the timeline's duration, grid, zoom and playback position as options, which
 * are the values you give the timeline.
 */

/** A live playback position: what it holds now, and a way to hear it change. */
export interface PositionSource {
  getSnapshot: () => number;
  subscribe: (listener: () => void) => () => void;
}

export const UNIT_PROPERTY = "--timeline-unit";
export const OFFSET_PROPERTY = "--timeline-offset";
export const LENGTH_PROPERTY = "--timeline-length";
export const ROWS_PROPERTY = "--piano-roll-rows";
export const ROW_PROPERTY = "--piano-roll-row";
export const VELOCITY_PROPERTY = "--piano-roll-velocity";
export const CHANCE_PROPERTY = "--piano-roll-chance";
export const DEVIATION_PROPERTY = "--piano-roll-deviation";
export const LEVEL_PROPERTY = "--piano-roll-level";

const formatPosition = (value: number) => String(Math.round(value * 100) / 100);

const describeNote = (note: Note) =>
  `${pitchName(note.pitch)}, ${formatPosition(note.start)} to ${formatPosition(note.start + note.length)}`;

const describeVelocity = (velocity: number) => `${Math.round(velocity * 100)}%`;

/** Why a pitch sounds or stops: a key pressed or glided over, the keyboard, or a note drawn, picked up or moved. */
export type RollNoteReason = "draw" | "drag" | "glide" | "keyboard" | "press";

/** What a pitch about to sound reports. */
export interface RollNoteOnDetails {
  cancel: () => void;
  event?: Event;
  reason: RollNoteReason;
  source?: string;
  /** How hard it sounds, from 0 to 1. */
  velocity: number;
}

/** What a pitch that stops reports. */
export interface RollNoteOffDetails {
  event?: Event;
  reason: RollNoteReason;
}

export interface PianoRollPrimitiveOptions {
  /** Pitches sounding from outside: they light up their rows and keys. */
  activePitches?: readonly number[];
  createNoteId?: () => NoteId;
  defaultSelection?: readonly NoteId[];
  defaultValue?: readonly Note[];
  disabled?: boolean;
  drawStyle?: "paint" | "stretch";
  /** The timeline's length, in its units. @default 1 */
  duration?: number;
  folded?: boolean | "scale";
  getNoteLabel?: (note: Note) => string;
  maxPitch?: number;
  minLength?: number;
  minPitch?: number;
  mode?: "draw" | "select";
  /** A pitch stops sounding, from a key, a note or a gesture on the grid. */
  onNoteOff?: (pitch: number, details: RollNoteOffDetails) => void;
  /** A pitch is about to sound, from a key, a note or a gesture on the grid: `details.cancel()` keeps it from. */
  onNoteOn?: (pitch: number, details: RollNoteOnDetails) => void;
  onSelectionChange?: (
    selection: readonly NoteId[],
    details: ChangeDetails
  ) => void;
  onValueChange?: (value: Note[], details: ChangeDetails) => void;
  onValueCommitted?: (value: Note[], details: CommitDetails) => void;
  /** The playback position, in the timeline's units. */
  position?: number;
  scale?: RollScale | null;
  selection?: readonly NoteId[];
  snapOffset?: number;
  snapPoints?: readonly number[];
  snapStep?: number;
  /** A live playback position, read when a gesture needs it. */
  source?: PositionSource;
  step?: number;
  value?: readonly Note[];
  /** The timeline's zoom, in px per unit; `null` while it fits its lane. */
  zoom?: number | null;
}

export interface PianoRollState {
  duration: number;
  /** Names a note for assistive technology. */
  getNoteLabel: ((note: Note) => string) | undefined;
  selection: readonly NoteId[];
  source: PositionSource | undefined;
  /** The notes the roll holds. */
  value: readonly Note[];
  view: PianoRollSnapshot;
  zoom: number | null;
}

/** What every part reads of the roll. */
export interface PianoRollPublicState {
  disabled: boolean;
  editing: boolean;
  folded: boolean;
  mode: "draw" | "select";
}

interface PartProps {
  id?: string;
}

/** The props of the parts that belong to a note. */
export interface NoteRef extends PartProps {
  /** The id of the note it belongs to. */
  note: NoteId;
}

export interface NotePublicState extends PianoRollPublicState {
  muted: boolean;
  selected: boolean;
}

export interface NoteEdgeState extends NotePublicState {
  edge: "end" | "start";
}

export interface RowPublicState extends PianoRollPublicState {
  active: boolean;
  color: "black" | "white";
  inScale: boolean;
  octave: boolean;
  outOfScale: boolean;
  scaleRoot: boolean;
}

export interface NotesPublicState extends PianoRollPublicState {
  /** The notes in reading order. */
  notes: readonly Note[];
}

export interface RowsPublicState extends PianoRollPublicState {
  /** The pitches drawn, highest first. */
  pitches: readonly number[];
}

/** What a key of the keyboard beside the roll reports when it sounds, as a piano reports it: the event can be missing. */
export interface KeyOnDetails {
  cancel: () => void;
  event?: Event;
  reason: string;
  source?: string;
  velocity?: number;
}

/** What a key reports when it is released. */
export interface KeyOffDetails {
  event?: Event;
  reason: string;
}

export interface KeysPublicState extends PianoRollPublicState {
  /** The pitches sounding. */
  active: readonly number[];
  /** Silences a pitch from a key. */
  keyOff: (pitch: number, details: KeyOffDetails) => void;
  /** Auditions a pitch from a key. */
  keyOn: (pitch: number, details: KeyOnDetails) => void;
  pitches: readonly number[];
}

const keyCallsOf = new WeakMap<
  PianoRollController,
  Pick<KeysPublicState, "keyOff" | "keyOn">
>();

/** The calls of the keys, made once for a controller so that the state stays equal between renders. */
function keyCalls(controller: PianoRollController) {
  let calls = keyCallsOf.get(controller);
  if (!calls) {
    calls = {
      keyOff: (pitch, details) =>
        controller.keyOff(
          pitch,
          details as Parameters<PianoRollController["keyOff"]>[1]
        ),
      keyOn: (pitch, details) => {
        // The controller reads Shift from the event; a piano's key may report none.
        details.event ??= new Event(details.reason);
        controller.keyOn(
          pitch,
          details as Parameters<PianoRollController["keyOn"]>[1]
        );
      },
    };
    keyCallsOf.set(controller, calls);
  }
  return calls;
}

export interface VelocityProps extends NoteRef {
  getAriaValueText?: (velocity: number) => string;
  level?: NoteLevel;
}

export interface VelocityLaneProps extends PartProps {
  level?: NoteLevel;
}

export interface PianoRollApi {
  controller: PianoRollController;
  /** The order the notes were in when a gesture began: they keep their places in the DOM while it lasts. */
  frozen: { ids: NoteId[] | null };
  /** The grid element, once it binds. */
  grid: { el: HTMLElement | null };
  internal: { keyOf: (value: unknown) => string };
  /** The note elements, by id. */
  noteEls: Map<string, HTMLElement>;
  /** Gives the focus to what a gesture asked for, once it is mounted. */
  settleFocus: () => void;
}

type Slot<Props, Public = PianoRollPublicState> = SlotDefinition<
  PianoRollState,
  PianoRollApi,
  Props,
  Public
>;

/** The roll's slots, by name. */
export type PianoRollSlots = {
  grid: Slot<PartProps>;
  keys: Slot<PartProps, KeysPublicState>;
  marquee: Slot<PartProps>;
  note: Slot<NoteRef, NotePublicState>;
  noteEnd: Slot<NoteRef, NoteEdgeState>;
  noteStart: Slot<NoteRef, NoteEdgeState>;
  notes: Slot<PartProps, NotesPublicState>;
  root: Slot<PartProps>;
  row: Slot<PartProps & { pitch: number }, RowPublicState>;
  rows: Slot<PartProps, RowsPublicState>;
  selectionSpan: Slot<PartProps>;
  stretchEnd: Slot<PartProps, PianoRollPublicState & { edge: "end" | "start" }>;
  stretchStart: Slot<
    PartProps,
    PianoRollPublicState & { edge: "end" | "start" }
  >;
  velocity: Slot<VelocityProps, NotePublicState>;
  velocityInput: Slot<VelocityProps, object>;
  velocityLane: Slot<
    VelocityLaneProps,
    PianoRollPublicState & { level: NoteLevel }
  >;
};

/** The type of `pianoRoll`, written out so a declaration can print it. */
export interface PianoRollPrimitive {
  options: Record<string, PropSpec> | undefined;
  slots: PianoRollSlots;
  (
    initialOptions: PianoRollPrimitiveOptions & { id: string }
  ): Omit<PrimitiveInstance, "api" | "get" | "types"> & {
    api: PianoRollApi;
    get: () => PianoRollState;
    types: {
      api: PianoRollApi;
      options: PianoRollPrimitiveOptions;
      slots: PianoRollSlots;
      state: PianoRollState;
    };
  };
}

/** The timeline the controller reads, from the options. */
function timelineOf(options: PianoRollPrimitiveOptions) {
  const duration = options.duration ?? 1;
  const snapStep = options.snapStep ?? 0;
  return {
    duration,
    grid: {
      offset: options.snapOffset ?? 0,
      points: options.snapPoints,
      step: snapStep,
    },
    position: () => options.source?.getSnapshot() ?? options.position ?? 0,
    step: options.step ?? (snapStep > 0 ? snapStep : duration / 100),
    zoom: options.zoom ?? null,
  };
}

const unitLength = (zoom: number | null, duration: number) =>
  zoom === null ? `calc(100% / ${duration > 0 ? duration : 1})` : `${zoom}px`;

const placedAt = (value: number) => ({
  [OFFSET_PROPERTY]: String(value),
  left: `calc(var(${UNIT_PROPERTY}) * var(${OFFSET_PROPERTY}))`,
  position: "absolute",
});

const placedOver = (start: number, length: number) => ({
  ...placedAt(start),
  [LENGTH_PROPERTY]: String(length),
  width: `calc(var(${UNIT_PROPERTY}) * var(${LENGTH_PROPERTY}))`,
});

const placedOnRow = (row: number) => ({
  [ROW_PROPERTY]: String(row),
  height: `calc(100% / var(${ROWS_PROPERTY}))`,
  position: "absolute",
  top: `calc(100% * var(${ROW_PROPERTY}) / var(${ROWS_PROPERTY}))`,
});

/** What makes a lane of a surface the roll draws on: the unit its parts are placed with. */
const laneStyle = (state: PianoRollState) => ({
  [UNIT_PROPERTY]: unitLength(state.zoom, state.duration),
  contain: "layout style",
  "overflow-x": "clip",
  position: "relative",
  ...(state.zoom === null
    ? {}
    : { "min-width": `${state.duration * state.zoom}px` }),
});

const publicOf = (state: PianoRollState): PianoRollPublicState => ({
  disabled: state.view.disabled,
  editing: state.view.editing,
  folded: state.view.folded,
  mode: state.view.mode,
});

const stateAttrs = (state: PianoRollState) => ({
  "data-disabled": flag(state.view.disabled),
  "data-editing": flag(state.view.editing),
  "data-folded": flag(state.view.folded),
  "data-mode": state.view.mode,
});

const ids = new WeakMap<object, Map<string, NoteId>>();

/** The id a note is known by: a part carries it as text, a note's own may be a number. */
function idOf(state: PianoRollState, key: NoteId): NoteId {
  let known = ids.get(state.view);
  if (!known) {
    known = new Map(state.view.notes.map((note) => [String(note.id), note.id]));
    ids.set(state.view, known);
  }
  return known.get(String(key)) ?? key;
}

const noteOf = (state: PianoRollState, key: NoteId) =>
  state.view.noteById.get(idOf(state, key));

export const pianoRoll: PianoRollPrimitive = definePrimitive({
  agent: { actions: ["setValue"] },
  api: (context) => {
    const options = () => context.options() as PianoRollPrimitiveOptions;
    const change = createChange(context);
    const noteEls = new Map<string, HTMLElement>();
    const grid = { el: null as HTMLElement | null };
    // Focus that has to wait for the notes to render: a note just added, or where focus goes once the focused note is removed.
    let pending: { target: NoteId | null } | null = null;
    const settleFocus = () => {
      if (!pending) {
        return;
      }
      const element =
        pending.target === null ? grid.el : noteEls.get(String(pending.target));
      // A note not mounted yet takes the focus as it registers.
      if (element) {
        pending = null;
        element.focus({ preventScroll: true });
      }
    };

    const settings = () => {
      const wanted = options();
      const held = context.store.get();
      return {
        activePitches: wanted.activePitches,
        createNoteId: wanted.createNoteId,
        defaultSelection: wanted.defaultSelection,
        defaultValue: wanted.defaultValue,
        disabled: wanted.disabled ?? false,
        drawStyle: wanted.drawStyle,
        folded: wanted.folded ?? false,
        maxPitch: wanted.maxPitch ?? 72,
        minLength: wanted.minLength,
        minPitch: wanted.minPitch ?? 48,
        mode: wanted.mode ?? "select",
        onNoteOff: (pitch: number, details: RollNoteOffDetails) => {
          dispatch(context, "onNoteOff", pitch, {
            event: details.event,
            reason: details.reason,
          });
        },
        onNoteOn: (pitch: number, details: RollNoteOnDetails) => {
          const source = sourceOf(details.event);
          if (
            dispatch(context, "onNoteOn", pitch, {
              event: details.event,
              reason: details.reason,
              ...(source ? { source } : {}),
              velocity: details.velocity,
            })
          ) {
            details.cancel();
          }
        },
        onSelectionChange: (
          selection: readonly NoteId[],
          details: { cancel: () => void; event?: Event; reason: string }
        ) => {
          const source = sourceOf(details.event);
          if (
            !change("selection", [...selection], {
              event: details.event,
              reason: details.reason,
              ...(source ? { source } : {}),
            } as never)
          ) {
            details.cancel();
          }
        },
        onValueChange: (
          value: Note[],
          details: { cancel: () => void; event?: Event; reason: string }
        ) => {
          const { cancel, ...rest } = details;
          const source = sourceOf(details.event);
          if (
            !change("value", value, {
              ...rest,
              ...(source ? { source } : {}),
            } as never)
          ) {
            cancel();
          }
        },
        onValueCommitted: (
          value: Note[],
          details: { event?: Event; reason: string }
        ) => {
          dispatch(context, "onValueCommitted", value, { ...details });
        },
        requestFocus: (target: NoteId | null) => {
          pending = { target };
          queueMicrotask(settleFocus);
        },
        scale: wanted.scale,
        selection: held.selection,
        timeline: timelineOf({
          ...wanted,
          zoom: held.zoom,
          source: held.source,
        }),
        value: held.value,
      };
    };

    const controller: PianoRollController = createPianoRollController(
      settings() as never
    );
    const configure = () => {
      controller.setOptions(settings() as never);
      context.store.set({ view: controller.getSnapshot() } as never);
    };
    configure();
    context.onOptions(configure);
    // What the controller reads of the held state: the notes, the selection and what the timeline gave.
    const watched = () => {
      const held = context.store.get();
      return [
        held.value,
        held.selection,
        held.zoom,
        held.source,
        held.duration,
      ];
    };
    let last = watched();
    context.onDestroy(
      context.store.subscribe(() => {
        const next = watched();
        if (next.some((value, index) => value !== last[index])) {
          last = next;
          configure();
        }
      })
    );
    context.onDestroy(
      controller.subscribe(() =>
        context.store.set({ view: controller.getSnapshot() } as never)
      )
    );

    return {
      controller,
      grid,
      internal: { keyOf: (value: unknown) => String(value) },
      frozen: { ids: null as NoteId[] | null },
      noteEls,
      settleFocus,
    };
  },
  controlled: ["value", "selection"],
  name: "pianoRoll",
  options: {
    activePitches: "value",
    createNoteId: "value",
    defaultSelection: "value",
    defaultValue: "value",
    disabled: "boolean",
    drawStyle: "string",
    duration: "number",
    folded: "value",
    getNoteLabel: "value",
    maxPitch: "number",
    minLength: "number",
    minPitch: "number",
    mode: "string",
    onNoteOff: "callback",
    onNoteOn: "callback",
    onSelectionChange: "callback",
    onValueChange: "callback",
    onValueCommitted: "callback",
    position: "number",
    scale: "value",
    selection: "value",
    snapOffset: "number",
    snapPoints: "value",
    snapStep: "number",
    source: "value",
    step: "number",
    value: "value",
    zoom: "value",
  },
  slots: (slot) => {
    /** The note and the grid a gesture on a part of the note needs. */
    const noteGesture =
      (kind: "end" | "move" | "start") =>
      (
        event: PointerEvent,
        {
          api,
          el,
          props,
          store,
        }: {
          api: PianoRollApi;
          el: HTMLElement | undefined;
          props: NoteRef;
          store: { get: () => PianoRollState };
        }
      ) => {
        if (event.button !== 0) {
          return;
        }
        event.stopPropagation();
        const { grid } = api;
        if (store.get().view.disabled || !(el && grid.el)) {
          return;
        }
        event.preventDefault();
        (api.noteEls.get(String(props.note)) ?? el).focus({
          preventScroll: true,
        });
        api.controller.pressNote(
          idOf(store.get(), props.note),
          kind,
          event,
          el,
          grid.el
        );
      };

    const noteState = (
      state: PianoRollState,
      props: NoteRef
    ): NotePublicState => ({
      ...publicOf(state),
      muted: noteOf(state, props.note)?.muted ?? false,
      selected: state.view.selection.has(idOf(state, props.note)),
    });

    const edge = (kind: "end" | "start") =>
      slot({
        attrs: (state: PianoRollState, { props }: { props: NoteRef }) => ({
          ...stateAttrs(state),
          "aria-hidden": "true",
          "data-edge": kind,
          "data-muted": flag(noteOf(state, props.note)?.muted ?? false),
          "data-selected": flag(
            state.view.selection.has(idOf(state, props.note))
          ),
          style: css({ "touch-action": "none" }),
        }),
        on: { pointerdown: noteGesture(kind) },
        props: { note: "key" },
        state: (state: PianoRollState, { props }: { props: NoteRef }) => ({
          ...noteState(state, props),
          edge: kind,
        }),
      });

    const levelOf = (note: Note | undefined, level: NoteLevel) =>
      (note?.[level] as number | undefined) ?? 1;

    return {
      grid: slot({
        attrs: (state: PianoRollState) => ({
          ...stateAttrs(state),
          "data-timeline-lane": "",
          role: "group",
          style: css({ ...laneStyle(state), "touch-action": "none" }),
          tabindex: state.view.disabled ? "-1" : "0",
        }),
        bind: (el: HTMLElement, part: any) => {
          part.api.grid.el = el;
          part.api.settleFocus?.();
          return () => {
            part.api.grid.el = null;
          };
        },
        on: {
          dblclick: (
            event: MouseEvent,
            { api, el }: { api: PianoRollApi; el: HTMLElement | undefined }
          ) => {
            if (el) {
              api.controller.doubleClickGrid(event, el);
            }
          },
          keydown: (
            event: KeyboardEvent,
            {
              api,
              el,
              store,
            }: {
              api: PianoRollApi;
              el: HTMLElement | undefined;
              store: { get: () => PianoRollState };
            }
          ) => {
            if (store.get().view.disabled) {
              return;
            }
            if (api.controller.keyGrid(event)) {
              event.preventDefault();
              return;
            }
            if (event.key !== "Enter" || event.target !== el) {
              return;
            }
            event.preventDefault();
            api.controller.addAtPlayback(event);
          },
          pointerdown: (
            event: PointerEvent,
            {
              api,
              el,
              store,
            }: {
              api: PianoRollApi;
              el: HTMLElement | undefined;
              store: { get: () => PianoRollState };
            }
          ) => {
            if (!el || event.button !== 0 || store.get().view.disabled) {
              return;
            }
            event.preventDefault();
            el.focus({ preventScroll: true });
            api.controller.pressGrid(event, el);
          },
        },
        state: (state: PianoRollState) => publicOf(state),
      }),
      keys: slot({
        attrs: (state: PianoRollState) => ({
          ...stateAttrs(state),
          // A grid of one cell: the keyboard drawn inside takes the part's whole height and width.
          style: css({
            display: "grid",
            "grid-template-columns": "minmax(0, 1fr)",
            "grid-template-rows": "minmax(0, 1fr)",
          }),
        }),
        state: (state: PianoRollState, { api }: { api: PianoRollApi }) => ({
          ...publicOf(state),
          active: [...state.view.active],
          ...keyCalls(api.controller),
          pitches: state.view.rows.pitches,
        }),
      }),
      marquee: slot({
        attrs: (state: PianoRollState) => {
          const band: PianoRollBand | null = state.view.band;
          return {
            ...stateAttrs(state),
            "aria-hidden": "true",
            hidden: band === null ? "" : undefined,
            style: css({
              height: band ? `${band.height}px` : undefined,
              left: band ? `${band.left}px` : undefined,
              "pointer-events": "none",
              position: "absolute",
              top: band ? `${band.top}px` : undefined,
              width: band ? `${band.width}px` : undefined,
            }),
          };
        },
        state: (state: PianoRollState) => publicOf(state),
      }),
      note: slot({
        attrs: (state: PianoRollState, { props }: { props: NoteRef }) => {
          const note = noteOf(state, props.note);
          const selected = state.view.selection.has(idOf(state, props.note));
          return {
            ...stateAttrs(state),
            "aria-disabled": state.view.disabled ? "true" : undefined,
            "aria-label": note
              ? (state.getNoteLabel ?? describeNote)(note)
              : undefined,
            "aria-pressed": String(selected),
            "data-muted": flag(note?.muted ?? false),
            "data-note": String(props.note),
            "data-selected": flag(selected),
            hidden: note ? undefined : "",
            role: "button",
            style: css(
              note
                ? {
                    ...placedOver(note.start, note.length),
                    ...placedOnRow(state.view.rows.rowOf(note.pitch)),
                    [VELOCITY_PROPERTY]: String(note.velocity ?? 1),
                    [CHANCE_PROPERTY]: String(note.chance ?? 1),
                    "touch-action": "none",
                  }
                : {}
            ),
            tabindex: state.view.disabled ? "-1" : "0",
          };
        },
        bind: (el: HTMLElement, part: any) => {
          const id = String(part.props.note);
          part.api.noteEls.set(id, el);
          part.api.settleFocus?.();
          return () => {
            if (part.api.noteEls.get(id) === el) {
              part.api.noteEls.delete(id);
            }
          };
        },
        on: {
          blur: (event: FocusEvent, { api }: { api: PianoRollApi }) =>
            api.controller.releaseKey(event),
          dblclick: (
            event: MouseEvent,
            {
              api,
              props,
              store,
            }: {
              api: PianoRollApi;
              props: NoteRef;
              store: { get: () => PianoRollState };
            }
          ) => {
            event.stopPropagation();
            if (!store.get().view.disabled) {
              api.controller.doubleClickNote(
                idOf(store.get(), props.note),
                event
              );
            }
          },
          keydown: (
            event: KeyboardEvent,
            {
              api,
              props,
              store,
            }: {
              api: PianoRollApi;
              props: NoteRef;
              store: { get: () => PianoRollState };
            }
          ) => {
            if (store.get().view.disabled) {
              return;
            }
            if (api.controller.shortcut(event)) {
              event.preventDefault();
              // Handled: the grid around the note would run it again.
              event.stopPropagation();
              return;
            }
            if (api.controller.keyNote(idOf(store.get(), props.note), event)) {
              event.preventDefault();
            }
          },
          keyup: (event: KeyboardEvent, { api }: { api: PianoRollApi }) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              api.controller.releaseKey(event);
            }
          },
          pointerdown: noteGesture("move"),
        },
        props: { note: "key" },
        state: (state: PianoRollState, { props }: { props: NoteRef }) =>
          noteState(state, props),
      }),
      noteEnd: edge("end"),
      noteStart: edge("start"),
      // The notes in reading order: a note moved past another keeps its place in the DOM while it is dragged.
      notes: slot({
        attrs: (state: PianoRollState) => ({
          ...stateAttrs(state),
          style: css({ display: "contents" }),
        }),
        state: (state: PianoRollState, { api }: { api: PianoRollApi }) => {
          const { frozen } = api;
          let ordered = spatialOrder(state.view.notes);
          if (state.view.editing) {
            frozen.ids ??= ordered.map((note) => note.id);
            const known = new Map(
              state.view.notes.map((entry) => [entry.id, entry])
            );
            const { ids: order } = frozen;
            const kept = order.flatMap((id) => known.get(id) ?? []);
            const added = ordered.filter((entry) => !order.includes(entry.id));
            ordered = [...kept, ...added];
          } else {
            frozen.ids = null;
          }
          return { ...publicOf(state), notes: ordered };
        },
      }),
      root: slot({
        attrs: (state: PianoRollState) => ({
          ...stateAttrs(state),
          "data-has-selection": flag(state.view.selection.size > 0),
          style: css({
            [ROWS_PROPERTY]: String(state.view.rows.pitches.length),
          }),
        }),
        state: (state: PianoRollState) => publicOf(state),
      }),
      row: slot({
        attrs: (
          state: PianoRollState,
          { props }: { props: PartProps & { pitch: number } }
        ) => {
          const view = rowState(state, Number(props.pitch));
          return {
            ...stateAttrs(state),
            "aria-hidden": "true",
            "data-active": flag(view.active),
            "data-color": view.color,
            "data-in-scale": flag(view.inScale),
            "data-octave": flag(view.octave),
            "data-out-of-scale": flag(view.outOfScale),
            "data-pitch": String(props.pitch),
            "data-scale-root": flag(view.scaleRoot),
            style: css({
              ...placedOnRow(state.view.rows.rowOf(Number(props.pitch))),
              left: "0",
              "pointer-events": "none",
              right: "0",
            }),
          };
        },
        props: { pitch: "key" },
        state: (
          state: PianoRollState,
          { props }: { props: PartProps & { pitch: number } }
        ) => rowState(state, Number(props.pitch)),
      }),
      rows: slot({
        attrs: (state: PianoRollState) => ({
          ...stateAttrs(state),
          style: css({ display: "contents" }),
        }),
        state: (state: PianoRollState) => ({
          ...publicOf(state),
          pitches: state.view.rows.pitches,
        }),
      }),
      selectionSpan: slot({
        attrs: (state: PianoRollState) => {
          const span = selectionSpan(state.view.notes, state.view.selection);
          return {
            ...stateAttrs(state),
            "aria-hidden": "true",
            hidden: span === null ? "" : undefined,
            style: css({
              ...(span ? placedOver(span.start, span.end - span.start) : {}),
              bottom: "0",
              "pointer-events": "none",
              position: "absolute",
              top: "0",
            }),
          };
        },
        state: (state: PianoRollState) => publicOf(state),
      }),
      stretchEnd: stretch("end", slot),
      stretchStart: stretch("start", slot),
      velocity: slot({
        attrs: (state: PianoRollState, { props }: { props: VelocityProps }) => {
          const note = noteOf(state, props.note);
          const level = props.level ?? "velocity";
          const value = levelOf(note, level);
          return {
            ...stateAttrs(state),
            "data-muted": flag(note?.muted ?? false),
            "data-note": String(props.note),
            "data-selected": flag(
              state.view.selection.has(idOf(state, props.note))
            ),
            hidden: note ? undefined : "",
            style: css(
              note
                ? {
                    ...placedAt(note.start),
                    [LEVEL_PROPERTY]: String(value),
                    [VELOCITY_PROPERTY]: String(note.velocity ?? 1),
                    [CHANCE_PROPERTY]: String(note.chance ?? 1),
                    [DEVIATION_PROPERTY]: String(note.deviation ?? 0),
                    bottom: "0",
                    height: `calc(var(${LEVEL_PROPERTY}) * 100%)`,
                    "touch-action": "none",
                  }
                : {}
            ),
          };
        },
        on: {
          pointerdown: (
            event: PointerEvent,
            {
              api,
              el,
              props,
              store,
            }: {
              api: PianoRollApi;
              el: HTMLElement | undefined;
              props: VelocityProps;
              store: { get: () => PianoRollState };
            }
          ) => {
            if (!el || event.button !== 0 || store.get().view.disabled) {
              return;
            }
            event.preventDefault();
            el.querySelector<HTMLInputElement>('input[type="range"]')?.focus({
              preventScroll: true,
            });
            api.controller.pressVelocity(
              idOf(store.get(), props.note),
              event,
              el,
              el.closest<HTMLElement>("[data-timeline-lane]"),
              props.level ?? "velocity"
            );
          },
        },
        props: { getAriaValueText: "value", level: "string", note: "key" },
        state: (
          state: PianoRollState,
          { props }: { props: VelocityProps }
        ) => ({
          ...publicOf(state),
          muted: noteOf(state, props.note)?.muted ?? false,
          selected: state.view.selection.has(idOf(state, props.note)),
        }),
      }),
      velocityInput: slot({
        attrs: (state: PianoRollState, { props }: { props: VelocityProps }) => {
          const note = noteOf(state, props.note);
          const value = levelOf(note, props.level ?? "velocity");
          return {
            "aria-valuetext": (props.getAriaValueText ?? describeVelocity)(
              value
            ),
            disabled: flag(state.view.disabled),
            max: "1",
            min: "0",
            step: "any",
            style: css(VISUALLY_HIDDEN),
            type: "range",
            value: String(value),
          };
        },
        on: {
          change: (
            event: Event,
            {
              api,
              el,
              props,
              store,
            }: {
              api: PianoRollApi;
              el: HTMLElement | undefined;
              props: VelocityProps;
              store: { get: () => PianoRollState };
            }
          ) =>
            api.controller.setVelocity(
              idOf(store.get(), props.note),
              Number((el as HTMLInputElement).value),
              event,
              props.level ?? "velocity"
            ),
          keydown: (
            event: KeyboardEvent,
            {
              api,
              props,
              store,
            }: {
              api: PianoRollApi;
              props: VelocityProps;
              store: { get: () => PianoRollState };
            }
          ) => {
            if (store.get().view.disabled) {
              return;
            }
            if (
              api.controller.keyVelocity(
                idOf(store.get(), props.note),
                event,
                props.level ?? "velocity"
              )
            ) {
              event.preventDefault();
            }
          },
        },
        props: { getAriaValueText: "value", level: "string", note: "key" },
      }),
      // A lane for the notes' velocities, or their chances: a press between the bars paints in draw mode.
      velocityLane: slot({
        attrs: (
          state: PianoRollState,
          { props }: { props: VelocityLaneProps }
        ) => ({
          ...stateAttrs(state),
          "data-level": props.level ?? "velocity",
          "data-timeline-lane": "",
          role: "group",
          style: css(laneStyle(state)),
        }),
        on: {
          // A bar takes its own presses; one on the lane between them paints.
          pointerdown: (
            event: PointerEvent,
            {
              api,
              el,
              props,
            }: {
              api: PianoRollApi;
              el: HTMLElement | undefined;
              props: VelocityLaneProps;
            }
          ) => {
            if (el && !event.defaultPrevented) {
              api.controller.paintLevels(event, el, props.level ?? "velocity");
            }
          },
        },
        props: { level: "string" },
        state: (
          state: PianoRollState,
          { props }: { props: VelocityLaneProps }
        ) => ({ ...publicOf(state), level: props.level ?? "velocity" }),
      }),
    };
  },
  state: (options: PianoRollPrimitiveOptions): PianoRollState => {
    const notes = options.value ?? options.defaultValue ?? [];
    const selection = options.selection ?? options.defaultSelection ?? [];
    const zoom = options.zoom ?? null;
    const view = createPianoRollController({
      defaultValue: options.defaultValue,
      disabled: options.disabled ?? false,
      folded: options.folded ?? false,
      maxPitch: options.maxPitch ?? 72,
      minPitch: options.minPitch ?? 48,
      mode: options.mode ?? "select",
      scale: options.scale,
      selection,
      timeline: timelineOf(options),
      value: notes,
    } as never).getSnapshot();
    return {
      duration: options.duration ?? 1,
      getNoteLabel: options.getNoteLabel,
      selection,
      source: options.source,
      value: notes,
      view,
      zoom,
    };
  },
  sync: (options: PianoRollPrimitiveOptions) => ({
    duration: options.duration ?? 1,
    getNoteLabel: options.getNoteLabel,
    ...(options.value === undefined ? {} : { value: options.value }),
    ...(options.selection === undefined
      ? {}
      : { selection: options.selection }),
    source: options.source,
    zoom: options.zoom ?? null,
  }),
});

/** What a row reads: whether it sounds, its colour and its place in the scale. */
function rowState(state: PianoRollState, pitch: number): RowPublicState {
  const { rows, active } = state.view;
  const pitchClass = ((pitch % 12) + 12) % 12;
  const inScale = rows.scale?.includes(pitchClass) ?? false;
  return {
    ...publicOf(state),
    active: active.has(pitch),
    color: isBlackKey(pitch) ? "black" : "white",
    inScale,
    octave: pitchClass === 0,
    outOfScale: rows.scale !== null && !inScale,
    scaleRoot: (rows as Rows).root === pitchClass,
  };
}

/** A handle on the selection's span that stretches the selected notes from one edge. */
function stretch(kind: "end" | "start", slot: any) {
  return slot({
    attrs: (state: PianoRollState) => ({
      ...stateAttrs(state),
      "aria-hidden": "true",
      "data-edge": kind,
      style: css({
        [kind === "start" ? "left" : "right"]: "0",
        bottom: "0",
        "pointer-events": "auto",
        position: "absolute",
        top: "0",
        "touch-action": "none",
      }),
    }),
    on: {
      pointerdown: (
        event: PointerEvent,
        { api, el }: { api: PianoRollApi; el: HTMLElement | undefined }
      ) => {
        if (api.grid.el && el) {
          event.stopPropagation();
          api.controller.pressStretch(kind, event, el, api.grid.el);
        }
      },
    },
    state: (state: PianoRollState) => ({ ...publicOf(state), edge: kind }),
  });
}