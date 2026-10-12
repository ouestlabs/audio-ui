import {
  createNavigatorController,
  type NavigatorController,
  type NavigatorPart,
  visibleRange,
} from "@audio-ui/core/timeline";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden.js";
import {
  type DescribePosition,
  type TimelineState,
  useTimelineContext,
} from "../context.js";

const describeNumber: DescribePosition = (value) =>
  String(Math.round(value * 100) / 100);

interface NavigatorContextValue {
  /** The framework-agnostic navigator behind the bar, its window and its handles. */
  controller: NavigatorController;
  describe: DescribePosition;
  duration: number;
  /** The visible stretch, in units. */
  range: readonly [number, number];
  /** The navigator's bar: what a drag's px are measured along. */
  trackRef: React.RefObject<HTMLDivElement | null>;
}

const NavigatorContext = React.createContext<NavigatorContextValue | null>(
  null
);

function useNavigatorContext(part: string): NavigatorContextValue {
  const context = React.use(NavigatorContext);
  if (!context) {
    throw new Error(`Timeline.${part} must be used within Timeline.Navigator`);
  }
  return context;
}

/**
 * The whole timeline as one bar, with the stretch the viewport shows drawn
 * inside it as `Timeline.NavigatorWindow`: drag the window to scroll, drag
 * one of its `Timeline.NavigatorHandle`s to zoom, double-click to show
 * everything. Place it anywhere inside `Timeline.Root`, outside the viewport.
 * Renders a `<div>` element.
 */
export function Navigator(componentProps: Navigator.Props) {
  const {
    className,
    getAriaValueText = describeNumber,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const timeline = useTimelineContext("Navigator");
  const { actions, meta, state } = timeline;
  const { duration, viewport } = meta;
  const metrics = React.useSyncExternalStore(
    viewport.subscribe,
    viewport.get,
    viewport.get
  );
  const range = visibleRange(metrics, duration);
  const trackRef = React.useRef<HTMLDivElement>(null);

  const controller = React.useMemo(
    () =>
      createNavigatorController({
        disabled: state.disabled,
        duration,
        metrics: () => viewport.get(),
        scrollTo: actions.scrollTo,
        zoomTo: actions.zoomTo,
      }),
    [actions.scrollTo, actions.zoomTo, duration, state.disabled, viewport]
  );

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    controller.doubleClick(event.nativeEvent);
  };

  const context = React.useMemo<NavigatorContextValue>(
    () => ({
      controller,
      describe: getAriaValueText,
      duration,
      range,
      trackRef,
    }),
    [controller, duration, getAriaValueText, range]
  );

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        onDoubleClick: handleDoubleClick,
        style: { position: "relative", touchAction: "none" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, trackRef] : trackRef,
    render,
    state,
  });

  return <NavigatorContext value={context}>{element}</NavigatorContext>;
}

/** Drag and keyboard handling shared by the window and its handles. */
function useNavigatorPart(part: NavigatorPart, disabled: boolean) {
  const navigator = useNavigatorContext(
    part === "window" ? "NavigatorWindow" : "NavigatorHandle"
  );
  const { controller, duration, range, trackRef } = navigator;

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    if (disabled) {
      return;
    }
    event.preventDefault();
    controller.press(
      part,
      event.nativeEvent,
      event.currentTarget,
      trackRef.current
    );
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (controller.keyDown(part, event.nativeEvent)) {
      event.preventDefault();
    }
  };

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    controller.typeAt(
      part,
      Number(event.currentTarget.value),
      event.nativeEvent
    );
  };

  return {
    input: { onChange, onKeyDown },
    navigator: { ...navigator, duration, range },
    pointer: { onPointerDown },
  };
}

export namespace Navigator {
  export type State = TimelineState;
  export interface Props extends PartProps<"div", State> {
    /** Returns how a position is announced by the window and its handles. Defaults to the number. */
    getAriaValueText?: DescribePosition;
  }
}

/**
 * The stretch of the timeline the viewport shows. Dragging it scrolls; its
 * native `<input type="range">` scrolls from the keyboard and carries its
 * accessible name. Renders a `<div>` element.
 */
export function NavigatorWindow(componentProps: NavigatorWindow.Props) {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    children,
    className,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { state } = useTimelineContext("NavigatorWindow");
  const { input, navigator, pointer } = useNavigatorPart(
    "window",
    state.disabled
  );
  const { describe, duration, range } = navigator;
  const [start, end] = range;
  const share = (value: number) =>
    `${(duration > 0 ? value / duration : 0) * 100}%`;

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        ...pointer,
        children: (
          <>
            {children}
            <input
              aria-describedby={ariaDescribedBy}
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              aria-valuetext={`${describe(start, duration)} to ${describe(end, duration)}`}
              disabled={state.disabled}
              max={Math.max(0, duration - (end - start))}
              min={0}
              onChange={input.onChange}
              onKeyDown={input.onKeyDown}
              step="any"
              style={VISUALLY_HIDDEN}
              type="range"
              value={start}
            />
          </>
        ),
        style: {
          left: share(start),
          position: "absolute",
          width: share(end - start),
        },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace NavigatorWindow {
  export type State = TimelineState;
  export type Props = PartProps<"div", State>;
}

/**
 * One edge of the window: dragging it zooms, holding the other edge in
 * place. Its native `<input type="range">` does the same from the keyboard
 * and carries its accessible name. Renders a `<div>` element.
 */
export function NavigatorHandle(componentProps: NavigatorHandle.Props) {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    children,
    className,
    edge,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { state: timelineState } = useTimelineContext("NavigatorHandle");
  const { input, navigator, pointer } = useNavigatorPart(
    edge,
    timelineState.disabled
  );
  const { describe, duration, range } = navigator;
  const current = edge === "start" ? range[0] : range[1];
  const state = React.useMemo<NavigatorHandle.State>(
    () => ({ ...timelineState, edge }),
    [edge, timelineState]
  );

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        ...pointer,
        children: (
          <>
            {children}
            <input
              aria-describedby={ariaDescribedBy}
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              aria-valuetext={describe(current, duration)}
              disabled={state.disabled}
              max={edge === "start" ? range[1] : duration}
              min={edge === "start" ? 0 : range[0]}
              onChange={input.onChange}
              onKeyDown={input.onKeyDown}
              step="any"
              style={VISUALLY_HIDDEN}
              type="range"
              value={current}
            />
          </>
        ),
        style: {
          left: `${(duration > 0 ? current / duration : 0) * 100}%`,
          position: "absolute",
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

export namespace NavigatorHandle {
  export type State = TimelineState & {
    /** The edge of the window this handle moves. */
    edge: "end" | "start";
  };
  export interface Props extends PartProps<"div", State> {
    /** The edge of the window this handle moves. */
    edge: "end" | "start";
  }
}
