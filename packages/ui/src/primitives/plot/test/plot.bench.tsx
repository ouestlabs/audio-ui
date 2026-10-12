import { describe, test } from "bun:test";
import { fireEvent } from "@testing-library/react";
import { bench, expectWork, sweep } from "../../../../test/bench.ts";
import { renderPlot } from "./helpers.tsx";

describe("Plot", () => {
  test("dragging a handle", () => {
    const { handle, onValueChange } = renderPlot();
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 100,
      clientY: 50,
      pointerId: 1,
    });
    bench("drag a handle", (index) => {
      fireEvent.pointerMove(handle, {
        clientX: sweep(index, 200),
        clientY: sweep(index + 11, 100, 53),
        pointerId: 1,
      });
    });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expectWork(onValueChange.mock.calls.length);
  });
});
