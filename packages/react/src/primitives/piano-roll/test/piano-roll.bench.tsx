import { describe, test } from "bun:test";
import { fireEvent } from "@testing-library/react";
import { bench, expectWork, sweep } from "../../../../test/bench.ts";
import { renderRoll } from "./helpers.tsx";

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

  test("dragging a note among 500", () => {
    const notes = Array.from({ length: 500 }, (_, index) => ({
      id: `n${index}`,
      length: 1,
      pitch: 60 + (index % 4),
      start: index % 15,
      velocity: 0.8,
    }));
    const { note, onValueChange } = renderRoll({ defaultValue: notes });
    const target = note("n0");
    fireEvent.pointerDown(target, {
      button: 0,
      clientX: 5,
      clientY: 5,
      pointerId: 1,
    });
    bench("drag one of 500 notes, snapped", (index) => {
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
