import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { clampUnit } from "../../../utils";
import { createChangeEventDetails } from "../../internal/event-details";
import { type PartProps, resolveStyling } from "../../internal/part";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden";
import {
  type DescribeValue,
  describeAsPercent,
  useWaveformContext,
  type WaveformState,
} from "../context";

interface SeekGesture {
  /** Whether the gesture moved the position at least once; if so its end commits. */
  changed: boolean;
  /** Whether the pointer moved after the press: the commit reason is "drag", else "press". */
  moved: boolean;
  pointerId: number;
}

/**
 * The seekable surface: a press jumps to the pointer and a drag scrubs. It
 * tracks the hovered position for `Waveform.Hover`, sets `touch-action: none`
 * so touch scrubbing doesn't scroll the page, and holds the native
 * `<input type="range">` that takes focus, handles the keyboard and carries
 * the accessible name (`aria-label` / `aria-labelledby`). Leave it out for a
 * waveform that is only shown. Renders a `<div>` element.
 */
export function Control(componentProps: Control.Props) {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    children,
    className,
    getAriaValueText,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { actions, meta, state } = useWaveformContext("Control");
  const { duration } = meta;
  // Nothing to seek while disabled, or before the audio is there.
  const inert = state.disabled || state.loading;
  const gestureRef = React.useRef<SeekGesture | null>(null);
  const describe = getAriaValueText ?? describeAsPercent;
  // Kept current for the paints that happen outside React.
  meta.describeRef.current = describe;

  const valueAt = (event: React.PointerEvent<HTMLDivElement>): number => {
    const rect = event.currentTarget.getBoundingClientRect();
    return meta.atShare(
      clampUnit((event.clientX - rect.left) / Math.max(rect.width, 1))
    );
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (inert || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    meta.inputRef.current?.focus({ preventScroll: true });
    const gesture: SeekGesture = {
      changed: false,
      moved: false,
      pointerId: event.pointerId,
    };
    gestureRef.current = gesture;
    actions.setDragging(true);
    gesture.changed = actions.change(
      valueAt(event),
      createChangeEventDetails("press", event.nativeEvent)
    );
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (inert) {
      return;
    }
    const at = valueAt(event);
    meta.hover.set(at);
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gesture.moved = true;
    if (
      actions.change(at, createChangeEventDetails("drag", event.nativeEvent))
    ) {
      gesture.changed = true;
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gestureRef.current = null;
    // Read before settling: the position falls back to the known value after.
    const committed = meta.valueRef.current;
    actions.setDragging(false);
    if (gesture.changed) {
      actions.commit(committed, {
        event: event.nativeEvent,
        reason: gesture.moved ? "drag" : "press",
      });
    }
  };

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (inert) {
        return;
      }
      const { current } = meta.valueRef;
      const arrowStep = event.shiftKey ? meta.largeStep : meta.step;
      const targets: Record<string, number> = {
        ArrowDown: current - arrowStep,
        ArrowLeft: current - arrowStep,
        ArrowRight: current + arrowStep,
        ArrowUp: current + arrowStep,
        End: meta.range[1],
        Home: meta.range[0],
        PageDown: current - meta.largeStep,
        PageUp: current + meta.largeStep,
      };
      const target = targets[event.key];
      if (target === undefined) {
        return;
      }
      // The keys move within the stretch shown.
      const next = Math.min(meta.range[1], Math.max(meta.range[0], target));
      event.preventDefault();
      const native = event.nativeEvent;
      if (actions.change(next, createChangeEventDetails("keyboard", native))) {
        actions.commit(meta.valueRef.current, {
          event: native,
          reason: "keyboard",
        });
      }
    },
    [actions, inert, meta]
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (inert) {
        return;
      }
      const native = event.nativeEvent;
      if (
        actions.change(
          Number(event.currentTarget.value),
          createChangeEventDetails("input-change", native)
        )
      ) {
        actions.commit(meta.valueRef.current, {
          event: native,
          reason: "input-change",
        });
      }
    },
    [actions, inert, meta]
  );

  const initialValue = meta.valueRef.current;

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
              aria-valuetext={describe(initialValue, duration)}
              defaultValue={initialValue}
              disabled={state.disabled}
              max={meta.range[1]}
              min={meta.range[0]}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              ref={meta.inputRef}
              step="any"
              style={VISUALLY_HIDDEN}
              type="range"
            />
          </>
        ),
        onPointerCancel: handlePointerEnd,
        onPointerDown: handlePointerDown,
        onPointerLeave: () => meta.hover.set(null),
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

export namespace Control {
  export type State = WaveformState;
  export interface Props extends PartProps<"div", State> {
    /** Returns how the position is announced, e.g. `"0:12 of 1:42"`. Defaults to the played share, e.g. `"30%"`. */
    getAriaValueText?: DescribeValue;
  }
}
