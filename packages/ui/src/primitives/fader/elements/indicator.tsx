import { Slider } from "@base-ui/react/slider";
import * as React from "react";
import { clamp } from "../../../utils";
import { useFaderContext } from "../context";

/**
 * The filled part of the track: from `min` up to the value, or between the
 * Root's `anchor` and the value, on whichever side of it the value is.
 * Renders a `<div>` element.
 */
export function Indicator({ render, ...props }: Indicator.Props) {
  const { anchor, max, min, orientation, value } = useFaderContext("Indicator");
  const renderAnchored = React.useCallback<
    Exclude<Indicator.Props["render"], React.ReactElement | undefined>
  >(
    (renderProps, state) => {
      const share = (at: number) =>
        clamp(((at - min) / (max - min || 1)) * 100, 0, 100);
      const from = share(Math.min(anchor ?? min, value));
      const to = share(Math.max(anchor ?? min, value));
      const placed: React.CSSProperties =
        orientation === "vertical"
          ? { bottom: `${from}%`, height: `${to - from}%` }
          : { insetInlineStart: `${from}%`, width: `${to - from}%` };
      const anchored = {
        ...renderProps,
        style: { ...renderProps.style, ...placed },
      };
      if (typeof render === "function") {
        return render(anchored, state);
      }
      return render ? (
        React.cloneElement(render, anchored)
      ) : (
        <div {...anchored} />
      );
    },
    [anchor, max, min, orientation, render, value]
  );
  return (
    <Slider.Indicator
      render={anchor === undefined ? render : renderAnchored}
      {...props}
    />
  );
}

export namespace Indicator {
  export type Props = Slider.Indicator.Props;
  export type State = Slider.Indicator.State;
}
