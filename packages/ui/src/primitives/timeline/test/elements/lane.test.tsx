import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { Timeline } from "../../../../timeline";
import { renderTimeline } from "../helpers";

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

  test("must be used within a timeline", () => {
    expect(() => render(<Timeline.Lane />)).toThrow(
      "Timeline.Lane must be used within Timeline.Root"
    );
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
