import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import {
  RowContext,
  type SequencerState,
  useSequencerContext,
  useSequencerView,
} from "../context.js";

/** Renders `children` once per row: the place to put a `Sequencer.Row`. Renders no element of its own. */
export function Rows({ children }: Rows.Props) {
  const { meta } = useSequencerContext("Rows");
  return (
    <>
      {Array.from({ length: meta.rows }, (_, row) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a row is its position.
        <React.Fragment key={row}>{children(row)}</React.Fragment>
      ))}
    </>
  );
}

export namespace Rows {
  export interface Props {
    children: (row: number) => React.ReactNode;
  }
}

/** Renders `children` once per step of the row it is in: the place to put a `Sequencer.Cell`. Renders no element of its own. */
export function Cells({ children }: Cells.Props) {
  const { meta } = useSequencerContext("Cells");
  return (
    <>
      {Array.from({ length: meta.steps }, (_, step) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a step is its position.
        <React.Fragment key={step}>{children(step)}</React.Fragment>
      ))}
    </>
  );
}

export namespace Cells {
  export interface Props {
    children: (step: number) => React.ReactNode;
  }
}

/** One sound's row of steps. Name it with `aria-label`, such as "Kick". Renders a `<div>` element. */
export function Row(componentProps: Row.Props) {
  const { className, index, ref, render, style, ...elementProps } =
    componentProps;
  const { state: shared } = useSequencerContext("Row");
  const painting = useSequencerView("Row", (view) => view.painting);
  const state = React.useMemo(
    () => ({ disabled: shared.disabled, painting }),
    [painting, shared.disabled]
  );
  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { role: "group" },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
  return <RowContext value={index}>{element}</RowContext>;
}

export namespace Row {
  export type State = SequencerState;
  export interface Props extends PartProps<"div", State> {
    /** Which row this is, from the top. */
    index: number;
  }
}
