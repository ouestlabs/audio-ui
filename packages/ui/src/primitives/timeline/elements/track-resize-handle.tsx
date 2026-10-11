import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { createChangeEventDetails } from "../../internal/event-details";
import { type PartProps, resolveStyling } from "../../internal/part";
import { isReleased } from "../../internal/pointer";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden";
import {
  type TrackChangeEventDetails,
  type TrackCommitEventDetails,
  type TrackState,
  useTrackContext,
} from "./track-context";

interface ResizeGesture {
  /** Whether the gesture changed the height at least once; if so its end commits. */
  changed: boolean;
  /** The height when the pointer went down: the drag is measured from it. */
  from: number;
  /** The latest height the track took. */
  latest: number;
  pointerId: number;
  startY: number;
}

/**
 * Sets the track's height: by dragging, or from the keyboard through the
 * native `<input type="range">` it holds, which carries the accessible name:
 * the arrows move by a step (Down is taller), Page Up and Down by a large
 * one, Home and End to the least and the most. Place it along the track's
 * lower edge. A double-click gives the height up, so the track shares the room
 * again. Renders a `<div>` element.
 */
export function TrackResizeHandle(componentProps: TrackResizeHandle.Props) {
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
  const { actions, meta, state } = useTrackContext("TrackResizeHandle");
  const gestureRef = React.useRef<ResizeGesture | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  /** What the track is now: the height it was given, or what it measures. */
  const current = () =>
    meta.height ?? meta.rowRef.current?.getBoundingClientRect().height ?? 0;

  const finish = React.useCallback(
    (event: PointerEvent) => {
      const gesture = gestureRef.current;
      gestureRef.current = null;
      actions.setResizing(false);
      if (gesture?.changed) {
        actions.commit(gesture.latest, { event, reason: "drag" });
      }
    },
    [actions]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    // The track's own press (to pick it) is not this one.
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const from = current();
    gestureRef.current = {
      changed: false,
      from,
      latest: from,
      pointerId: event.pointerId,
      startY: event.clientY,
    };
    actions.setResizing(true);
    inputRef.current?.focus({ focusVisible: false, preventScroll: true });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    if (isReleased(event)) {
      finish(event.nativeEvent);
      return;
    }
    const details = createChangeEventDetails("drag", event.nativeEvent);
    if (
      actions.resize(gesture.from + event.clientY - gesture.startY, details)
    ) {
      gesture.changed = true;
      gesture.latest = Math.min(
        meta.max,
        Math.max(meta.min, gesture.from + event.clientY - gesture.startY)
      );
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (gestureRef.current?.pointerId === event.pointerId) {
      finish(event.nativeEvent);
    }
  };

  const setHeight = React.useCallback(
    (to: number, reason: "input-change" | "keyboard", native: Event) => {
      const details = createChangeEventDetails(
        reason,
        native
      ) as TrackChangeEventDetails;
      if (actions.resize(to, details)) {
        actions.commit(Math.min(meta.max, Math.max(meta.min, to)), {
          event: native,
          reason,
        } as TrackCommitEventDetails);
      }
    },
    [actions, meta.max, meta.min]
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const now =
        meta.height ?? meta.rowRef.current?.getBoundingClientRect().height ?? 0;
      const targets: Record<string, number> = {
        ArrowDown: now + meta.step,
        ArrowLeft: now - meta.step,
        ArrowRight: now + meta.step,
        ArrowUp: now - meta.step,
        End: meta.max,
        Home: meta.min,
        PageDown: now + meta.largeStep,
        PageUp: now - meta.largeStep,
      };
      const to = targets[event.key];
      if (to === undefined) {
        return;
      }
      event.preventDefault();
      setHeight(to, "keyboard", event.nativeEvent);
    },
    [meta, setHeight]
  );

  const handleDoubleClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) =>
      actions.reset(event.nativeEvent),
    [actions]
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setHeight(
        Number(event.currentTarget.value),
        "input-change",
        event.nativeEvent
      ),
    [setHeight]
  );

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        children: (
          <>
            {children}
            <input
              aria-describedby={ariaDescribedBy}
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              aria-orientation="vertical"
              max={meta.max}
              min={meta.min}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              ref={inputRef}
              step="any"
              style={VISUALLY_HIDDEN}
              type="range"
              value={meta.height ?? meta.min}
            />
          </>
        ),
        onDoubleClick: handleDoubleClick,
        onLostPointerCapture: handlePointerEnd,
        onPointerCancel: handlePointerEnd,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerEnd,
        style: { touchAction: "none" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace TrackResizeHandle {
  export type State = TrackState;
  export type Props = PartProps<"div", State>;
}
