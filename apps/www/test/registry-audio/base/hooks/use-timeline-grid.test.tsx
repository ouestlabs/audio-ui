import { describe, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import {
  GRID_DIVISION_OPTIONS,
  GRID_KEYS,
  useTimelineGrid,
} from "@/registry-audio/bases/base/hooks/use-timeline-grid";

const TEMPO = { beatUnit: 4, beatsPerBar: 4, bpm: 120 };

/** At 120 BPM a sixteenth lasts 0.125 s: at 200 px a second it is 25 px wide. */
const setup = (zoom = 200) =>
  renderHook(
    (props: { zoom: number }) =>
      useTimelineGrid({ tempo: TEMPO, zoom: props.zoom }),
    {
      initialProps: { zoom },
    }
  );

describe("useTimelineGrid", () => {
  test("starts adaptive and snapping: the finest division still 24 px apart", () => {
    const { result } = setup();
    expect(result.current.division).toBe("adaptive");
    expect(result.current.step).toBe(0.125);
    expect(result.current.snapStep).toBe(0.125);
    expect(result.current.label).toBe("1/16");
  });

  test("an adaptive grid follows the zoom", () => {
    const view = setup();
    view.rerender({ zoom: 50 });
    expect(view.result.current.step).toBe(0.5);
  });

  test("finer and wider make an adaptive grid denser and sparser", () => {
    const { result } = setup(100);
    expect(result.current.step).toBe(0.25);
    act(() => result.current.change("finer"));
    expect(result.current.step).toBe(0.125);
    act(() => result.current.change("wider"));
    act(() => result.current.change("wider"));
    expect(result.current.step).toBe(0.5);
  });

  test("fixed keeps the division it shows whatever the zoom, and again follows the zoom", () => {
    const view = setup();
    act(() => view.result.current.change("fixed"));
    expect(view.result.current.division).toBe("1/16");
    view.rerender({ zoom: 50 });
    expect(view.result.current.step).toBe(0.125);
    act(() => view.result.current.change("wider"));
    expect(view.result.current.division).toBe("1/8");
    act(() => view.result.current.change("fixed"));
    expect(view.result.current.division).toBe("adaptive");
  });

  test("triplets play three in the space of two, and snapping off snaps to nothing", () => {
    const { result } = setup();
    act(() => result.current.change("triplet"));
    expect(result.current.triplet).toBe(true);
    // A sixteenth triplet would be 17 px apart at this zoom: the adaptive grid takes the eighth triplet.
    expect(result.current.label).toBe("1/8T");
    act(() => result.current.change("snap"));
    expect(result.current.snapStep).toBe(0);
    expect(result.current.label).toBe("Snap off");
  });

  test("Cmd/Ctrl + 1 to 5 by the key's place, and the menu's divisions", () => {
    expect(GRID_KEYS.Digit1).toBe("finer");
    expect(GRID_KEYS.Digit5).toBe("fixed");
    expect(GRID_DIVISION_OPTIONS[0]).toEqual({
      label: "Adaptive",
      value: "adaptive",
    });
    expect(GRID_DIVISION_OPTIONS.map((option) => option.label)).toContain(
      "1 bar"
    );
  });
});
