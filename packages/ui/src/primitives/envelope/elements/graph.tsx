import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { STATE_ATTRIBUTES_MAPPING, useEnvelopeContext } from "../context";
import { snapTo } from "../internal/geometry";
import type { Root } from "./root";

/**
 * The drawing surface, a 100×100 stretched viewBox: holds `Line` and `Fill`,
 * and a double click on it adds a point. Carries `data-blocked` briefly when
 * adding is refused at `maxPoints`. Renders an `<svg>` element.
 */
export function Graph(componentProps: Graph.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { actions, meta, state } = useEnvelopeContext("Graph");
  const graphState = React.useMemo<Graph.State>(
    () => ({ ...state, blocked: meta.isAddBlocked }),
    [meta.isAddBlocked, state]
  );

  const handleDoubleClick = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    const free = event.metaKey || event.ctrlKey;
    const step = free ? 0 : meta.snap;
    actions.addPoint(
      {
        x: snapTo((event.clientX - rect.left) / rect.width, step),
        y: snapTo(1 - (event.clientY - rect.top) / rect.height, step),
      },
      event.nativeEvent
    );
  };

  return useRender({
    defaultTagName: "svg",
    props: mergeProps<"svg">(
      {
        "aria-hidden": true,
        onDoubleClick: handleDoubleClick,
        preserveAspectRatio: "none",
        viewBox: "0 0 100 100",
      },
      { ...elementProps, ...resolveStyling(className, style, graphState) }
    ),
    ref: ref ? [ref, meta.graphRef] : meta.graphRef,
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
