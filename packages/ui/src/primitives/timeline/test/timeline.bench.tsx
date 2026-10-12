import { describe, expect, test } from "bun:test";
import { createSource } from "@audio-ui/core";
import { act, fireEvent, render } from "@testing-library/react";
import { bench, expectWork, sweep } from "../../../../test/bench.ts";
import { Timeline } from "../../../entries/timeline.ts";
import { renderTimeline } from "./helpers.tsx";

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

  test("following a live position past 200 marks", () => {
    const source = createSource(0);
    const view = render(
      <Timeline.Root duration={1000} source={source}>
        <Timeline.Ruler aria-label="Position">
          {Array.from({ length: 200 }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: marks are generated, in order.
            <Timeline.Mark key={index} value={index * 5}>
              {index}
            </Timeline.Mark>
          ))}
        </Timeline.Ruler>
        <Timeline.Lane>
          <Timeline.Playhead data-testid="playhead" />
        </Timeline.Lane>
      </Timeline.Root>
    );
    bench("playhead past 200 marks", (index) => {
      act(() => source.set(sweep(index, 1000, 240)));
    });
    expect(view.getByTestId("playhead")).toBeTruthy();
  });
});
