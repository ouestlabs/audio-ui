import { describe, test } from "bun:test";
import { fireEvent } from "@testing-library/react";
import { bench, expectWork, sweep } from "../../../../test/bench";
import { renderRoll } from "./helpers";

describe("Piano roll", () => {
  test("dragging a note", () => {
    const { note, onValueChange } = renderRoll();
    const target = note("a");
    fireEvent.pointerDown(target, {
      button: 0,
      clientX: 5,
      clientY: 5,
      pointerId: 1,
    });
    bench("drag a note, snapped", (index) => {
      fireEvent.pointerMove(target, {
        clientX: 5 + sweep(index, 100),
        clientY: 5 + sweep(index + 5, 30, 37),
        pointerId: 1,
      });
    });
    fireEvent.pointerUp(target, { pointerId: 1 });
    expectWork(onValueChange.mock.calls.length, 60);
  });
});
