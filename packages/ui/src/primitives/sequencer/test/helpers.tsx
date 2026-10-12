import { mock } from "bun:test";
import { type RenderResult, render } from "@testing-library/react";
import { mockRect } from "../../../../test/helpers.ts";
import { Sequencer } from "../../../entries/sequencer.ts";

/** Two rows of four steps, each cell 10px square at (10 × step, 10 × row). */
export function renderSequencer(props: Sequencer.Root.Props = {}) {
  const onValueChange = mock(
    (_value: boolean[][], _details: Sequencer.Root.ChangeEventDetails) =>
      undefined
  );
  const onValueCommitted = mock(
    (_value: boolean[][], _details: Sequencer.Root.CommitEventDetails) =>
      undefined
  );
  const view: RenderResult = render(
    <Sequencer.Root
      aria-label="Pattern"
      data-testid="root"
      defaultValue={[
        [true, false, false, false],
        [false, false, true, false],
      ]}
      onValueChange={onValueChange}
      onValueCommitted={onValueCommitted}
      {...props}
    >
      <Sequencer.Rows>
        {(row) => (
          <Sequencer.Row aria-label={`Row ${row + 1}`} index={row}>
            <Sequencer.Cells>
              {(step) => (
                <Sequencer.Cell
                  aria-label={`Row ${row + 1}, step ${step + 1}`}
                  data-testid={`cell-${row}-${step}`}
                  step={step}
                />
              )}
            </Sequencer.Cells>
          </Sequencer.Row>
        )}
      </Sequencer.Rows>
    </Sequencer.Root>
  );
  for (let row = 0; row < 2; row += 1) {
    for (let step = 0; step < 4; step += 1) {
      mockRect(view.getByTestId(`cell-${row}-${step}`), {
        bottom: row * 10 + 10,
        left: step * 10,
        right: step * 10 + 10,
        top: row * 10,
      });
    }
  }
  return {
    cell: (row: number, step: number) =>
      view.getByTestId(`cell-${row}-${step}`),
    onValueChange,
    onValueCommitted,
    root: view.getByTestId("root"),
    view,
  };
}

export const lastCall = <T extends unknown[]>(fn: { mock: { calls: T[] } }) =>
  fn.mock.calls.at(-1) as T;
