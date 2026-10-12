import { describe, expect, test } from "bun:test";
import { renderPlot } from "../helpers.tsx";

describe("Plot.Graph", () => {
  test("is a decorative svg stretched over the plot", () => {
    const { view } = renderPlot();
    const graph = view.getByTestId("graph");
    expect(graph.tagName.toLowerCase()).toBe("svg");
    expect(graph.getAttribute("aria-hidden")).toBe("true");
    expect(graph.getAttribute("viewBox")).toBe("0 0 1 1");
    expect(graph.getAttribute("preserveAspectRatio")).toBe("none");
  });
});

describe("Plot.Curve", () => {
  test("draws the function across the whole x axis", () => {
    const { view } = renderPlot();
    const curve = view.getByTestId("curve");
    // y = x / 10 over 0…100 against 0…10: a diagonal from bottom left to top right.
    expect(curve.getAttribute("d")?.startsWith("M 0 1 L")).toBe(true);
    expect(curve.getAttribute("d")?.endsWith("L 1 0")).toBe(true);
    expect(curve.getAttribute("vector-effect")).toBe("non-scaling-stroke");
  });

  test("follows a logarithmic x axis", () => {
    const { view } = renderPlot({ minX: 10, scaleX: "log" });
    const points = (view.getByTestId("curve").getAttribute("d") ?? "")
      .replace("M ", "")
      .split(" L ")
      .map((point) => point.split(" ").map(Number));
    // Halfway along a log axis from 10 to 100 is about 31.6, where y = 3.16 of 10.
    const middle = points.find(([along]) => (along ?? 0) >= 0.5);
    expect(middle?.[1]).toBeCloseTo(1 - 0.316, 1);
  });
});

describe("Plot.Line", () => {
  test("stands vertical at an x value and horizontal at a y value", () => {
    const { view } = renderPlot();
    const vertical = view.getByTestId("vline");
    expect(vertical.getAttribute("x1")).toBe("0.25");
    expect(vertical.getAttribute("x2")).toBe("0.25");
    expect(vertical.getAttribute("y2")).toBe("1");
    const horizontal = view.getByTestId("hline");
    expect(horizontal.getAttribute("y1")).toBe("0.5");
    expect(horizontal.getAttribute("x2")).toBe("1");
  });
});

describe("Plot.Band", () => {
  test("spans a stretch of one axis and all of the other", () => {
    const { view } = renderPlot();
    const band = view.getByTestId("band");
    expect(band.getAttribute("x")).toBe("0.2");
    expect(band.getAttribute("width")).toBe("0.4");
    expect(band.getAttribute("height")).toBe("1");
  });
});

describe("Plot.Mark", () => {
  test("is placed at a value along its axis and hidden from assistive technology", () => {
    const { view } = renderPlot();
    const across = view.getByTestId("xmark");
    expect(across.style.left).toBe("25%");
    expect(across.getAttribute("aria-hidden")).toBe("true");
    expect(across.getAttribute("data-axis")).toBe("x");
    const down = view.getByTestId("ymark");
    expect(down.style.top).toBe("50%");
  });
});
