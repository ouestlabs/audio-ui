import { isBlackKey } from "@audio-ui/core";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import {
  mergeProps,
  type StateAttributesMapping,
  useRender,
} from "../../internal/render.ts";
import { placedOnRow, usePianoRollContext, useRollView } from "../context.ts";

/**
 * Renders `children` once per row, highest pitch first: the place to put a
 * `PianoRoll.Row` on the grid, or a `PianoRoll.Key` in the keys. Renders no
 * element of its own.
 */
export function Rows({ children }: Rows.Props) {
  const { rows } = usePianoRollContext("Rows");
  return <>{rows.pitches.map((pitch) => children(pitch))}</>;
}

export namespace Rows {
  export interface Props {
    children: (pitch: number) => React.ReactNode;
  }
}

const ROW_ATTRIBUTES: StateAttributesMapping<Row.State> = {
  inScale: (inScale) => (inScale ? { "data-in-scale": "" } : null),
  outOfScale: (outOfScale) => (outOfScale ? { "data-out-of-scale": "" } : null),
  scaleRoot: (scaleRoot) => (scaleRoot ? { "data-scale-root": "" } : null),
};

/**
 * The band a pitch takes across the grid, for shading black-key rows, the
 * rows of the roll's scale and of its root, or ruling where an octave starts. It lets presses through to the grid and is
 * hidden from assistive technology. Renders a `<div>` element.
 */
export function Row(componentProps: Row.Props) {
  const { className, pitch, ref, render, style, ...elementProps } =
    componentProps;
  const { rows, state: rollState } = usePianoRollContext("Row");
  const active = useRollView("Row", (view) => view.active.has(pitch));
  const state = React.useMemo<Row.State>(() => {
    const pitchClass = ((pitch % 12) + 12) % 12;
    const inScale = rows.scale?.includes(pitchClass) ?? false;
    return {
      active,
      color: isBlackKey(pitch) ? "black" : "white",
      disabled: rollState.disabled,
      folded: rollState.folded,
      inScale,
      octave: pitchClass === 0,
      outOfScale: rows.scale !== null && !inScale,
      scaleRoot: rows.root === pitchClass,
    };
  }, [
    active,
    pitch,
    rollState.disabled,
    rollState.folded,
    rows.root,
    rows.scale,
  ]);
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        "aria-hidden": true,
        style: {
          ...placedOnRow(rows.rowOf(pitch)),
          left: 0,
          pointerEvents: "none",
          right: 0,
        },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
    stateAttributesMapping: ROW_ATTRIBUTES,
  });
}

export namespace Row {
  export type State = {
    /** Whether the pitch is sounding. */
    active: boolean;
    color: "black" | "white";
    disabled: boolean;
    /** Whether the roll is folded: neighbouring rows are not neighbouring pitches. */
    folded: boolean;
    /** Whether the pitch is in the roll's `scale`. */
    inScale: boolean;
    /** Whether the row is a C, where an octave starts. */
    octave: boolean;
    /** Whether the roll has a `scale` and the pitch is not in it. */
    outOfScale: boolean;
    /** Whether the pitch is the root of the roll's `scale`: a C in C major. */
    scaleRoot: boolean;
  };
  export interface Props extends PartProps<"div", State> {
    /** The MIDI pitch of the row. */
    pitch: number;
  }
}
