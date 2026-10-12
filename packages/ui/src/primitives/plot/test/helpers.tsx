import { mock } from "bun:test";
import { type RenderResult, render } from "@testing-library/react";
import { mockRect } from "../../../../test/helpers.ts";
import { Plot } from "../../../entries/plot.ts";

const diagonal = (x: number) => x / 10;

/**
 * A plot of 0…100 across and 0…10 up, 200×100px at the origin: 2px per x
 * unit, 10px per y unit. Extra props go to the root, `handleProps` to the
 * handle.
 */
export function renderPlot(
  props: Plot.Root.Props = {},
  handleProps: Plot.Handle.Props = {}
) {
  const onValueChange = mock(
    (_value: Plot.Handle.Value, _details: Plot.Handle.ChangeEventDetails) =>
      undefined
  );
  const onValueCommitted = mock(
    (_value: Plot.Handle.Value, _details: Plot.Handle.CommitEventDetails) =>
      undefined
  );
  const view: RenderResult = render(
    <Plot.Root
      data-testid="root"
      maxX={100}
      maxY={10}
      minX={0}
      minY={0}
      {...props}
    >
      <Plot.Graph data-testid="graph">
        <Plot.Curve data-testid="curve" fn={diagonal} />
        <Plot.Line axis="x" data-testid="vline" value={25} />
        <Plot.Line axis="y" data-testid="hline" value={5} />
        <Plot.Band axis="x" data-testid="band" from={20} to={60} />
      </Plot.Graph>
      <Plot.Mark axis="x" data-testid="xmark" value={25}>
        25
      </Plot.Mark>
      <Plot.Mark axis="y" data-testid="ymark" value={5}>
        5
      </Plot.Mark>
      <Plot.Handle
        aria-label="Band"
        data-testid="handle"
        defaultValue={{ x: 50, y: 5 }}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
        {...handleProps}
      />
    </Plot.Root>
  );
  const root = view.getByTestId("root");
  mockRect(root, { bottom: 100, height: 100, right: 200, width: 200 });
  return {
    handle: view.getByTestId("handle"),
    inputs: view.getAllByRole("slider") as HTMLInputElement[],
    onValueChange,
    onValueCommitted,
    root,
    view,
  };
}

export const lastCall = <T extends unknown[]>(fn: { mock: { calls: T[] } }) =>
  fn.mock.calls.at(-1) as T;
