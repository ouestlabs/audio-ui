import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { Plot } from "../../../../entries/plot.js";

function renderGrid(
  props: Plot.Grid.Props = {},
  rootProps: Plot.Root.Props = {}
) {
  const view = render(
    <Plot.Root maxX={100} maxY={10} minX={0} minY={0} {...rootProps}>
      <Plot.Grid data-testid="grid" {...props} />
    </Plot.Root>
  );
  const grid = view.getByTestId("grid");
  return {
    grid,
    labels: (axis: string) =>
      [
        ...grid.querySelectorAll(`[data-part="label"][data-axis="${axis}"]`),
      ].map((label) => label.textContent),
    lines: (axis: string) => [
      ...grid.querySelectorAll(`[data-part="line"][data-axis="${axis}"]`),
    ],
  };
}

describe("Plot.Grid", () => {
  test("is hidden from assistive technology and from the pointer", () => {
    const { grid } = renderGrid({ x: {} });
    expect(grid.getAttribute("aria-hidden")).toBe("true");
    expect(grid.style.pointerEvents).toBe("none");
  });

  test("draws nothing for an axis it was not given", () => {
    const { lines } = renderGrid({ x: {} });
    expect(lines("y")).toHaveLength(0);
    expect(lines("x").length).toBeGreaterThan(0);
  });

  test("draws lines and labels at round values it works out", () => {
    const { labels, lines } = renderGrid({ x: { count: 5 }, y: { count: 5 } });
    expect(labels("x")).toEqual(["0", "20", "40", "60", "80", "100"]);
    expect(lines("x")).toHaveLength(6);
    expect(lines("x")[1]?.getAttribute("x1")).toBe("0.2");
    expect(labels("y")).toEqual(["0", "2", "4", "6", "8", "10"]);
  });

  test("takes the ticks it is given, formatted as asked", () => {
    const { labels } = renderGrid({
      y: { format: (value) => `${value} dB`, ticks: [2, 8] },
    });
    expect(labels("y")).toEqual(["2 dB", "8 dB"]);
  });

  test("puts labels at their value along the axis", () => {
    const { grid } = renderGrid({ x: { ticks: [25] }, y: { ticks: [10] } });
    const across = grid.querySelector(
      '[data-part="label"][data-axis="x"]'
    ) as HTMLElement;
    const down = grid.querySelector(
      '[data-part="label"][data-axis="y"]'
    ) as HTMLElement;
    expect(across.style.left).toBe("25%");
    expect(down.style.top).toBe("0%");
  });

  test("can draw lines without labels", () => {
    const { labels, lines } = renderGrid({ x: { labels: false, ticks: [50] } });
    expect(lines("x")).toHaveLength(1);
    expect(labels("x")).toHaveLength(0);
  });

  test("marks the line at zero", () => {
    const { lines } = renderGrid({ y: { ticks: [0, 5] } });
    expect(lines("y")[0]?.hasAttribute("data-zero")).toBe(true);
    expect(lines("y")[1]?.hasAttribute("data-zero")).toBe(false);
  });

  test("follows a logarithmic axis by powers of ten", () => {
    const { labels } = renderGrid(
      { x: { count: 6 } },
      { maxX: 20_000, minX: 20, scaleX: "log" }
    );
    expect(labels("x")).toEqual(["100", "1k", "10k"]);
  });
});
