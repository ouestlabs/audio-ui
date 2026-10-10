import { Slider } from "@base-ui/react/slider";
import * as React from "react";
import { useFaderContext } from "../context";

/**
 * The interactive area: pointer presses and drags, plus mouse-wheel stepping.
 * Sets `touch-action: none` so touch drags don't scroll the page.
 * Renders a `<div>` element.
 */
export function Control({ ref, style, ...props }: Control.Props) {
  const { wheelRef } = useFaderContext("Control");
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

  return <Slider.Control {...props} ref={setRef} style={controlStyle} />;
}

export namespace Control {
  export type Props = Slider.Control.Props & {
    ref?: React.Ref<HTMLDivElement>;
  };
  export type State = Slider.Control.State;
}
