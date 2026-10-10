import { useEnvelopeContext } from "../context";
import type { Breakpoint } from "../internal/geometry";

/** Renders one child per point, in `x` order. */
export function Points({ children }: Points.Props) {
  const { state } = useEnvelopeContext("Points");
  return (
    <>
      {state.value.map((point, index) => children(point, index, state.value))}
    </>
  );
}

export namespace Points {
  export interface Props {
    children: (
      point: Breakpoint,
      index: number,
      points: Breakpoint[]
    ) => React.ReactNode;
  }
}
