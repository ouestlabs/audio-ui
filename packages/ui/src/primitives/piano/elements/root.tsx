import { createChangeEventDetails, isReleased } from "@audio-ui/core";
import { type KeyLayout, keyAt, placeKeys } from "@audio-ui/core/piano";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import {
  type NoteOffEventDetails,
  type NoteOnEventDetails,
  PianoContext,
  type PianoContextValue,
  type PianoState,
} from "../context";

/** The softest a pointer press plays: the very top of a key, not silence. */
const MIN_VELOCITY = 0.25;
/** Middle C: where the tab stop starts when the keyboard has it. */
const MIDDLE_C = 60;

function pitchRange(min: number, max: number): number[] {
  const pitches: number[] = [];
  for (let pitch = Math.round(min); pitch <= max; pitch += 1) {
    pitches.push(pitch);
  }
  return pitches;
}

interface HeldPointer {
  pitch: number;
  /** Whether its note on went through; a cancelled one has nothing to release. */
  sounding: boolean;
}

/**
 * A keyboard to play: every key sounds while pressed, by pointer or from the
 * keyboard. Dragging across the keys glides from one to the next, and each
 * pointer holds its own key, so chords can be played on a touch screen.
 *
 * It is laid out like a piano, or with `layout="even"` as one equal share per
 * key, the way a piano roll's rows are; `orientation="vertical"` puts the low
 * end at the bottom. The keys are one tab stop, walked with the arrow keys.
 * Renders a `<div>` element.
 */
export function Root(componentProps: Root.Props) {
  const {
    activeNotes,
    className,
    disabled = false,
    layout = "keyboard",
    maxPitch = 72,
    minPitch = 48,
    onNoteOff,
    onNoteOn,
    orientation = "horizontal",
    pitches: pitchesProp,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;

  const pitches = React.useMemo(
    () =>
      pitchesProp
        ? [...new Set(pitchesProp)].sort((a, b) => a - b)
        : pitchRange(minPitch, maxPitch),
    [maxPitch, minPitch, pitchesProp]
  );
  const keys = React.useMemo(
    () => placeKeys(pitches, layout),
    [layout, pitches]
  );
  const placements = React.useMemo(
    () => new Map(keys.map((key) => [key.pitch, key])),
    [keys]
  );

  const [pressed, setPressed] = React.useState<ReadonlySet<number>>(
    () => new Set()
  );
  const active = React.useMemo(
    () => new Set([...pressed, ...(activeNotes ?? [])]),
    [activeNotes, pressed]
  );

  const noteOn = React.useCallback(
    (pitch: number, eventDetails: NoteOnEventDetails) => {
      if (disabled) {
        return false;
      }
      onNoteOn?.(pitch, eventDetails);
      if (eventDetails.isCanceled) {
        return false;
      }
      setPressed((current) => new Set(current).add(pitch));
      return true;
    },
    [disabled, onNoteOn]
  );

  const noteOff = React.useCallback(
    (pitch: number, eventDetails: NoteOffEventDetails) => {
      setPressed((current) => {
        const next = new Set(current);
        next.delete(pitch);
        return next;
      });
      onNoteOff?.(pitch, eventDetails);
    },
    [onNoteOff]
  );

  const [focusedPitch, setFocusedPitch] = React.useState<number | null>(null);
  let tabStop = pitches.includes(MIDDLE_C) ? MIDDLE_C : pitches[0];
  if (focusedPitch !== null && placements.has(focusedPitch)) {
    tabStop = focusedPitch;
  }

  const keysRef = React.useRef(new Map<number, HTMLElement>());
  const registerKey = React.useCallback(
    (pitch: number, node: HTMLElement | null) => {
      if (node) {
        keysRef.current.set(pitch, node);
      } else {
        keysRef.current.delete(pitch);
      }
    },
    []
  );
  const focusKey = React.useCallback((pitch: number, focusVisible = true) => {
    setFocusedPitch(pitch);
    keysRef.current.get(pitch)?.focus({ focusVisible, preventScroll: true });
  }, []);

  const elementRef = React.useRef<HTMLDivElement>(null);
  const pointersRef = React.useRef(new Map<number, HeldPointer>());

  /** The key under the pointer and how hard it was struck, if there is a key. */
  const strikeAt = (event: React.PointerEvent) => {
    const rect = elementRef.current?.getBoundingClientRect();
    if (!(rect && rect.width > 0 && rect.height > 0)) {
      return null;
    }
    const vertical = orientation === "vertical";
    const along = vertical
      ? (rect.bottom - event.clientY) / rect.height
      : (event.clientX - rect.left) / rect.width;
    const across = vertical
      ? (event.clientX - rect.left) / rect.width
      : (event.clientY - rect.top) / rect.height;
    const key = keyAt(keys, along, across, layout);
    if (!key) {
      return null;
    }
    // Pressed near the free end of the key is harder, as on a real keyboard.
    const velocity = Math.min(
      1,
      Math.max(MIN_VELOCITY, MIN_VELOCITY + (1 - MIN_VELOCITY) * across)
    );
    return { pitch: key.pitch, velocity };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) {
      return;
    }
    const strike = strikeAt(event);
    if (strike === null) {
      return;
    }
    const { pitch, velocity } = strike;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    focusKey(pitch, false);
    const sounding = noteOn(
      pitch,
      Object.assign(createChangeEventDetails("press", event.nativeEvent), {
        velocity,
      })
    );
    pointersRef.current.set(event.pointerId, { pitch, sounding });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const held = pointersRef.current.get(event.pointerId);
    if (held && isReleased(event)) {
      handlePointerEnd(event);
      return;
    }
    const strike = held ? strikeAt(event) : null;
    if (!held || strike === null || strike.pitch === held.pitch) {
      return;
    }
    const { pitch, velocity } = strike;
    if (held.sounding) {
      noteOff(held.pitch, { event: event.nativeEvent, reason: "glide" });
    }
    focusKey(pitch, false);
    const sounding = noteOn(
      pitch,
      Object.assign(createChangeEventDetails("glide", event.nativeEvent), {
        velocity,
      })
    );
    pointersRef.current.set(event.pointerId, { pitch, sounding });
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const held = pointersRef.current.get(event.pointerId);
    if (!held) {
      return;
    }
    pointersRef.current.delete(event.pointerId);
    if (held.sounding) {
      noteOff(held.pitch, { event: event.nativeEvent, reason: "press" });
    }
  };

  const state = React.useMemo<Root.State>(
    () => ({ disabled, layout, orientation }),
    [disabled, layout, orientation]
  );

  const context = React.useMemo<PianoContextValue>(
    () => ({
      actions: {
        focusKey,
        noteOff,
        noteOn,
        registerKey,
        setTabStop: setFocusedPitch,
      },
      meta: { active, pitches, placements, tabStop },
      state,
    }),
    [
      active,
      focusKey,
      noteOff,
      noteOn,
      pitches,
      placements,
      registerKey,
      state,
      tabStop,
    ]
  );

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        onLostPointerCapture: handlePointerEnd,
        onPointerCancel: handlePointerEnd,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerEnd,
        role: "group",
        style: { position: "relative", touchAction: "none" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, elementRef] : elementRef,
    render,
    state,
  });

  return <PianoContext value={context}>{element}</PianoContext>;
}

export namespace Root {
  export type State = PianoState;
  export type Layout = KeyLayout;
  export type NoteOnEventReason = NoteOnEventDetails["reason"];
  export type NoteOnEventDetails = import("../context").NoteOnEventDetails;
  export type NoteOffEventDetails = import("../context").NoteOffEventDetails;

  export interface Props extends PartProps<"div", State> {
    /** Pitches lit from elsewhere, such as a MIDI input or a sequencer, on top of the keys pressed here. */
    activeNotes?: readonly number[];
    disabled?: boolean;
    /** How the keys share the length: like a piano, or one equal share each. @default "keyboard" */
    layout?: Layout;
    /** Highest MIDI pitch, inclusive. @default 72 */
    maxPitch?: number;
    /** Lowest MIDI pitch, inclusive: 60 is middle C. @default 48 */
    minPitch?: number;
    /** Fires when a key is released, the pointer glides off it, or it loses focus while held. */
    onNoteOff?: (pitch: number, eventDetails: NoteOffEventDetails) => void;
    /** Fires when a key is pressed or glided onto. `eventDetails.cancel()` keeps it silent. */
    onNoteOn?: (pitch: number, eventDetails: NoteOnEventDetails) => void;
    /** @default "horizontal" */
    orientation?: "horizontal" | "vertical";
    /** Only these pitches, in place of `minPitch`…`maxPitch`. */
    pitches?: readonly number[];
  }
}
