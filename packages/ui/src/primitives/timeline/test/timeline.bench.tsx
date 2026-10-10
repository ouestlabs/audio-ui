import { describe, expect, test } from "bun:test";
import { act, fireEvent } from "@testing-library/react";
import { bench, expectWork, sweep } from "../../../../test/bench";
import { createSource } from "../../../source";
import { renderTimeline } from "./helpers";

describe("Timeline", () => {
  test("scrubbing the ruler", () => {
    const { onPositionChange, ruler } = renderTimeline({ snapStep: 1 });
    fireEvent.pointerDown(ruler, { clientX: 20, pointerId: 1 });
    bench("scrub, snapped", (index) => {
      fireEvent.pointerMove(ruler, {
        clientX: sweep(index, 200),
        pointerId: 1,
      });
    });
    fireEvent.pointerUp(ruler, { pointerId: 1 });
    expectWork(onPositionChange.mock.calls.length);
  });

  test("following a live position", () => {
    const source = createSource(0);
    const { playhead } = renderTimeline({ source });
    bench("playhead, one position per frame", (index) => {
      act(() => source.set(sweep(index, 100, 240)));
    });
    expect(
      playhead.style.getPropertyValue("--timeline-offset") ||
        playhead.style.cssText
    ).not.toBe("");
  });
});
