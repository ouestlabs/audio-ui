import * as React from "react";
import { useKeyboardNavigation } from "../hooks/interactions/use-keyboard-navigation";
import { useCallbackRef } from "../hooks/use-callback-ref";
import type { Nullable, Point, Procedure } from "../utils";
import { clamp, clampUnit, panic } from "../utils";
import { getDataAttributes } from "./internal/data-attributes";
import { useParameterCore } from "./internal/use-parameter-core";

const DEFAULT_TOTAL_STEPS = 16;
const DEFAULT_START_NOTE = 48;
const DEFAULT_END_NOTE = 72;
const DEFAULT_MIN_DURATION = 1;
/** Pointer must move this many pixels before a press on a note, a resize handle, or empty grid space commits to a drag — below it, a release is just a click (select, or a plain 1-step add), matching how most drag-to-draw editors disambiguate intent. */
const DRAG_THRESHOLD_PX = 4;

function exceedsDragThreshold(origin: Point, current: Point): boolean {
  const dx = current.x - origin.x;
  const dy = current.y - origin.y;
  return dx * dx + dy * dy >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX;
}

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

const KEY_COLOR_PATTERN: Array<"white" | "black"> = [
  "white",
  "black",
  "white",
  "black",
  "white",
  "white",
  "black",
  "white",
  "black",
  "white",
  "black",
  "white",
];

function getKeyColor(note: number): "white" | "black" {
  return KEY_COLOR_PATTERN[((note % 12) + 12) % 12] ?? "white";
}

function getNoteName(note: number): string {
  const name = NOTE_NAMES[((note % 12) + 12) % 12];
  const octave = Math.floor(note / 12) - 1;
  return `${name}${octave}`;
}

export namespace PianoRoll {
  /** A note's time and duration are always integer step counts — grid-snapped by construction, never a fractional/continuous position. Real-world timing (BPM, seconds) is a consumer concern, same as Sequencer's step-indexed model. */
  export interface Note {
    duration: number;
    id: number | string;
    note: number;
    startStep: number;
    /** 0-1; defaults to 1 when omitted. */
    velocity?: number;
  }

  interface Domain {
    endNote: number;
    minDuration: number;
    startNote: number;
    totalSteps: number;
  }

  function sanitizeNote(n: Note, domain: Domain): Note {
    const duration = clamp(
      Math.round(n.duration),
      domain.minDuration,
      domain.totalSteps
    );
    const startStep = clamp(
      Math.round(n.startStep),
      0,
      domain.totalSteps - duration
    );
    const note = clamp(Math.round(n.note), domain.startNote, domain.endNote);
    const velocity = clampUnit(n.velocity ?? 1);
    return { ...n, duration, note, startStep, velocity };
  }

  function sanitizeNotes(notes: Note[], domain: Domain): Note[] {
    return notes.map((n) => sanitizeNote(n, domain));
  }

  /** "paint" extends a freshly-created note in either direction from its anchor step, pitch locked — the note grows toward wherever the pointer drags, unlike "resize-end"/"resize-start" which anchor one edge of an existing note. */
  type DragMode = "move" | "paint" | "resize-end" | "resize-start";

  interface DragOrigin {
    mode: DragMode;
    notesById: Map<Note["id"], Note>;
    point: Point;
  }

  interface ConfigContextValue {
    /** Returns the new note's id (so a caller can immediately start a paint drag on it), or null when disabled. */
    addNoteAt: (step: number, note: number) => Nullable<Note["id"]>;
    ariaLabel?: string;
    ariaLabelledBy?: string;
    beginNoteDrag: (id: Note["id"], mode: DragMode, point: Point) => void;
    clearSelection: () => void;
    commitNoteDrag: () => void;
    disabled: boolean;
    domain: Domain;
    dragNoteTo: (point: Point) => void;
    /** Copies a note (or its selection group) to new ids, selects the copies, begins a "move" drag on them directly, and returns the anchor's new id — or null when disabled or there was nothing to copy. */
    duplicateAndBeginDrag: (
      anchorId: Note["id"],
      point: Point
    ) => Nullable<Note["id"]>;
    elementId: string;
    focusNote: (id: Note["id"]) => void;
    keyPointerHandlers: {
      onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
      onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
      onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
      onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
    };
    keysTrackRef: React.RefObject<Nullable<HTMLDivElement>>;
    nudgeNote: (id: Note["id"], deltaStep: number, deltaNote: number) => void;
    registerNote: (id: Note["id"], node: Nullable<HTMLElement>) => void;
    removeNote: (id: Note["id"]) => void;
    /** Removes exactly this note, never the whole selection — for a targeted action like double-click, distinct from `removeNote`'s selection-aware behavior for Delete/Backspace. */
    removeNoteOnly: (id: Note["id"]) => void;
    resizeNoteBy: (id: Note["id"], deltaDuration: number) => void;
    selectOnly: (id: Note["id"]) => void;
    setFocusedId: Procedure<Nullable<Note["id"]>>;
    shouldPreventFocusRef: React.RefObject<boolean>;
    toggleSelection: (id: Note["id"]) => void;
    trackRef: React.RefObject<Nullable<HTMLDivElement>>;
  }

  /** Split from config: changes every drag/press frame, so only components that render live positions or highlight state subscribe to it. */
  interface ValueContextValue {
    activeKeySet: Set<number>;
    focusedId: Nullable<Note["id"]>;
    selectedIds: Set<Note["id"]>;
    value: Note[];
  }

  const ConfigContext = React.createContext<ConfigContextValue | null>(null);
  const ValueContext = React.createContext<ValueContextValue | null>(null);
  const NoteContext = React.createContext<Nullable<Note>>(null);

  function useConfigContext() {
    const context = React.useContext(ConfigContext);
    if (!context) {
      panic("PianoRoll components must be used within PianoRoll.Root");
    }
    return context;
  }

  function useValueContext() {
    const context = React.useContext(ValueContext);
    if (!context) {
      panic("PianoRoll components must be used within PianoRoll.Root");
    }
    return context;
  }

  function useNoteContext() {
    const note = React.useContext(NoteContext);
    if (!note) {
      panic("PianoRoll.NoteHandle must be used within PianoRoll.Note");
    }
    return note;
  }

  export interface RootProps
    extends Omit<React.ComponentProps<"div">, "onChange" | "defaultValue"> {
    /** Notes highlighted on the key strip from outside pointer interaction (external MIDI input, a note being edited on the grid). Merged with pointer-pressed keys for display. */
    activeNotes?: number[];
    "aria-label"?: string;
    "aria-labelledby"?: string;
    defaultValue?: Note[];
    disabled?: boolean;
    /** Highest MIDI note in the grid's pitch range (inclusive). */
    endNote?: number;
    /** Floor on a note's length, in steps. */
    minDuration?: number;
    onKeyNoteOff?: Procedure<number>;
    onKeyNoteOn?: Procedure<number>;
    onValueChange?: Procedure<Note[]>;
    onValueCommit?: Procedure<Note[]>;
    /** Lowest MIDI note in the grid's pitch range (inclusive). */
    startNote?: number;
    /** Width of the timeline, in grid steps. */
    totalSteps?: number;
    value?: Note[];
  }

  export function Root({
    value: controlledValue,
    defaultValue = [],
    totalSteps = DEFAULT_TOTAL_STEPS,
    startNote = DEFAULT_START_NOTE,
    endNote = DEFAULT_END_NOTE,
    minDuration = DEFAULT_MIN_DURATION,
    disabled = false,
    activeNotes,
    onKeyNoteOff,
    onKeyNoteOn,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    onValueChange,
    onValueCommit,
    id,
    className,
    style,
    children,
    ...props
  }: RootProps) {
    const rootId = React.useId();
    const trackRef = React.useRef<HTMLDivElement>(null);
    const keysTrackRef = React.useRef<HTMLDivElement>(null);
    const noteElementsRef = React.useRef(new Map<Note["id"], HTMLElement>());
    const nextIdRef = React.useRef(0);
    const dragOriginRef = React.useRef<Nullable<DragOrigin>>(null);
    const pointerKeysRef = React.useRef(new Map<number, number>());
    const [focusedId, setFocusedId] =
      React.useState<Nullable<Note["id"]>>(null);
    const [selectedIds, setSelectedIds] = React.useState<Set<Note["id"]>>(
      () => new Set()
    );
    const [pressedKeys, setPressedKeys] = React.useState<Set<number>>(
      () => new Set()
    );
    const selectedIdsRef = React.useRef(selectedIds);
    selectedIdsRef.current = selectedIds;

    const domain = React.useMemo<Domain>(
      () => ({ endNote, minDuration, startNote, totalSteps }),
      [endNote, minDuration, startNote, totalSteps]
    );

    const clampStep = React.useCallback(
      (next: Note[]) => sanitizeNotes(next, domain),
      [domain]
    );

    const {
      beginDrag,
      commitValue,
      dragTo,
      endDrag,
      pendingValueRef,
      shouldPreventFocusRef,
      value: notes,
      valueRef,
    } = useParameterCore<Note[]>({
      clampStep,
      defaultValue: sanitizeNotes(defaultValue, domain),
      disabled,
      fallbackValue: sanitizeNotes(defaultValue, domain),
      onValueChange,
      onValueCommit,
      transform: clampStep,
      value: controlledValue,
    });

    const focusNote = React.useCallback((noteId: Note["id"]) => {
      setFocusedId(noteId);
      noteElementsRef.current.get(noteId)?.focus();
    }, []);

    const registerNote = React.useCallback(
      (noteId: Note["id"], node: Nullable<HTMLElement>) => {
        if (node) {
          noteElementsRef.current.set(noteId, node);
        } else {
          noteElementsRef.current.delete(noteId);
        }
      },
      []
    );

    const selectOnly = React.useCallback((noteId: Note["id"]) => {
      setSelectedIds((prev) =>
        prev.size === 1 && prev.has(noteId) ? prev : new Set([noteId])
      );
    }, []);

    const toggleSelection = React.useCallback((noteId: Note["id"]) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(noteId)) {
          next.delete(noteId);
        } else {
          next.add(noteId);
        }
        return next;
      });
    }, []);

    const clearSelection = React.useCallback(() => {
      setSelectedIds((prev) => (prev.size === 0 ? prev : new Set()));
    }, []);

    const addNoteAt = React.useCallback(
      (step: number, note: number): Nullable<Note["id"]> => {
        if (disabled) {
          return null;
        }
        const newId = `note-${nextIdRef.current}`;
        nextIdRef.current += 1;
        const created = sanitizeNote(
          {
            duration: minDuration,
            id: newId,
            note,
            startStep: step,
            velocity: 1,
          },
          domain
        );
        commitValue([...valueRef.current, created]);
        shouldPreventFocusRef.current = true;
        setFocusedId(newId);
        return newId;
      },
      [
        commitValue,
        disabled,
        domain,
        minDuration,
        shouldPreventFocusRef,
        valueRef,
      ]
    );

    /**
     * Copies `anchorId` (or its whole selection group, if it's part of one)
     * to new ids at the same position, selects the copies, and begins a
     * "move" drag on them directly — returning the anchor's new id, or null
     * when disabled or there was nothing to copy.
     *
     * This has to prime the drag itself rather than just creating the
     * duplicates and letting the caller call `beginNoteDrag`: `valueRef`
     * only reflects a controlled `value` prop once the consumer re-renders
     * with it, which hasn't happened yet a few lines after `commitValue` in
     * the same synchronous handler — so `beginNoteDrag`'s own
     * `valueRef.current.find(...)` would find nothing. `beginDrag`'s
     * `pendingValueRef`/`dragStartValueRef`, by contrast, are plain ref
     * writes with no such lag, so seeding those directly with the freshly
     * built array (duplicates included) is what actually works.
     */
    const duplicateAndBeginDrag = React.useCallback(
      (anchorId: Note["id"], point: Point): Nullable<Note["id"]> => {
        if (disabled) {
          return null;
        }
        const base = valueRef.current;
        const isGroup =
          selectedIdsRef.current.has(anchorId) &&
          selectedIdsRef.current.size > 1;
        const ids = isGroup ? selectedIdsRef.current : new Set([anchorId]);
        const idMap = new Map<Note["id"], Note["id"]>();
        const duplicates: Note[] = [];
        for (const n of base) {
          if (!ids.has(n.id)) {
            continue;
          }
          const newId = `note-${nextIdRef.current}`;
          nextIdRef.current += 1;
          idMap.set(n.id, newId);
          duplicates.push({ ...n, id: newId });
        }
        if (duplicates.length === 0) {
          return null;
        }
        const nextValue = [...base, ...duplicates];
        commitValue(nextValue);
        const newSelection = new Set(idMap.values());
        selectedIdsRef.current = newSelection;
        setSelectedIds(newSelection);

        const notesById = new Map<Note["id"], Note>();
        for (const duplicate of duplicates) {
          notesById.set(duplicate.id, duplicate);
        }
        dragOriginRef.current = { mode: "move", notesById, point };
        beginDrag(nextValue);

        return idMap.get(anchorId) ?? null;
      },
      [beginDrag, commitValue, disabled, valueRef]
    );

    const removeNote = React.useCallback(
      (noteId: Note["id"]) => {
        if (disabled) {
          return;
        }
        const base = valueRef.current;
        const index = base.findIndex((n) => n.id === noteId);
        if (index === -1) {
          return;
        }
        const isGroup =
          selectedIdsRef.current.has(noteId) && selectedIdsRef.current.size > 1;
        const idsToRemove = isGroup
          ? selectedIdsRef.current
          : new Set([noteId]);
        const next = base.filter((n) => !idsToRemove.has(n.id));
        commitValue(next);
        clearSelection();
        const fallback = next[Math.min(index, next.length - 1)];
        setFocusedId(fallback ? fallback.id : null);
      },
      [clearSelection, commitValue, disabled, valueRef]
    );

    const removeNoteOnly = React.useCallback(
      (noteId: Note["id"]) => {
        if (disabled) {
          return;
        }
        const base = valueRef.current;
        const index = base.findIndex((n) => n.id === noteId);
        if (index === -1) {
          return;
        }
        const next = base.filter((n) => n.id !== noteId);
        commitValue(next);
        setSelectedIds((prev) => {
          if (!prev.has(noteId)) {
            return prev;
          }
          const nextSelected = new Set(prev);
          nextSelected.delete(noteId);
          return nextSelected;
        });
        const fallback = next[Math.min(index, next.length - 1)];
        setFocusedId(fallback ? fallback.id : null);
      },
      [commitValue, disabled, valueRef]
    );

    const nudgeNote = React.useCallback(
      (noteId: Note["id"], deltaStepInput: number, deltaNoteInput: number) => {
        const base = valueRef.current;
        const isGroup =
          selectedIdsRef.current.has(noteId) && selectedIdsRef.current.size > 1;
        const ids = isGroup ? selectedIdsRef.current : new Set([noteId]);
        const groupNotes = base.filter((n) => ids.has(n.id));
        if (groupNotes.length === 0) {
          return;
        }
        let deltaStep = deltaStepInput;
        let deltaNote = deltaNoteInput;
        for (const n of groupNotes) {
          deltaStep = clamp(
            deltaStep,
            -n.startStep,
            domain.totalSteps - n.duration - n.startStep
          );
          deltaNote = clamp(
            deltaNote,
            domain.startNote - n.note,
            domain.endNote - n.note
          );
        }
        commitValue(
          base.map((n) =>
            ids.has(n.id)
              ? {
                  ...n,
                  note: n.note + deltaNote,
                  startStep: n.startStep + deltaStep,
                }
              : n
          )
        );
      },
      [commitValue, domain, valueRef]
    );

    const resizeNoteBy = React.useCallback(
      (noteId: Note["id"], deltaDurationInput: number) => {
        const base = valueRef.current;
        const isGroup =
          selectedIdsRef.current.has(noteId) && selectedIdsRef.current.size > 1;
        const ids = isGroup ? selectedIdsRef.current : new Set([noteId]);
        const groupNotes = base.filter((n) => ids.has(n.id));
        if (groupNotes.length === 0) {
          return;
        }
        let deltaDuration = deltaDurationInput;
        for (const n of groupNotes) {
          deltaDuration = clamp(
            deltaDuration,
            domain.minDuration - n.duration,
            domain.totalSteps - n.startStep - n.duration
          );
        }
        commitValue(
          base.map((n) =>
            ids.has(n.id) ? { ...n, duration: n.duration + deltaDuration } : n
          )
        );
      },
      [commitValue, domain, valueRef]
    );

    const beginNoteDrag = React.useCallback(
      (noteId: Note["id"], mode: DragMode, point: Point) => {
        const base = valueRef.current;
        const current = base.find((n) => n.id === noteId);
        if (!current) {
          return;
        }
        const isGroup =
          selectedIdsRef.current.has(noteId) && selectedIdsRef.current.size > 1;
        const ids = isGroup ? selectedIdsRef.current : new Set([noteId]);
        const notesById = new Map<Note["id"], Note>();
        for (const n of base) {
          if (ids.has(n.id)) {
            notesById.set(n.id, n);
          }
        }
        dragOriginRef.current = { mode, notesById, point };
        beginDrag(base);
      },
      [beginDrag, valueRef]
    );

    const dragNoteTo = React.useCallback(
      (point: Point) => {
        const origin = dragOriginRef.current;
        const track = trackRef.current;
        if (!(origin && track)) {
          return;
        }
        const rect = track.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          return;
        }
        const noteRange = domain.endNote - domain.startNote + 1;
        let deltaStep = Math.round(
          ((point.x - origin.point.x) / rect.width) * domain.totalSteps
        );
        let deltaNote = Math.round(
          (-(point.y - origin.point.y) / rect.height) * noteRange
        );

        // Clamp against every note in the drag so the whole group is bounded
        // by its most-restrictive member — clamping each note independently
        // would let the group visually compress as members hit the edge at
        // different times.
        for (const n of origin.notesById.values()) {
          if (origin.mode === "move") {
            deltaStep = clamp(
              deltaStep,
              -n.startStep,
              domain.totalSteps - n.duration - n.startStep
            );
            deltaNote = clamp(
              deltaNote,
              domain.startNote - n.note,
              domain.endNote - n.note
            );
          } else if (origin.mode === "resize-end") {
            deltaStep = clamp(
              deltaStep,
              domain.minDuration - n.duration,
              domain.totalSteps - n.startStep - n.duration
            );
          } else if (origin.mode === "resize-start") {
            const end = n.startStep + n.duration;
            deltaStep = clamp(
              deltaStep,
              -n.startStep,
              end - domain.minDuration - n.startStep
            );
          } else {
            // paint: the anchor step can extend the note either direction,
            // bounded only by the grid's own edges.
            deltaStep = clamp(
              deltaStep,
              -n.startStep,
              domain.totalSteps - 1 - n.startStep
            );
          }
        }

        const base = pendingValueRef.current;
        const next = base.map((n) => {
          const original = origin.notesById.get(n.id);
          if (!original) {
            return n;
          }
          if (origin.mode === "move") {
            return {
              ...n,
              note: original.note + deltaNote,
              startStep: original.startStep + deltaStep,
            };
          }
          if (origin.mode === "resize-start") {
            const end = original.startStep + original.duration;
            const startStep = original.startStep + deltaStep;
            return { ...n, duration: end - startStep, startStep };
          }
          if (origin.mode === "paint") {
            const anchorStep = original.startStep;
            const currentStep = anchorStep + deltaStep;
            const startStep = Math.min(anchorStep, currentStep);
            const duration = Math.abs(currentStep - anchorStep) + 1;
            return { ...n, duration, startStep };
          }
          return { ...n, duration: original.duration + deltaStep };
        });
        dragTo(next);
      },
      [domain, dragTo, pendingValueRef]
    );

    const commitNoteDrag = React.useCallback(() => {
      dragOriginRef.current = null;
      endDrag();
    }, [endDrag]);

    const onKeyNoteOnRef = useCallbackRef(onKeyNoteOn);
    const onKeyNoteOffRef = useCallbackRef(onKeyNoteOff);

    const keyNoteOn = React.useCallback(
      (note: number) => {
        if (disabled) {
          return;
        }
        setPressedKeys((prev) =>
          prev.has(note) ? prev : new Set(prev).add(note)
        );
        onKeyNoteOnRef(note);
      },
      [disabled, onKeyNoteOnRef]
    );

    const keyNoteOff = React.useCallback(
      (note: number) => {
        setPressedKeys((prev) => {
          if (!prev.has(note)) {
            return prev;
          }
          const next = new Set(prev);
          next.delete(note);
          return next;
        });
        onKeyNoteOffRef(note);
      },
      [onKeyNoteOffRef]
    );

    const getNoteFromClientY = React.useCallback(
      (clientY: number) => {
        const track = keysTrackRef.current;
        if (!track) {
          return null;
        }
        const rect = track.getBoundingClientRect();
        if (rect.height <= 0) {
          return null;
        }
        const noteRange = domain.endNote - domain.startNote + 1;
        const fraction = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
        return (
          domain.startNote +
          Math.min(noteRange - 1, Math.floor(fraction * noteRange))
        );
      },
      [domain]
    );

    const handleKeysPointerDown = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (disabled) {
          return;
        }
        const note = getNoteFromClientY(e.clientY);
        if (note === null) {
          return;
        }
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        pointerKeysRef.current.set(e.pointerId, note);
        keyNoteOn(note);
      },
      [disabled, getNoteFromClientY, keyNoteOn]
    );

    const handleKeysPointerMove = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const currentNote = pointerKeysRef.current.get(e.pointerId);
        if (currentNote === undefined) {
          return;
        }
        const nextNote = getNoteFromClientY(e.clientY);
        if (nextNote === null || nextNote === currentNote) {
          return;
        }
        keyNoteOff(currentNote);
        keyNoteOn(nextNote);
        pointerKeysRef.current.set(e.pointerId, nextNote);
      },
      [getNoteFromClientY, keyNoteOn, keyNoteOff]
    );

    const releaseKeysPointer = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const note = pointerKeysRef.current.get(e.pointerId);
        if (note === undefined) {
          return;
        }
        pointerKeysRef.current.delete(e.pointerId);
        keyNoteOff(note);
        e.currentTarget.releasePointerCapture(e.pointerId);
      },
      [keyNoteOff]
    );

    const keyPointerHandlers = React.useMemo(
      () => ({
        onPointerCancel: releaseKeysPointer,
        onPointerDown: handleKeysPointerDown,
        onPointerMove: handleKeysPointerMove,
        onPointerUp: releaseKeysPointer,
      }),
      [releaseKeysPointer, handleKeysPointerDown, handleKeysPointerMove]
    );

    const activeKeySet = React.useMemo(() => {
      const set = new Set(pressedKeys);
      if (activeNotes) {
        for (const n of activeNotes) {
          set.add(n);
        }
      }
      return set;
    }, [pressedKeys, activeNotes]);

    const elementId = id || rootId;

    const configValue = React.useMemo<ConfigContextValue>(
      () => ({
        addNoteAt,
        ariaLabel,
        ariaLabelledBy,
        beginNoteDrag,
        clearSelection,
        commitNoteDrag,
        disabled,
        domain,
        dragNoteTo,
        duplicateAndBeginDrag,
        elementId,
        focusNote,
        keyPointerHandlers,
        keysTrackRef,
        nudgeNote,
        registerNote,
        removeNote,
        removeNoteOnly,
        resizeNoteBy,
        selectOnly,
        setFocusedId,
        shouldPreventFocusRef,
        toggleSelection,
        trackRef,
      }),
      [
        addNoteAt,
        ariaLabel,
        ariaLabelledBy,
        beginNoteDrag,
        clearSelection,
        commitNoteDrag,
        disabled,
        domain,
        dragNoteTo,
        duplicateAndBeginDrag,
        elementId,
        focusNote,
        keyPointerHandlers,
        nudgeNote,
        registerNote,
        removeNote,
        removeNoteOnly,
        resizeNoteBy,
        selectOnly,
        shouldPreventFocusRef,
        toggleSelection,
      ]
    );

    const valueContextValue = React.useMemo<ValueContextValue>(
      () => ({ activeKeySet, focusedId, selectedIds, value: notes }),
      [activeKeySet, focusedId, selectedIds, notes]
    );

    return (
      <ConfigContext.Provider value={configValue}>
        <ValueContext.Provider value={valueContextValue}>
          <div
            className={className}
            {...getDataAttributes("piano-roll", {
              disabled,
              part: "piano-roll-wrapper",
            })}
            style={{ position: "relative", ...style }}
            {...props}
          >
            {ariaLabel || ariaLabelledBy ? null : (
              <span className="sr-only" id={`${elementId}-label`}>
                Piano roll
              </span>
            )}
            <span className="sr-only" id={`${elementId}-instructions`}>
              Click empty space to add a note, or drag across empty space to
              draw a note spanning several steps — or focus the grid and press
              Enter. Drag a note to move it, hold Alt or Option while dragging
              to move a copy instead, and drag its start or end edge to resize
              it. Shift-click a note to add it to the selection and drag or
              resize any selected note to move the whole group. Use arrow keys
              to move the focused note or selection, hold Shift and press left
              or right arrow to resize it, and press Delete to remove it.
            </span>
            {children}
          </div>
        </ValueContext.Provider>
      </ConfigContext.Provider>
    );
  }

  export interface GridProps extends React.ComponentProps<"div"> {}

  interface GridPaintState {
    noteId: Note["id"];
    origin: Point;
    started: boolean;
  }

  /** Click empty space to add a 1-step note, or drag to paint a longer one in either direction from where the press landed — the drag only commits past `DRAG_THRESHOLD_PX`, so a plain click stays a plain click. */
  export function Grid({
    className,
    style,
    onKeyDown,
    onPointerDown,
    ...props
  }: GridProps) {
    const {
      addNoteAt,
      ariaLabel,
      ariaLabelledBy,
      beginNoteDrag,
      clearSelection,
      commitNoteDrag,
      disabled,
      domain,
      dragNoteTo,
      elementId,
      trackRef,
    } = useConfigContext();

    const paintRef = React.useRef<Nullable<GridPaintState>>(null);

    const defaultAddPosition = React.useCallback((): [number, number] => {
      const noteRange = domain.endNote - domain.startNote + 1;
      return [0, domain.startNote + Math.floor(noteRange / 2)];
    }, [domain]);

    const positionFromPoint = React.useCallback(
      (point: Point, rect: DOMRect): [number, number] => {
        const noteRange = domain.endNote - domain.startNote + 1;
        const step = clamp(
          Math.floor(((point.x - rect.left) / rect.width) * domain.totalSteps),
          0,
          domain.totalSteps - domain.minDuration
        );
        const fraction = clamp(1 - (point.y - rect.top) / rect.height, 0, 1);
        const note =
          domain.startNote +
          Math.min(noteRange - 1, Math.floor(fraction * noteRange));
        return [step, note];
      },
      [domain]
    );

    const handlePointerDown = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        onPointerDown?.(e);
        if (disabled || e.target !== e.currentTarget) {
          return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          return;
        }
        clearSelection();
        const origin = { x: e.clientX, y: e.clientY };
        const [step, note] = positionFromPoint(origin, rect);
        const newId = addNoteAt(step, note);
        if (newId === null) {
          return;
        }
        e.currentTarget.setPointerCapture(e.pointerId);
        paintRef.current = { noteId: newId, origin, started: false };
      },
      [addNoteAt, clearSelection, disabled, onPointerDown, positionFromPoint]
    );

    const handlePointerMove = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const paint = paintRef.current;
        if (!paint) {
          return;
        }
        const point = { x: e.clientX, y: e.clientY };
        if (!paint.started) {
          if (!exceedsDragThreshold(paint.origin, point)) {
            return;
          }
          paint.started = true;
          beginNoteDrag(paint.noteId, "paint", paint.origin);
        }
        dragNoteTo(point);
      },
      [beginNoteDrag, dragNoteTo]
    );

    const handlePointerUp = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const paint = paintRef.current;
        if (!paint) {
          return;
        }
        paintRef.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (paint.started) {
          commitNoteDrag();
        }
      },
      [commitNoteDrag]
    );

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(e);
        if (disabled || e.target !== e.currentTarget) {
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const [step, note] = defaultAddPosition();
          addNoteAt(step, note);
        }
      },
      [addNoteAt, defaultAddPosition, disabled, onKeyDown]
    );

    return (
      <div
        aria-colcount={domain.totalSteps}
        aria-label={ariaLabel || "Piano roll"}
        aria-labelledby={
          ariaLabelledBy || (ariaLabel ? undefined : `${elementId}-label`)
        }
        aria-multiselectable="true"
        aria-rowcount={domain.endNote - domain.startNote + 1}
        className={className}
        {...getDataAttributes("piano-roll", { disabled, part: "grid" })}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={trackRef}
        role="grid"
        style={{ position: "relative", touchAction: "none", ...style }}
        tabIndex={disabled ? -1 : 0}
        {...props}
      />
    );
  }

  export interface NotesProps {
    children: (note: Note, index: number) => React.ReactNode;
  }

  /** Renders in spatial order (start step, then pitch) rather than the value array's own order — that's what governs both Tab order and DOM paint order, so keyboard users move left-to-right through the timeline instead of hopping around in insertion order. */
  export function Notes({ children }: NotesProps) {
    const { value } = useValueContext();
    const ordered = React.useMemo(
      () =>
        [...value].sort((a, b) => a.startStep - b.startStep || a.note - b.note),
      [value]
    );
    return <>{ordered.map((note, index) => children(note, index))}</>;
  }

  export interface NoteProps
    extends Omit<React.ComponentProps<"div">, "children" | "id"> {
    children?: React.ReactNode;
    /** Identifies which value entry this part renders — not a DOM id. */
    id: Note["id"];
  }

  /** Every note gets `tabIndex={disabled ? -1 : 0}` rather than the roving -1/0 pattern the other primitives use: notes are a sparse, dynamically-sized collection (added and removed at runtime), not a fixed-size set where "the current one" is well-defined — so each note stays in the natural Tab order, like a list of individually removable items. */
  export function Note({
    id,
    className,
    children,
    "aria-describedby": ariaDescribedBy,
    ...props
  }: NoteProps) {
    const {
      beginNoteDrag,
      commitNoteDrag,
      disabled,
      domain,
      dragNoteTo,
      duplicateAndBeginDrag,
      elementId,
      nudgeNote,
      registerNote,
      removeNote,
      removeNoteOnly,
      resizeNoteBy,
      selectOnly,
      setFocusedId,
      shouldPreventFocusRef,
      toggleSelection,
    } = useConfigContext();
    const { focusedId, selectedIds, value } = useValueContext();
    const note = value.find((n) => n.id === id);

    const dragStateRef =
      React.useRef<
        Nullable<{ altKey: boolean; origin: Point; started: boolean }>
      >(null);

    const handlePointerDown = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (disabled) {
          return;
        }
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        shouldPreventFocusRef.current = true;
        setFocusedId(id);
        e.currentTarget.focus();
        if (e.shiftKey) {
          toggleSelection(id);
          return;
        }
        if (!(selectedIds.has(id) && selectedIds.size > 1)) {
          selectOnly(id);
        }
        dragStateRef.current = {
          altKey: e.altKey,
          origin: { x: e.clientX, y: e.clientY },
          started: false,
        };
      },
      [
        disabled,
        id,
        selectOnly,
        selectedIds,
        setFocusedId,
        shouldPreventFocusRef,
        toggleSelection,
      ]
    );

    const handlePointerMove = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragStateRef.current;
        if (!drag) {
          return;
        }
        const point = { x: e.clientX, y: e.clientY };
        if (!drag.started) {
          if (!exceedsDragThreshold(drag.origin, point)) {
            return;
          }
          drag.started = true;
          // Alt/Option+drag copies the note (or its selection group) and
          // drags the copy, leaving the originals in place;
          // duplicateAndBeginDrag handles both steps atomically (see its own
          // doc comment for why). If there was nothing to copy (e.g.
          // disabled mid-gesture), fall back to a normal move rather than
          // leaving the drag in a broken state.
          const duplicatedId = drag.altKey
            ? duplicateAndBeginDrag(id, drag.origin)
            : null;
          if (duplicatedId === null) {
            beginNoteDrag(id, "move", drag.origin);
          }
        }
        dragNoteTo(point);
      },
      [beginNoteDrag, dragNoteTo, duplicateAndBeginDrag, id]
    );

    const handlePointerUp = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragStateRef.current;
        if (!drag) {
          return;
        }
        dragStateRef.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (drag.started) {
          commitNoteDrag();
        }
      },
      [commitNoteDrag]
    );

    const handleDoubleClick = React.useCallback(
      (e: React.MouseEvent) => {
        if (disabled) {
          return;
        }
        e.stopPropagation();
        removeNoteOnly(id);
      },
      [disabled, id, removeNoteOnly]
    );

    const { keyboardProps } = useKeyboardNavigation({
      disabled,
      handlers: {
        onArrowDown: () => {
          nudgeNote(id, 0, -1);
          return true;
        },
        onArrowLeft: (e) => {
          if (e.shiftKey) {
            resizeNoteBy(id, -1);
          } else {
            nudgeNote(id, -1, 0);
          }
          return true;
        },
        onArrowRight: (e) => {
          if (e.shiftKey) {
            resizeNoteBy(id, 1);
          } else {
            nudgeNote(id, 1, 0);
          }
          return true;
        },
        onArrowUp: () => {
          nudgeNote(id, 0, 1);
          return true;
        },
      },
      onKeyDown: (e) => {
        if (disabled) {
          return;
        }
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          removeNote(id);
        }
      },
    });

    const handleFocus = React.useCallback(() => {
      if (shouldPreventFocusRef.current) {
        shouldPreventFocusRef.current = false;
      }
      setFocusedId(id);
    }, [id, setFocusedId, shouldPreventFocusRef]);

    const noteRef = React.useCallback(
      (node: Nullable<HTMLElement>) => registerNote(id, node),
      [id, registerNote]
    );

    if (!note) {
      return null;
    }

    const noteRange = domain.endNote - domain.startNote + 1;
    const isFocusTarget = id === focusedId;
    const isSelected = selectedIds.has(id);
    const noteName = getNoteName(note.note);
    const velocity = note.velocity ?? 1;
    const stepLabel = note.duration === 1 ? "step" : "steps";

    return (
      <div
        aria-colindex={note.startStep + 1}
        aria-colspan={note.duration}
        aria-describedby={ariaDescribedBy || `${elementId}-instructions`}
        aria-disabled={disabled}
        aria-label={`${noteName}, step ${note.startStep + 1}, ${note.duration} ${stepLabel} long`}
        aria-rowindex={domain.endNote - note.note + 1}
        aria-selected={isSelected}
        className={className}
        {...getDataAttributes("piano-roll", {
          disabled,
          focused: isFocusTarget,
          part: "note",
          selected: isSelected,
        })}
        onDoubleClick={handleDoubleClick}
        onFocus={handleFocus}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={noteRef}
        role="gridcell"
        style={{
          bottom: `${((note.note - domain.startNote) / noteRange) * 100}%`,
          height: `${100 / noteRange}%`,
          left: `${(note.startStep / domain.totalSteps) * 100}%`,
          opacity: 0.5 + velocity * 0.5,
          position: "absolute",
          width: `${(note.duration / domain.totalSteps) * 100}%`,
        }}
        tabIndex={disabled ? -1 : 0}
        {...keyboardProps}
        {...props}
      >
        <NoteContext.Provider value={note}>{children}</NoteContext.Provider>
      </div>
    );
  }

  export interface NoteHandleProps extends React.ComponentProps<"div"> {
    /** Dragging "end" (the default) keeps the note's start fixed and changes its duration; dragging "start" keeps the note's end fixed and trims from the front. */
    side?: "end" | "start";
  }

  /** An edge drag handle for resizing a note's duration. Keyboard users resize the end via Shift+ArrowLeft/Right on the Note itself, so this handle is a pointer-only affordance and stays out of the accessibility tree. */
  export function NoteHandle({
    className,
    side = "end",
    style,
    ...props
  }: NoteHandleProps) {
    const { beginNoteDrag, commitNoteDrag, disabled, dragNoteTo } =
      useConfigContext();
    const note = useNoteContext();
    const dragStateRef =
      React.useRef<Nullable<{ origin: Point; started: boolean }>>(null);

    const handlePointerDown = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (disabled) {
          return;
        }
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragStateRef.current = {
          origin: { x: e.clientX, y: e.clientY },
          started: false,
        };
      },
      [disabled]
    );

    const handlePointerMove = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragStateRef.current;
        if (!drag) {
          return;
        }
        const point = { x: e.clientX, y: e.clientY };
        if (!drag.started) {
          if (!exceedsDragThreshold(drag.origin, point)) {
            return;
          }
          drag.started = true;
          beginNoteDrag(
            note.id,
            side === "start" ? "resize-start" : "resize-end",
            drag.origin
          );
        }
        dragNoteTo(point);
      },
      [beginNoteDrag, dragNoteTo, note.id, side]
    );

    const handlePointerUp = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragStateRef.current;
        if (!drag) {
          return;
        }
        dragStateRef.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (drag.started) {
          commitNoteDrag();
        }
      },
      [commitNoteDrag]
    );

    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("piano-roll", {
          disabled,
          part: "note-handle",
          side,
        })}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ position: "absolute", ...style }}
        {...props}
      />
    );
  }

  export interface PlayheadProps extends React.ComponentProps<"div"> {}

  /** A purely decorative positioned marker. Playback position updates at animation-frame rate, far too fast for React state — pass a `ref` and mutate `style.left` imperatively from your own scheduling loop, the same way a consumer would drive any other high-frequency visualization. */
  export function Playhead({ className, style, ...props }: PlayheadProps) {
    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("piano-roll", { part: "playhead" })}
        style={{ pointerEvents: "none", position: "absolute", ...style }}
        {...props}
      />
    );
  }

  export interface KeysTrackProps extends React.ComponentProps<"div"> {}

  /** Wraps `Keys`/`Key` to own pointer capture for the strip — supports glissando (dragging across rows retriggers each key, the same way `Piano.Track` does horizontally) and multi-touch (each pointer independently tracks its own held key). */
  export function KeysTrack({ className, style, ...props }: KeysTrackProps) {
    const { disabled, keyPointerHandlers, keysTrackRef } = useConfigContext();
    return (
      <div
        className={className}
        {...getDataAttributes("piano-roll", { disabled, part: "keys-track" })}
        ref={keysTrackRef}
        style={{ position: "relative", touchAction: "none", ...style }}
        {...keyPointerHandlers}
        {...props}
      />
    );
  }

  export interface KeysProps {
    children: (note: number, color: "white" | "black") => React.ReactNode;
  }

  /** Iterates every semitone in the grid's pitch range, low to high — pairs with `Key` (inside `KeysTrack`) to build a vertical piano-key strip aligned row-for-row with `Notes`, the way a DAW's piano roll keeps a keyboard beside its timeline. */
  export function Keys({ children }: KeysProps) {
    const { domain } = useConfigContext();
    const notes = React.useMemo(() => {
      const list: number[] = [];
      for (let note = domain.startNote; note <= domain.endNote; note += 1) {
        list.push(note);
      }
      return list;
    }, [domain.startNote, domain.endNote]);
    return <>{notes.map((note) => children(note, getKeyColor(note)))}</>;
  }

  export interface KeyProps extends React.ComponentProps<"div"> {
    note: number;
  }

  /** A single row of the pitch-reference strip, positioned with the exact same bottom/height formula as `Note` so the two columns always align. Lights up (`data-active`) when pressed via `KeysTrack`'s pointer handling or listed in Root's `activeNotes`. */
  export function Key({ note, className, style, ...props }: KeyProps) {
    const { domain } = useConfigContext();
    const { activeKeySet } = useValueContext();
    const noteRange = domain.endNote - domain.startNote + 1;
    const color = getKeyColor(note);
    const isActive = activeKeySet.has(note);

    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("piano-roll", {
          active: isActive,
          color,
          part: "key",
        })}
        style={{
          bottom: `${((note - domain.startNote) / noteRange) * 100}%`,
          height: `${100 / noteRange}%`,
          left: 0,
          position: "absolute",
          right: 0,
          ...style,
        }}
        {...props}
      />
    );
  }
}
