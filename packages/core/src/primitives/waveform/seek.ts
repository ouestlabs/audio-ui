import { followPointer } from "../../dom/gesture";
import { clampFinite, clampUnit } from "../../shared/math";
import {
  type ChangeEventDetails,
  type CommitEventDetails,
  createChangeEventDetails,
} from "../../value/events";
import type { Source } from "../../value/source";
import { createStore, type Store } from "../../value/store";

export type WaveformSeekChangeEventDetails =
  | ChangeEventDetails<"press" | "drag", PointerEvent>
  | ChangeEventDetails<"keyboard", KeyboardEvent>
  | ChangeEventDetails<"input-change", Event>;
export type WaveformSeekCommitEventDetails =
  | CommitEventDetails<"press" | "drag", PointerEvent>
  | CommitEventDetails<"keyboard", KeyboardEvent>
  | CommitEventDetails<"input-change", Event>;

/** A stretch selected by dragging across the waveform with Shift held. */
export type WaveformSelectionChangeEventDetails = ChangeEventDetails<
  "drag",
  PointerEvent
>;
export type WaveformSelectionCommitEventDetails = CommitEventDetails<
  "drag",
  PointerEvent
>;

export interface WaveformSeekOptions {
  /** Uncontrolled starting position. @default 0 */
  defaultValue?: number;
  disabled?: boolean;
  /** Length of the audio, in the unit the position is in. */
  duration: number;
  /** Step for Page Up/Page Down and Shift + arrow keys. */
  largeStep: number;
  /** Whether the audio is still on its way: there is nothing to seek yet. */
  loading?: boolean;
  onValueChange?: (
    value: number,
    details: WaveformSeekChangeEventDetails
  ) => void;
  onValueCommitted?: (
    value: number,
    details: WaveformSeekCommitEventDetails
  ) => void;
  /** The stretch of the audio shown, `[start, end]` in `duration` units. */
  range: readonly [number, number];
  /** A live position, followed without a render: it takes precedence over `value`. */
  source?: Source<number>;
  /** Step for the arrow keys. */
  step: number;
  /** The controlled position, from 0 to `duration`. */
  value?: number;
}

/** Listens to the stretch a Shift + drag selects: set by the control that is dragged on. */
export interface WaveformSelectionHandlers {
  onSelectionChange?: (
    range: readonly [number, number],
    details: WaveformSelectionChangeEventDetails
  ) => void;
  onSelectionCommitted?: (
    range: readonly [number, number],
    details: WaveformSelectionCommitEventDetails
  ) => void;
}

/** What a view draws a seekable waveform from. */
export interface WaveformSeekSnapshot {
  disabled: boolean;
  /** Whether a pointer is scrubbing or selecting. */
  dragging: boolean;
  duration: number;
  largeStep: number;
  loading: boolean;
  range: readonly [number, number];
  step: number;
  /** The position as displayed: the scrubbed one while a pointer moves it. */
  value: number;
}

export interface WaveformSeekController {
  /** The value at `share` of the way across the shown stretch. */
  atShare: (share: number) => number;
  getSnapshot: () => WaveformSeekSnapshot;
  /** The position under the pointer while it hovers, in `duration` units, or null. */
  hover: Store<number | null>;
  /** Sets the hover from a pointer over `element`. */
  hoverAt: (clientX: number, element: Element) => void;
  /** Handles a key on the seekable surface's input. Returns whether the key was the seek's. */
  keyDown: (event: KeyboardEvent) => boolean;
  /** The pointer left the surface: the hover goes. */
  leave: () => void;
  /**
   * Starts a press on `element`: a press seeks, a drag scrubs; with Shift held
   * and a selection listener, a drag selects a stretch instead.
   */
  pressSeek: (event: PointerEvent, element: Element) => void;
  setOptions: (options: WaveformSeekOptions) => void;
  /** Takes the selection listeners of the control dragged on; call it whenever they may have changed. */
  setSelection: (handlers: WaveformSelectionHandlers) => void;
  subscribe: (listener: () => void) => () => void;
  /** How far across the shown stretch `value` is: 0 at its start, 1 at its end. */
  toShare: (value: number) => number;
  /** Sets the position from an input, reporting an `"input-change"` change and commit. */
  typeAt: (value: number, event: Event) => void;
}

/** One seek gesture, from press to release. */
interface SeekGesture {
  /** Whether the gesture moved the position at least once; if so its end commits. */
  changed: boolean;
  /** Whether the pointer moved after the press: the commit reason is "drag", else "press". */
  moved: boolean;
}

/** One selection gesture, from press to release. */
interface SelectGesture {
  anchor: number;
  changed: boolean;
}

/**
 * A seekable waveform's behavior with no view attached: its position, held,
 * controlled or live, every way of moving it, and the stretch selected.
 */
export function createWaveformController(
  initial: WaveformSeekOptions
): WaveformSeekController {
  let options = initial;
  let selection: WaveformSelectionHandlers = {};
  const hover = createStore<number | null>(null);

  // Held by the waveform, unless `value` or a live `source` is given.
  let uncontrolled: number | undefined;
  // The position as the gesture under way left it: a controlled position that
  // lags behind must not pull the waveform back mid-drag.
  let latest: number | null = null;
  let dragging = false;
  let seek: SeekGesture | null = null;
  let selecting: SelectGesture | null = null;
  let selected: readonly [number, number] | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const clampToDuration = (value: number) =>
    clampFinite(value, 0, options.duration);
  /** The position the props, the state or the live source hold. */
  const held = (): number =>
    clampToDuration(
      options.source
        ? options.source.getSnapshot()
        : (options.value ?? uncontrolled ?? options.defaultValue ?? 0)
    );
  /** The position as the gesture under way left it. */
  const current = (): number => latest ?? held();
  const inert = () => (options.disabled ?? false) || (options.loading ?? false);

  const toShare = (value: number) => {
    const [start, end] = options.range;
    return end > start ? (value - start) / (end - start) : 0;
  };
  const atShare = (share: number) => {
    const [start, end] = options.range;
    return start + share * (end - start);
  };
  const valueAt = (element: Element, clientX: number) => {
    const rect = element.getBoundingClientRect();
    return atShare(clampUnit((clientX - rect.left) / Math.max(rect.width, 1)));
  };

  let snapshot: WaveformSeekSnapshot | null = null;
  const getSnapshot = (): WaveformSeekSnapshot => {
    const value = dragging && latest !== null ? latest : held();
    const disabled = options.disabled ?? false;
    const loading = options.loading ?? false;
    const { range, duration, step, largeStep } = options;
    if (
      snapshot &&
      snapshot.value === value &&
      snapshot.dragging === dragging &&
      snapshot.disabled === disabled &&
      snapshot.loading === loading &&
      snapshot.duration === duration &&
      snapshot.step === step &&
      snapshot.largeStep === largeStep &&
      snapshot.range[0] === range[0] &&
      snapshot.range[1] === range[1]
    ) {
      return snapshot;
    }
    snapshot = {
      disabled,
      dragging,
      duration,
      largeStep,
      loading,
      range,
      step,
      value,
    };
    return snapshot;
  };

  /** Clamps and proposes a position; keeps it unless canceled. Returns whether it was applied. */
  const change = (
    raw: number,
    details: WaveformSeekChangeEventDetails
  ): boolean => {
    const next = clampToDuration(raw);
    if (next === current()) {
      return false;
    }
    options.onValueChange?.(next, details);
    if (details.isCanceled) {
      return false;
    }
    latest = next;
    if (options.value === undefined && !options.source) {
      uncontrolled = next;
    }
    notify();
    return true;
  };

  const commit = (value: number, details: WaveformSeekCommitEventDetails) => {
    options.onValueCommitted?.(value, details);
  };

  const finishSeek = (end: PointerEvent) => {
    const finished = seek;
    seek = null;
    // Read before settling: the position falls back to the known value after.
    const committed = current();
    dragging = false;
    latest = null;
    notify();
    if (finished?.changed) {
      commit(committed, {
        event: end,
        reason: finished.moved ? "drag" : "press",
      } as WaveformSeekCommitEventDetails);
    }
  };

  const startSelection = (event: PointerEvent, element: Element) => {
    const gesture: SelectGesture = {
      anchor: valueAt(element, event.clientX),
      changed: false,
    };
    selecting = gesture;
    selected = null;
    dragging = true;
    notify();
    followPointer(
      element,
      event.pointerId,
      (move) => {
        if (!selecting) {
          return;
        }
        const at = valueAt(element, move.clientX);
        const range = [
          Math.min(gesture.anchor, at),
          Math.max(gesture.anchor, at),
        ] as const;
        const details = createChangeEventDetails("drag", move);
        selection.onSelectionChange?.(range, details);
        if (!details.isCanceled) {
          gesture.changed = true;
          selected = range;
        }
      },
      (end) => {
        const finished = selecting;
        selecting = null;
        dragging = false;
        notify();
        if (finished?.changed && selected) {
          selection.onSelectionCommitted?.(selected, {
            event: end,
            reason: "drag",
          });
        }
      }
    );
  };

  const pressSeek: WaveformSeekController["pressSeek"] = (event, element) => {
    if (inert() || event.button !== 0) {
      return;
    }
    element.setPointerCapture?.(event.pointerId);
    // Shift selects a stretch, as in an audio editor; a plain press seeks.
    if (event.shiftKey && selection.onSelectionChange) {
      startSelection(event, element);
      return;
    }
    const gesture: SeekGesture = { changed: false, moved: false };
    seek = gesture;
    dragging = true;
    notify();
    gesture.changed = change(
      valueAt(element, event.clientX),
      createChangeEventDetails("press", event)
    );
    followPointer(
      element,
      event.pointerId,
      (move) => {
        if (!seek) {
          return;
        }
        gesture.moved = true;
        if (
          change(
            valueAt(element, move.clientX),
            createChangeEventDetails("drag", move)
          )
        ) {
          gesture.changed = true;
        }
      },
      finishSeek
    );
  };

  const keyDown: WaveformSeekController["keyDown"] = (event) => {
    if (inert()) {
      return false;
    }
    const now = current();
    const [start, end] = options.range;
    const arrowStep = event.shiftKey ? options.largeStep : options.step;
    const targets: Record<string, number> = {
      ArrowDown: now - arrowStep,
      ArrowLeft: now - arrowStep,
      ArrowRight: now + arrowStep,
      ArrowUp: now + arrowStep,
      End: end,
      Home: start,
      PageDown: now - options.largeStep,
      PageUp: now + options.largeStep,
    };
    const target = targets[event.key];
    if (target === undefined) {
      return false;
    }
    // The keys move within the stretch shown.
    const next = Math.min(end, Math.max(start, target));
    if (change(next, createChangeEventDetails("keyboard", event))) {
      commit(current(), {
        event,
        reason: "keyboard",
      } as WaveformSeekCommitEventDetails);
    }
    return true;
  };

  const typeAt: WaveformSeekController["typeAt"] = (value, event) => {
    if (inert()) {
      return;
    }
    if (change(value, createChangeEventDetails("input-change", event))) {
      commit(current(), {
        event,
        reason: "input-change",
      } as WaveformSeekCommitEventDetails);
    }
  };

  return {
    atShare,
    getSnapshot,
    hover,
    hoverAt: (clientX, element) => {
      if (inert()) {
        return;
      }
      hover.set(valueAt(element, clientX));
    },
    keyDown,
    leave: () => {
      hover.set(null);
    },
    pressSeek,
    setSelection: (handlers) => {
      selection = handlers;
    },
    setOptions: (next) => {
      options = next;
      // The props take over again on every render, unless a drag is under way.
      if (!dragging) {
        latest = null;
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    toShare,
    typeAt,
  };
}
