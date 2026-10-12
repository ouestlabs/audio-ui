import { describe, expect, test } from "bun:test";
import { createSource } from "@audio-ui/core";
import { act, fireEvent } from "@testing-library/react";
import { bench, expectWork, sweep } from "../../../../test/bench.js";
import { renderWaveform } from "./helpers.js";

const PEAKS = Array.from(
  { length: 2048 },
  (_, i) => 0.3 + 0.7 * Math.abs(Math.sin(i / 20))
);

describe("Waveform", () => {
  test("scrubbing", () => {
    const { control, onValueChange } = renderWaveform({ peaks: PEAKS });
    fireEvent.pointerDown(control, { clientX: 10, clientY: 20, pointerId: 1 });
    bench("scrub", (index) => {
      fireEvent.pointerMove(control, {
        clientX: sweep(index, 200),
        clientY: 20,
        pointerId: 1,
      });
    });
    fireEvent.pointerUp(control, { pointerId: 1 });
    expectWork(onValueChange.mock.calls.length);
  });

  test("following a live position", () => {
    const source = createSource(0);
    const { position } = renderWaveform({ peaks: PEAKS, source });
    bench("playhead, one position per frame", (index) => {
      act(() => source.set(sweep(index, 100, 240)));
    });
    expect(position()).not.toBe("");
  });
});
