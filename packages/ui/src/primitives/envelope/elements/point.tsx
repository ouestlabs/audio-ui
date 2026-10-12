import type { Point as GeomPoint } from "@audio-ui/core";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import { STATE_ATTRIBUTES_MAPPING, useEnvelopeContext } from "../context.js";
import type { Root } from "./root.js";

/**
 * A draggable handle for the point at `index`, positioned with `left`/`bottom`
 * percentages over the `Graph`. It is a `role="slider"` on the point's level
 * (`y`): give it an `aria-label`. One point at a time is the tab stop; arrow
 * keys move it (Shift for larger steps), Delete or a double click removes it.
 * Carries `data-blocked` briefly when removal is refused at `minPoints`.
 * Renders a `<div>` element.
 */
export function Point(componentProps: Point.Props) {
  const {
    className,
    getAriaValueText,
    index,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const {
    controller,
    focusedIndex,
    graphRef,
    registerPoint,
    removePoint,
    setFocusedIndex,
    snapshot,
    state,
  } = useEnvelopeContext("Point");
  const point = state.value[index];

  const pointState = React.useMemo<Point.State>(
    () => ({
      blocked: snapshot.blockedIndex === index,
      disabled: state.disabled,
      dragging: snapshot.draggingIndex === index,
      index,
      removable: state.value.length > snapshot.minPoints,
      value: state.value,
    }),
    [
      index,
      snapshot.blockedIndex,
      snapshot.draggingIndex,
      snapshot.minPoints,
      state.disabled,
      state.value,
    ]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (state.disabled || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    // Alt + click removes the point, as in a DAW's automation lane.
    if (event.altKey) {
      removePoint(index, event.nativeEvent);
      return;
    }
    const graph = graphRef.current;
    if (!graph) {
      return;
    }
    event.currentTarget.focus({ focusVisible: false, preventScroll: true });
    setFocusedIndex(index);
    controller.pressPoint(index, event.nativeEvent, event.currentTarget, graph);
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    removePoint(index, event.nativeEvent);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (state.disabled) {
      return;
    }
    const native = event.nativeEvent;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removePoint(index, native);
      return;
    }
    if (controller.keyPoint(index, native)) {
      event.preventDefault();
    }
  };

  const registerRef = React.useCallback(
    (node: HTMLDivElement | null) => registerPoint(index, node),
    [index, registerPoint]
  );

  const resolved = resolveStyling(className, style, pointState);
  // Centering stays in `transform` so a feedback animation can use the
  // standalone `translate` property without fighting it.
  const baseTransform = "translate(-50%, 50%)";

  return useRender({
    defaultTagName: "div",
    enabled: Boolean(point),
    props: mergeProps<"div">(
      {
        "aria-disabled": state.disabled || undefined,
        "aria-valuemax": 1,
        "aria-valuemin": 0,
        "aria-valuenow": point?.y,
        "aria-valuetext": point
          ? (getAriaValueText?.(point, index) ??
            controller.formatPoint(point.x, point.y))
          : undefined,
        onDoubleClick: handleDoubleClick,
        onFocus: () => setFocusedIndex(index),
        onKeyDown: handleKeyDown,
        onPointerDown: handlePointerDown,
        role: "slider",
        tabIndex: state.disabled || index !== focusedIndex ? -1 : 0,
      },
      {
        ...elementProps,
        className: resolved.className,
        style: {
          bottom: `${(point?.y ?? 0) * 100}%`,
          left: `${(point?.x ?? 0) * 100}%`,
          position: "absolute",
          touchAction: "none",
          ...resolved.style,
          transform: resolved.style?.transform
            ? `${baseTransform} ${resolved.style.transform}`
            : baseTransform,
        },
      }
    ),
    ref: ref ? [ref, registerRef] : registerRef,
    render,
    state: pointState,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Point {
  export type State = Root.State & {
    /** Briefly true after a removal was refused at `minPoints`. */
    blocked: boolean;
    index: number;
    /** Whether the point can currently be removed. */
    removable: boolean;
  };
  export interface Props extends PartProps<"div", State> {
    /** Returns the point's `aria-valuetext`. Defaults to the formatted `x, y`. */
    getAriaValueText?: (point: GeomPoint, index: number) => string;
    /** Index of the point in the (sorted) value. */
    index: number;
  }
}
