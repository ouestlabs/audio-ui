import { Slider } from "@base-ui/react/slider";
import * as React from "react";
import { useFaderContext } from "../context";

/**
 * The interactive area: pointer presses and drags, plus mouse-wheel stepping.
 * Sets `touch-action: none` so touch drags don't scroll the page.
 * Renders a `<div>` element.
 */
export function Control({ ref, style, ...props }: Control.Props) {
  const { disabled, reset, wheelRef } = useFaderContext("Control");
  const setRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      wheelRef(node);
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref, wheelRef]
  );
  const controlStyle: Control.Props["style"] =
    typeof style === "function"
      ? (state) => ({ touchAction: "none", ...style(state) })
      : { touchAction: "none", ...style };

  // A double click, an Alt + click or the Delete key return to the default, as in a DAW.
  const handleDoubleClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!disabled) {
        reset(event.nativeEvent);
      }
    },
    [disabled, reset]
  );
  const handlePointerDownCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.altKey && event.button === 0 && !disabled) {
        event.preventDefault();
        event.stopPropagation();
        reset(event.nativeEvent);
      }
    },
    [disabled, reset]
  );
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!disabled && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        reset(event.nativeEvent);
      }
    },
    [disabled, reset]
  );

  return (
    <Slider.Control
      {...props}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onPointerDownCapture={handlePointerDownCapture}
      ref={setRef}
      style={controlStyle}
    />
  );
}

export namespace Control {
  export type Props = Slider.Control.Props & {
    ref?: React.Ref<HTMLDivElement>;
  };
  export type State = Slider.Control.State;
}
