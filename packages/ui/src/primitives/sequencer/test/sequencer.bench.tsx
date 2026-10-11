import { describe, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { bench, expectWork, sweep } from "../../../../test/bench";
import { mockRect } from "../../../../test/helpers";
import { Sequencer } from "../../../entries/sequencer";
import { renderSequencer } from "./helpers";

describe("Sequencer", () => {
  test("toggling steps", () => {
    const { cell, onValueChange } = renderSequencer();
    bench("press and release a cell", (index) => {
      const target = cell(index % 2, index % 4);
      fireEvent.pointerDown(target, {
        button: 0,
        clientX: 5,
        clientY: 5,
        pointerId: 1,
      });
      fireEvent.pointerUp(target, { pointerId: 1 });
    });
    expectWork(onValueChange.mock.calls.length);
  });

  test("toggling steps in a 16 × 64 grid", () => {
    let changes = 0;
    const view = render(
      <Sequencer.Root
        aria-label="Big pattern"
        defaultValue={Array.from({ length: 16 }, () =>
          new Array(64).fill(false)
        )}
        onValueChange={() => {
          changes += 1;
        }}
      >
        <Sequencer.Rows>
          {(row) => (
            <Sequencer.Row aria-label={`Row ${row + 1}`} index={row}>
              <Sequencer.Cells>
                {(step) => (
                  <Sequencer.Cell
                    aria-label={`Row ${row + 1}, step ${step + 1}`}
                    step={step}
                  />
                )}
              </Sequencer.Cells>
            </Sequencer.Row>
          )}
        </Sequencer.Rows>
      </Sequencer.Root>
    );
    // Found once: looking a cell up by its label would be the cost measured.
    const cells = view.getAllByRole("button");
    bench(
      "press and release a cell of 1024",
      (index) => {
        const target = cells[(index * 37) % cells.length] as HTMLElement;
        fireEvent.pointerDown(target, {
          button: 0,
          clientX: 5,
          clientY: 5,
          pointerId: 1,
        });
        fireEvent.pointerUp(target, { pointerId: 1 });
      },
      { runs: 200 }
    );
    expectWork(changes, 200);
  });

  test("drawing velocities across a row", () => {
    let changes = 0;
    const view = render(
      <Sequencer.Root
        defaultValue={[new Array(64).fill(true)]}
        onVelocityChange={() => {
          changes += 1;
        }}
      >
        <Sequencer.Rows>
          {(row) => (
            <Sequencer.Row index={row}>
              <Sequencer.Cells>
                {(step) => (
                  <Sequencer.Velocity
                    aria-label={`Step ${step + 1}`}
                    data-testid={`bar-${step}`}
                    step={step}
                  />
                )}
              </Sequencer.Cells>
            </Sequencer.Row>
          )}
        </Sequencer.Rows>
      </Sequencer.Root>
    );
    for (let step = 0; step < 64; step += 1) {
      mockRect(view.getByTestId(`bar-${step}`), {
        bottom: 100,
        height: 100,
        left: step * 10,
        right: step * 10 + 10,
        top: 0,
        width: 10,
      });
    }
    const first = view.getByTestId("bar-0");
    fireEvent.pointerDown(first, {
      button: 0,
      clientX: 5,
      clientY: 50,
      pointerId: 1,
    });
    bench("draw across 64 velocity bars", (index) => {
      fireEvent.pointerMove(first, {
        buttons: 1,
        clientX: 5 + sweep(index, 630),
        clientY: sweep(index + 3, 100, 41),
        pointerId: 1,
      });
    });
    fireEvent.pointerUp(first, { pointerId: 1 });
    expectWork(changes);
  });
});
