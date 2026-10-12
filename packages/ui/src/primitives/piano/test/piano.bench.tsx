import { describe, test } from "bun:test";
import { fireEvent } from "@testing-library/react";
import { bench, expectWork, sweep } from "../../../../test/bench.js";
import { renderPiano } from "./helpers.js";

describe("Piano", () => {
  test("gliding across the keys", () => {
    const { onNoteOn, root } = renderPiano();
    fireEvent.pointerDown(root, {
      button: 0,
      clientX: 10,
      clientY: 80,
      pointerId: 1,
    });
    bench("glide", (index) => {
      fireEvent.pointerMove(root, {
        clientX: sweep(index, 790, 40),
        clientY: 80,
        pointerId: 1,
      });
    });
    fireEvent.pointerUp(root, { pointerId: 1 });
    expectWork(onNoteOn.mock.calls.length, 60);
  });
});
