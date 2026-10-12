import {
  createPianoController,
  type KeyLayout,
  type PianoOptions,
} from "@audio-ui/core/piano";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import {
  type NoteOnEventDetails,
  PianoContext,
  type PianoContextValue,
  type PianoState,
} from "../context.js";

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
    pitches,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;

  const options: PianoOptions = {
    activeNotes,
    disabled,
    layout,
    maxPitch,
    minPitch,
    onNoteOff,
    onNoteOn,
    orientation,
    pitches,
  };
  const [controller] = React.useState(() => createPianoController(options));
  // Set on every render, so the keyboard always reads the latest props.
  controller.setOptions(options);
  const snapshot = React.useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot
  );

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
  const focusKey = React.useCallback(
    (pitch: number, focusVisible = true) => {
      controller.focusKey(pitch);
      keysRef.current.get(pitch)?.focus({ focusVisible, preventScroll: true });
    },
    [controller]
  );

  const elementRef = React.useRef<HTMLDivElement>(null);
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    controller.press(event.nativeEvent, event.currentTarget);
  };

  const state = React.useMemo<Root.State>(
    () => ({ disabled: snapshot.disabled, layout, orientation }),
    [layout, orientation, snapshot.disabled]
  );

  const context = React.useMemo<PianoContextValue>(
    () => ({
      controller,
      focusKey,
      meta: {
        active: snapshot.active,
        pitches: snapshot.pitches,
        placements: snapshot.placements,
        tabStop: snapshot.tabStop,
      },
      registerKey,
      state,
    }),
    [controller, focusKey, registerKey, snapshot, state]
  );

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        onPointerDown: handlePointerDown,
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
  export type NoteOnEventDetails = import("../context.js").NoteOnEventDetails;
  export type NoteOffEventDetails = import("../context.js").NoteOffEventDetails;

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
