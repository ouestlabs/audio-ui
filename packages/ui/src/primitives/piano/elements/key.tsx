import * as React from "react";
import { createChangeEventDetails } from "../../internal/event-details";
import { type PartProps, resolveStyling } from "../../internal/part";
import { pitchName } from "../../internal/pitch";
import { mergeProps, useRender } from "../../internal/render";
import {
  KEYBOARD_VELOCITY,
  KeyContext,
  type PianoState,
  usePianoContext,
} from "../context";

/** One octave: what Shift + an arrow key, Page Up and Page Down move by. */
const OCTAVE = 12;

/** Where the arrow, Page and Home/End keys take the focus, as an index into the keys. */
function keyTargets(
  index: number,
  last: number,
  shiftKey: boolean
): Record<string, number> {
  const step = shiftKey ? OCTAVE : 1;
  return {
    ArrowDown: index - step,
    ArrowLeft: index - step,
    ArrowRight: index + step,
    ArrowUp: index + step,
    End: last,
    Home: 0,
    PageDown: index - OCTAVE,
    PageUp: index + OCTAVE,
  };
}

/**
 * One key, placed along the keyboard for its pitch. It sounds while pressed:
 * by pointer through the keyboard, or with Enter or Space while focused. Its
 * accessible name defaults to the pitch, such as "C4". Renders a `<button>`
 * element.
 */
export function Key(componentProps: Key.Props) {
  const { className, pitch, ref, render, style, ...elementProps } =
    componentProps;
  const { actions, meta, state: rootState } = usePianoContext("Key");
  const { disabled, orientation } = rootState;
  const placement = meta.placements.get(pitch);
  // Whether Enter or Space is holding this key down.
  const heldRef = React.useRef<boolean>(false);

  const keyRef = React.useCallback(
    (node: HTMLElement | null) => actions.registerKey(pitch, node),
    [actions, pitch]
  );

  const release = (event: FocusEvent | KeyboardEvent) => {
    if (heldRef.current) {
      heldRef.current = false;
      actions.noteOff(pitch, { event, reason: "keyboard" });
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!(event.repeat || heldRef.current)) {
        heldRef.current = actions.noteOn(
          pitch,
          Object.assign(
            createChangeEventDetails("keyboard", event.nativeEvent),
            {
              velocity: KEYBOARD_VELOCITY,
            }
          )
        );
      }
      return;
    }
    const index = meta.pitches.indexOf(pitch);
    const last = meta.pitches.length - 1;
    const target = keyTargets(index, last, event.shiftKey)[event.key];
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    const next = meta.pitches[Math.min(last, Math.max(0, target))];
    if (next !== undefined) {
      actions.focusKey(next);
    }
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      release(event.nativeEvent);
    }
  };

  const state = React.useMemo<Key.State>(
    () => ({
      active: meta.active.has(pitch),
      color: placement?.black ? "black" : "white",
      disabled,
      orientation,
    }),
    [disabled, meta.active, orientation, pitch, placement]
  );

  const start = `${(placement?.start ?? 0) * 100}%`;
  const size = `${(placement?.size ?? 0) * 100}%`;
  const element = useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        "aria-label": pitchName(pitch),
        disabled,
        onBlur: (event) => release(event.nativeEvent),
        onFocus: () => actions.setTabStop(pitch),
        onKeyDown: handleKeyDown,
        onKeyUp: handleKeyUp,
        style:
          orientation === "vertical"
            ? { bottom: start, height: size, position: "absolute" }
            : { left: start, position: "absolute", width: size },
        tabIndex: pitch === meta.tabStop ? 0 : -1,
        type: "button",
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, keyRef] : keyRef,
    render,
    state,
  });

  return <KeyContext value={pitch}>{element}</KeyContext>;
}

export namespace Key {
  export type State = {
    /** Whether the key is sounding: pressed here, or listed in `activeNotes`. */
    active: boolean;
    color: "black" | "white";
    disabled: boolean;
    orientation: PianoState["orientation"];
  };
  export interface Props extends PartProps<"button", State> {
    /** The MIDI pitch this key plays. */
    pitch: number;
  }
}
