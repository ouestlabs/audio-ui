import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { isBlackKey } from "../../internal/pitch";
import { mergeProps, useRender } from "../../internal/render";
import { placedOnRow, usePianoRollContext, useRollView } from "../context";

/**
 * Renders `children` once per row, highest pitch first: the place to put a
 * `PianoRoll.Row` on the grid, or a `PianoRoll.Key` in the keys. Renders no
 * element of its own.
 */
export function Rows({ children }: Rows.Props) {
  const { meta } = usePianoRollContext("Rows");
  return <>{meta.rows.pitches.map((pitch) => children(pitch))}</>;
}

export namespace Rows {
  export interface Props {
    children: (pitch: number) => React.ReactNode;
  }
}

/**
 * The band a pitch takes across the grid, for shading black-key rows or
 * ruling where an octave starts. It lets presses through to the grid and is
 * hidden from assistive technology. Renders a `<div>` element.
 */
export function Row(componentProps: Row.Props) {
  const { className, pitch, ref, render, style, ...elementProps } =
    componentProps;
  const { meta, state: rollState } = usePianoRollContext("Row");
  const active = useRollView("Row", (view) => view.active.has(pitch));
  const state = React.useMemo<Row.State>(
    () => ({
      active,
      color: isBlackKey(pitch) ? "black" : "white",
      disabled: rollState.disabled,
      folded: rollState.folded,
      octave: pitch % 12 === 0,
    }),
    [active, pitch, rollState.disabled, rollState.folded]
  );
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        "aria-hidden": true,
        style: {
          ...placedOnRow(meta.rows.rowOf(pitch)),
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
    /** Whether the row is a C, where an octave starts. */
    octave: boolean;
  };
  export interface Props extends PartProps<"div", State> {
    /** The MIDI pitch of the row. */
    pitch: number;
  }
}
