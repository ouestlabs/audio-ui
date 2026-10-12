import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { useKnobContext } from "../context";
import {
  START_ANGLE,
  STATE_ATTRIBUTES_MAPPING,
  SWEEP_ANGLE,
} from "../internal/shared";
import type { Root } from "./root";

/**
 * A graduation on the dial at `value`, placed on the knob's scale: a layer
 * the size of the knob, rotated to where `value` sits, so a tick drawn at its
 * top lands on the sweep. Its `--knob-mark-angle` CSS variable is that
 * rotation, to turn a label back upright. It carries `data-active` while the
 * value has reached it from the anchor. Decorative: the input announces the
 * value. Renders a `<div>` element.
 */
export function Mark(componentProps: Mark.Props) {
  const { className, ref, render, style, value, ...elementProps } =
    componentProps;
  const { meta, state: rootState } = useKnobContext("Mark");
  const position = meta.scale.toPosition(value, rootState.min, rootState.max);
  const angle = START_ANGLE + position * SWEEP_ANGLE;
  const lower = Math.min(meta.anchorPercent, meta.percent);
  const upper = Math.max(meta.anchorPercent, meta.percent);
  const active = position >= lower - 1e-9 && position <= upper + 1e-9;
  const state = React.useMemo<Mark.State>(
    () => ({ ...rootState, active }),
    [active, rootState]
  );
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        "aria-hidden": true,
        style: {
          "--knob-mark-angle": `${angle}deg`,
          inset: 0,
          pointerEvents: "none",
          position: "absolute",
          rotate: `${angle}deg`,
        } as React.CSSProperties,
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Mark {
  export type State = Root.State & {
    /** Whether the value has reached this mark from the anchor. */
    active: boolean;
  };
  export interface Props extends PartProps<"div", State> {
    /** Where the mark sits, on the knob's scale. */
    value: number;
  }
}
