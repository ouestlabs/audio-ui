import { pitchName } from "@audio-ui/core";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { KeyContext, type PianoState, usePianoContext } from "../context.ts";

/**
 * One key, placed along the keyboard for its pitch. It sounds while pressed:
 * by pointer through the keyboard, or with Enter or Space while focused. Its
 * accessible name defaults to the pitch, such as "C4". Renders a `<button>`
 * element.
 */
export function Key(componentProps: Key.Props) {
  const { className, pitch, ref, render, style, ...elementProps } =
    componentProps;
  const {
    controller,
    focusKey,
    meta,
    registerKey,
    state: rootState,
  } = usePianoContext("Key");
  const { disabled, orientation } = rootState;
  const placement = meta.placements.get(pitch);

  const keyRef = React.useCallback(
    (node: HTMLElement | null) => registerKey(pitch, node),
    [pitch, registerKey]
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      controller.keyOn(pitch, event.nativeEvent);
      return;
    }
    const next = controller.navigate(pitch, event.nativeEvent);
    if (next !== null) {
      event.preventDefault();
      focusKey(next);
    }
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      controller.keyOff(pitch, event.nativeEvent);
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
        onBlur: (event) => controller.keyOff(pitch, event.nativeEvent),
        onFocus: () => controller.focusKey(pitch),
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
