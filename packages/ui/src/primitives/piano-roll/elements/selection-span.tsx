import { selectionSpan } from "@audio-ui/core/piano-roll";
import type * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { placedOver } from "../../timeline/context.ts";
import {
  type PianoRollState,
  usePianoRollContext,
  useRollView,
} from "../context.ts";

const sameSpan = (
  a: { end: number; start: number } | null,
  b: { end: number; start: number } | null
) => a?.start === b?.start && a?.end === b?.end;

/**
 * The time the selected notes cover, from the earliest start to the latest
 * end, as a band from top to bottom of what it sits in: the grid, the
 * velocity lane or the ruler. Renders nothing with no note selected. It lets
 * presses through, all but its `PianoRoll.StretchHandle`s, and is hidden from
 * assistive technology. Renders a `<div>` element.
 */
export function SelectionSpan(componentProps: SelectionSpan.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { state } = usePianoRollContext("SelectionSpan");
  const span = useRollView(
    "SelectionSpan",
    (view) => selectionSpan(view.notes, view.selection),
    sameSpan
  );
  return useRender({
    defaultTagName: "div",
    enabled: span !== null,
    props: mergeProps<"div">(
      {
        "aria-hidden": true,
        style: {
          ...(span ? placedOver(span.start, span.end - span.start) : {}),
          bottom: 0,
          pointerEvents: "none",
          position: "absolute",
          top: 0,
        },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace SelectionSpan {
  export type State = PianoRollState;
  export type Props = PartProps<"div", State>;
}

/**
 * One edge of the selection's span, for its `SelectionSpan`: a drag stretches
 * the selected notes in time from the other edge, on the grid unless Cmd/Ctrl
 * is held. The Notes edits that double and halve lengths do the same from the
 * keyboard, so it is hidden from assistive technology. Renders a `<div>`
 * element.
 */
export function StretchHandle(componentProps: StretchHandle.Props) {
  const { className, edge, ref, render, style, ...elementProps } =
    componentProps;
  const {
    controller,
    gridRef,
    state: rollState,
  } = usePianoRollContext("StretchHandle");
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const grid = gridRef.current;
    if (grid) {
      event.stopPropagation();
      controller.pressStretch(
        edge,
        event.nativeEvent,
        event.currentTarget,
        grid
      );
    }
  };
  const state = { ...rollState, edge };
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        "aria-hidden": true,
        onPointerDown: handlePointerDown,
        style: {
          [edge === "start" ? "left" : "right"]: 0,
          bottom: 0,
          pointerEvents: "auto",
          position: "absolute",
          top: 0,
          touchAction: "none",
        },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace StretchHandle {
  export type State = PianoRollState & {
    /** The edge of the span this handle drags. */
    edge: "end" | "start";
  };
  export interface Props extends PartProps<"div", State> {
    /** The edge of the span this handle drags; the other stays put. */
    edge: "end" | "start";
  }
}
