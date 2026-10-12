import type { Point } from "@audio-ui/core";
import { createStore, type Store } from "@audio-ui/core";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { type PlotState, usePlotContext, valueOn } from "../context.ts";

/** Set on the cursor: where the pointer is across the plot, as a share of its width. */
export const CURSOR_X_PROPERTY = "--plot-cursor-x";
/** Set on the cursor: where the pointer is down the plot, as a share of its height. */
export const CURSOR_Y_PROPERTY = "--plot-cursor-y";

const CursorContext = React.createContext<Store<Point | null> | null>(null);

/**
 * Follows the pointer over the plot, for crosshair lines and a readout of
 * what is under it. It covers the plot, lets pointer events through, and sets
 * `--plot-cursor-x` and `--plot-cursor-y` (0% to 100% across and down) and
 * `data-active` while the pointer is over the plot with a mouse or a pen, all
 * in the DOM without re-rendering React. Put lines in it that use the two
 * variables, and a `Plot.CursorReadout`. Renders a `<div>` element.
 */
export function Cursor(componentProps: Cursor.Props) {
  const { children, className, ref, render, style, ...elementProps } =
    componentProps;
  const { meta, state } = usePlotContext("Cursor");
  const nodeRef = React.useRef<HTMLDivElement>(null);
  const [store] = React.useState(() => createStore<Point | null>(null));
  const { elementRef, measure, x, y } = meta;

  React.useEffect(() => {
    const plot = elementRef.current;
    const node = nodeRef.current;
    if (!(plot && node)) {
      return;
    }
    const handleMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        return;
      }
      const rect = measure();
      if (!rect) {
        return;
      }
      const across = Math.min(
        1,
        Math.max(0, (event.clientX - rect.left) / rect.width)
      );
      const down = Math.min(
        1,
        Math.max(0, (event.clientY - rect.top) / rect.height)
      );
      node.style.setProperty(CURSOR_X_PROPERTY, `${across * 100}%`);
      node.style.setProperty(CURSOR_Y_PROPERTY, `${down * 100}%`);
      node.setAttribute("data-active", "");
      store.set({ x: valueOn(x, across), y: valueOn(y, 1 - down) });
    };
    const handleEnter = () => {
      measure(true);
    };
    const handleLeave = () => {
      node.removeAttribute("data-active");
      store.set(null);
    };
    plot.addEventListener("pointerenter", handleEnter);
    plot.addEventListener("pointermove", handleMove);
    plot.addEventListener("pointerleave", handleLeave);
    return () => {
      plot.removeEventListener("pointerenter", handleEnter);
      plot.removeEventListener("pointermove", handleMove);
      plot.removeEventListener("pointerleave", handleLeave);
    };
  }, [elementRef, measure, store, x, y]);

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        "aria-hidden": true,
        children,
        style: { inset: 0, pointerEvents: "none", position: "absolute" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, nodeRef] : nodeRef,
    render,
    state,
  });
  return <CursorContext value={store}>{element}</CursorContext>;
}

export namespace Cursor {
  export type State = PlotState;
  export type Props = PartProps<"div", State>;
}

/**
 * The value under the pointer, as text: `format` turns it into what to show,
 * and the text is written straight into the DOM as the pointer moves. It sits
 * where the pointer is; set its offset and its look with your own classes.
 * Renders a `<div>` element.
 */
export function CursorReadout(componentProps: CursorReadout.Props) {
  const { className, format, ref, render, style, ...elementProps } =
    componentProps;
  const store = React.use(CursorContext);
  if (!store) {
    throw new Error("Plot.CursorReadout must be used within Plot.Cursor");
  }
  const { state } = usePlotContext("CursorReadout");
  const nodeRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const node = nodeRef.current;
    if (!node) {
      return;
    }
    // One text node, rewritten in place: replacing the node's children on every update makes the browser recheck every :has() and :empty rule on the page.
    const text = node.appendChild(document.createTextNode(""));
    const paint = () => {
      const value = store.get();
      text.data = value ? format(value) : "";
    };
    paint();
    const unsubscribe = store.subscribe(paint);
    return () => {
      unsubscribe();
      text.remove();
    };
  }, [format, store]);

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        style: {
          left: `var(${CURSOR_X_PROPERTY})`,
          position: "absolute",
          top: `var(${CURSOR_Y_PROPERTY})`,
        },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, nodeRef] : nodeRef,
    render,
    state,
  });
}

export namespace CursorReadout {
  export type State = PlotState;
  export interface Props extends Omit<PartProps<"div", State>, "children"> {
    /** Turns the value under the pointer, in the axes' units, into the text shown. */
    format: (value: Point) => string;
  }
}
