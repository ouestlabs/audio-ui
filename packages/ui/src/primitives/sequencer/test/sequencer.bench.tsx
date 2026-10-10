import { describe, test } from "bun:test";
import { fireEvent } from "@testing-library/react";
import { bench, expectWork } from "../../../../test/bench";
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
});
