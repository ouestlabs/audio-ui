import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { LaneContext, useLaneProps } from "../../timeline/elements/lane";
import { type PianoRollState, usePianoRollContext } from "../context";

/**
 * The surface notes are drawn on: a timeline lane, with the roll's rows
 * stacked down it. A press on empty grid draws a note (`mode="draw"`), whose
 * end then follows the pointer, or starts a selection rectangle, Shift adding
 * to what is selected; in that mode a double-click draws. Focused, Enter adds
 * a note at the playback position, Escape clears the selection and Cmd/Ctrl+A
 * selects every note. From the grid or a note, Cmd/Ctrl+D repeats the
 * selection right after itself, Cmd/Ctrl+C, X and V copy, cut and paste at the
 * playback position, and Q snaps the starts of the selection (every note, with
 * none selected) to the grid. Renders a `<div>` element.
 */
export function Grid(componentProps: Grid.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { controller, gridRef, state } = usePianoRollContext("Grid");
  const { lane, laneRef, style: laneStyle } = useLaneProps("Lane");

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || state.disabled) {
      return;
    }
    const element = event.currentTarget;
    event.preventDefault();
    element.focus({ focusVisible: false, preventScroll: true });
    controller.pressGrid(event.nativeEvent, element);
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    controller.doubleClickGrid(event.nativeEvent, event.currentTarget);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (state.disabled) {
      return;
    }
    const native = event.nativeEvent;
    if (controller.keyGrid(native)) {
      event.preventDefault();
      return;
    }
    if (event.key !== "Enter" || event.target !== event.currentTarget) {
      return;
    }
    event.preventDefault();
    controller.addAtPlayback(native);
  };

  const gridCallback = React.useCallback(
    (node: HTMLElement | null) => {
      gridRef.current = node;
      laneRef(node);
    },
    [gridRef, laneRef]
  );

  const rendered = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        onDoubleClick: handleDoubleClick,
        onKeyDown: handleKeyDown,
        onPointerDown: handlePointerDown,
        role: "group",
        style: { ...laneStyle, touchAction: "none" },
        tabIndex: state.disabled ? -1 : 0,
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, gridCallback] : gridCallback,
    render,
    state,
  });

  return <LaneContext value={lane}>{rendered}</LaneContext>;
}

export namespace Grid {
  export type State = PianoRollState;
  export type Props = PartProps<"div", State>;
  export type ChangeEventDetails = import("../context").ValueChangeEventDetails;
  export type SelectionChangeEventDetails =
    import("../context").SelectionChangeEventDetails;
}
