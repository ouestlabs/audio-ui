import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { STATE_ATTRIBUTES_MAPPING, useEnvelopeContext } from "../context";
import type { Root } from "./root";

/**
 * The drawing surface, a 100×100 stretched viewBox: holds `Line` and `Fill`,
 * and a double click on it adds a point. With Alt held, dragging a segment
 * bends it and a double click straightens it, as in a DAW's automation lane.
 * Carries `data-blocked` briefly when adding is refused at `maxPoints`.
 * Renders an `<svg>` element.
 */
export function Graph(componentProps: Graph.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { addPoint, controller, graphRef, snapshot, state } =
    useEnvelopeContext("Graph");
  const graphState = React.useMemo<Graph.State>(
    () => ({ ...state, blocked: snapshot.isAddBlocked }),
    [snapshot.isAddBlocked, state]
  );

  // The point under the pointer, as 0…1 of the graph's box, or null while it has no size.
  const pointOf = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: 1 - (event.clientY - rect.top) / rect.height,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (state.disabled || !event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    controller.pressBend(event.nativeEvent, event.currentTarget);
  };

  const handleDoubleClick = (event: React.MouseEvent<SVGSVGElement>) => {
    const at = pointOf(event);
    if (!at) {
      return;
    }
    if (event.altKey) {
      controller.straightenAt(at, event.nativeEvent);
      return;
    }
    addPoint(at, event.nativeEvent);
  };

  return useRender({
    defaultTagName: "svg",
    props: mergeProps<"svg">(
      {
        "aria-hidden": true,
        onDoubleClick: handleDoubleClick,
        onPointerDown: handlePointerDown,
        preserveAspectRatio: "none",
        viewBox: "0 0 100 100",
      },
      { ...elementProps, ...resolveStyling(className, style, graphState) }
    ),
    ref: ref ? [ref, graphRef] : graphRef,
    render,
    state: graphState,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Graph {
  export type State = Root.State & {
    /** Briefly true after an add was refused at `maxPoints`. */
    blocked: boolean;
  };
  export type Props = PartProps<"svg", State>;
}
