import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../../../../test/helpers.ts";
import { Timeline } from "../../../../entries/timeline.ts";
import { renderTimeline } from "../helpers.tsx";

describe("Timeline.Lane", () => {
  test("fitted, spreads the timeline across its width", () => {
    const { lane, view } = renderTimeline();
    expect(lane.style.getPropertyValue("--timeline-unit")).toBe(
      "calc(100% / 100)"
    );
    expect(lane.style.minWidth).toBe("");
    expect(view.getByTestId("root").hasAttribute("data-fitted")).toBe(true);
  });

  test("zoomed, is at least as long as the timeline, one unit at the zoom", () => {
    const { lane, view } = renderTimeline({ zoom: 12 });
    expect(lane.style.getPropertyValue("--timeline-unit")).toBe("12px");
    expect(lane.style.minWidth).toBe("1200px");
    expect(view.getByTestId("root").hasAttribute("data-fitted")).toBe(false);
  });

  test("is laid out and styled apart from the rest of the page", () => {
    expect(renderTimeline().lane.style.contain).toBe("layout style");
  });

  test("keeps what sticks out of it from lengthening the timeline", () => {
    expect(renderTimeline().lane.style.overflowX).toBe("clip");
  });

  test("must be used within a timeline", () => {
    expect(() => render(<Timeline.Lane />)).toThrow(
      "Timeline.Lane must be used within Timeline.Root"
    );
  });
});

describe("Timeline.Lane seekable", () => {
  /** A 100-unit timeline whose seekable lane is 200px wide: 2px per unit. */
  function renderSeekable(props: Timeline.Lane.Props = {}) {
    const onPositionChange = mock(
      (_value: number, _details: Timeline.Root.PositionChangeEventDetails) =>
        undefined
    );
    const onPositionCommitted = mock(
      (_value: number, _details: Timeline.Root.PositionCommitEventDetails) =>
        undefined
    );
    const view = render(
      <Timeline.Root
        duration={100}
        onPositionChange={onPositionChange}
        onPositionCommitted={onPositionCommitted}
      >
        <Timeline.Lane data-testid="lane" seekable {...props}>
          <Timeline.Mark data-testid="part" value={10} />
        </Timeline.Lane>
      </Timeline.Root>
    );
    const lane = view.getByTestId("lane");
    mockRect(lane, { bottom: 20, height: 20, right: 200, width: 200 });
    return {
      lane,
      onPositionChange,
      onPositionCommitted,
      part: view.getByTestId("part"),
    };
  }

  test("a press on the bare lane puts the position there and commits on release", () => {
    const { lane, onPositionChange, onPositionCommitted } = renderSeekable();
    fireEvent.pointerDown(lane, { clientX: 80, pointerId: 1 });
    expect(onPositionChange.mock.calls.at(-1)?.[0]).toBe(40);
    fireEvent.pointerUp(lane, { clientX: 80, pointerId: 1 });
    expect(onPositionCommitted.mock.calls.at(-1)).toEqual([
      40,
      expect.objectContaining({ reason: "press" }),
    ]);
  });

  test("a drag scrubs, on the grid unless Cmd/Ctrl is held", () => {
    const { lane, onPositionChange, onPositionCommitted } = {
      ...renderSeekable(),
    };
    fireEvent.pointerDown(lane, { clientX: 80, pointerId: 1 });
    fireEvent.pointerMove(lane, { clientX: 100, pointerId: 1 });
    expect(onPositionChange.mock.calls.at(-1)?.[0]).toBe(50);
    fireEvent.pointerUp(lane, { clientX: 100, pointerId: 1 });
    expect(onPositionCommitted.mock.calls.at(-1)?.[1]).toEqual(
      expect.objectContaining({ reason: "drag" })
    );
  });

  test("a press on a part placed in the lane is left to that part", () => {
    const { onPositionChange, part } = renderSeekable();
    fireEvent.pointerDown(part, { clientX: 80, pointerId: 1 });
    expect(onPositionChange).not.toHaveBeenCalled();
  });

  test("does nothing unless it is asked to", () => {
    const { lane, onPositionChange } = renderSeekable({ seekable: false });
    fireEvent.pointerDown(lane, { clientX: 80, pointerId: 1 });
    expect(onPositionChange).not.toHaveBeenCalled();
  });
});

describe("Timeline.Mark", () => {
  test("sits at its value on the lane, its children its label", () => {
    const { view } = renderTimeline();
    const mark = view.getByTestId("mark");
    expect(mark.style.getPropertyValue("--timeline-offset")).toBe("25");
    expect(mark.style.position).toBe("absolute");
    expect(mark.textContent).toBe("2");
  });
});

describe("Timeline.Playhead", () => {
  test("is decorative and placed at the position", () => {
    const { playhead } = renderTimeline({ position: 30 });
    expect(playhead.getAttribute("aria-hidden")).toBe("true");
    expect(playhead.style.getPropertyValue("--timeline-offset")).toBe("30");
  });
});
