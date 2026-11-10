import { describe, expect, test } from "bun:test";
import { createSource } from "@audio-ui/core";
import "../src/plot/index.ts";
import type {
  PlotCursorReadoutElement,
  PlotCurveElement,
  PlotDotElement,
  PlotElement,
  PlotGridElement,
  PlotHandleElement,
  PlotTraceElement,
} from "../src/plot/index.ts";
import { key, mockRect, pointer } from "./helpers.ts";

type Point = { x: number; y: number };

/**
 * A plot of 0…100 across and 0…10 up, 200×100px at the origin: 2px per x
 * unit, 10px per y unit, with a handle at 50, 5 by default.
 */
function renderPlot(attributes = "", handle = 'default-value="50 5"') {
  document.body.innerHTML = `
    <audio-ui-plot max-x="100" max-y="10" locale="en-US" ${attributes}>
      <audio-ui-plot-curve></audio-ui-plot-curve>
      <audio-ui-plot-line axis="x" value="25"></audio-ui-plot-line>
      <audio-ui-plot-line axis="y" value="5"></audio-ui-plot-line>
      <audio-ui-plot-band axis="x" from="20" to="60"></audio-ui-plot-band>
      <audio-ui-plot-mark axis="x" value="25">25</audio-ui-plot-mark>
      <audio-ui-plot-mark axis="y" value="5">5</audio-ui-plot-mark>
      <audio-ui-plot-handle aria-label="Band" ${handle}></audio-ui-plot-handle>
    </audio-ui-plot>`;
  const root = document.querySelector("audio-ui-plot") as PlotElement;
  mockRect(root, { bottom: 100, height: 100, right: 200, width: 200 });
  const handleElement = root.querySelector(
    "audio-ui-plot-handle"
  ) as PlotHandleElement;
  const changes: [Point, string][] = [];
  const commits: [Point, string][] = [];
  handleElement.addEventListener("input", (event) =>
    changes.push([event.detail.value, event.detail.reason])
  );
  handleElement.addEventListener("change", (event) =>
    commits.push([event.detail.value, event.detail.reason])
  );
  const shape = (selector: string, index = 0) =>
    root.querySelectorAll(`${selector} svg > *`)[index] as Element;
  return {
    changes,
    commits,
    handle: handleElement,
    inputs: () => [...handleElement.querySelectorAll("input")],
    root,
    shape,
  };
}

/** A drag on `target` from one point to another, in client pixels. */
function drag(
  target: Element,
  [fromX, fromY]: [number, number],
  [toX, toY]: [number, number],
  init: PointerEventInit = {}
) {
  pointer(target, "pointerdown", {
    clientX: fromX,
    clientY: fromY,
    pointerId: 1,
    ...init,
  });
  pointer(target, "pointermove", {
    clientX: toX,
    clientY: toY,
    pointerId: 1,
    ...init,
  });
  pointer(target, "pointerup", {
    clientX: toX,
    clientY: toY,
    pointerId: 1,
    ...init,
  });
}

describe("the plot's drawings", () => {
  test("each draws in a decorative 1×1 svg of its own, stretched over the plot", () => {
    const { root } = renderPlot();
    const svg = root.querySelector("audio-ui-plot-line svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 1 1");
    expect(svg?.getAttribute("preserveAspectRatio")).toBe("none");
  });

  test("a curve draws its function across the whole x axis, as a line or down to fill-to as an area", () => {
    const { root, shape } = renderPlot();
    const curve = root.querySelector("audio-ui-plot-curve") as PlotCurveElement;
    expect(shape("audio-ui-plot-curve").getAttribute("d")).toBe("");
    curve.fn = (x) => x / 10;
    const path = shape("audio-ui-plot-curve");
    expect(path.getAttribute("d")?.startsWith("M 0 1 L")).toBe(true);
    expect(path.getAttribute("d")?.endsWith("L 1 0")).toBe(true);
    expect(path.getAttribute("fill")).toBe("none");
    expect(path.getAttribute("stroke")).toBe("currentColor");
    curve.setAttribute("fill-to", "0");
    expect(path.getAttribute("fill")).toBe("currentColor");
    expect(path.getAttribute("d")?.endsWith("Z")).toBe(true);
  });

  test("a curve follows a logarithmic x axis", () => {
    const { root, shape } = renderPlot('min-x="10" scale-x="log"');
    const curve = root.querySelector("audio-ui-plot-curve") as PlotCurveElement;
    curve.fn = (x) => x / 10;
    const points = (shape("audio-ui-plot-curve").getAttribute("d") ?? "")
      .replace("M ", "")
      .split(" L ")
      .map((point) => point.split(" ").map(Number));
    // Halfway along a log axis from 10 to 100 is about 31.6, where y = 3.16 of 10.
    const middle = points.find(([along]) => (along ?? 0) >= 0.5);
    expect(middle?.[1]).toBeCloseTo(1 - 0.316, 1);
  });

  test("a line stands vertical at an x value and horizontal at a y value", () => {
    const { shape } = renderPlot();
    const vertical = shape("audio-ui-plot-line", 0);
    expect(vertical.getAttribute("x1")).toBe("0.25");
    expect(vertical.getAttribute("x2")).toBe("0.25");
    expect(vertical.getAttribute("y2")).toBe("1");
    const horizontal = shape("audio-ui-plot-line", 1);
    expect(horizontal.getAttribute("y1")).toBe("0.5");
    expect(horizontal.getAttribute("x2")).toBe("1");
  });

  test("a band spans a stretch of one axis and all of the other, and follows its attributes", () => {
    const { root, shape } = renderPlot();
    const band = shape("audio-ui-plot-band");
    expect(band.getAttribute("x")).toBe("0.2");
    expect(band.getAttribute("width")).toBe("0.4");
    expect(band.getAttribute("height")).toBe("1");
    root.querySelector("audio-ui-plot-band")?.setAttribute("to", "80");
    expect(band.getAttribute("width")).toBe("0.6");
  });

  test("a mark is placed at its value along its axis, hidden from assistive technology", () => {
    const { root } = renderPlot();
    const [across, down] =
      root.querySelectorAll<HTMLElement>("audio-ui-plot-mark");
    expect(across?.style.left).toBe("25%");
    expect(down?.style.top).toBe("50%");
    expect(down?.getAttribute("data-axis")).toBe("y");
    expect(across?.getAttribute("aria-hidden")).toBe("true");
    expect(across?.textContent).toBe("25");
  });

  test("the axes follow the plot's attributes", () => {
    const { root, shape } = renderPlot();
    root.setAttribute("max-x", "50");
    expect(shape("audio-ui-plot-line", 0).getAttribute("x1")).toBe("0.5");
  });
});

describe("the plot's live parts", () => {
  test("a trace draws its source spread across the plot, and follows it", () => {
    document.body.innerHTML = `
      <audio-ui-plot max-y="10">
        <audio-ui-plot-trace></audio-ui-plot-trace>
      </audio-ui-plot>`;
    const trace = document.querySelector(
      "audio-ui-plot-trace"
    ) as PlotTraceElement;
    const source = createSource<ArrayLike<number>>([0, 5, 10]);
    trace.source = source;
    const path = trace.querySelector("path") as Element;
    expect(path.getAttribute("d")).toBe("M 0 1 L 0.5 0.5 L 1 0");
    source.set([10, 10, 10]);
    expect(path.getAttribute("d")).toBe("M 0 0 L 0.5 0 L 1 0");
    trace.setAttribute("max", "20");
    expect(path.getAttribute("d")).toBe("M 0 0.5 L 0.5 0.5 L 1 0.5");
  });

  test("a trace stops listening to its source when it leaves the page", () => {
    document.body.innerHTML = `
      <audio-ui-plot><audio-ui-plot-trace></audio-ui-plot-trace></audio-ui-plot>`;
    const trace = document.querySelector(
      "audio-ui-plot-trace"
    ) as PlotTraceElement;
    const listeners = new Set<() => void>();
    trace.source = {
      getSnapshot: () => [0, 1],
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    expect(listeners.size).toBe(1);
    trace.remove();
    expect(listeners.size).toBe(0);
    document.querySelector("audio-ui-plot")?.appendChild(trace);
    expect(listeners.size).toBe(1);
  });

  test("a dot sits at its value, or at its source's point as it moves", () => {
    document.body.innerHTML = `
      <audio-ui-plot max-x="100" max-y="10">
        <audio-ui-plot-dot value="25 5"></audio-ui-plot-dot>
      </audio-ui-plot>`;
    const dot = document.querySelector("audio-ui-plot-dot") as PlotDotElement;
    expect(dot.style.left).toBe("25%");
    expect(dot.style.top).toBe("50%");
    const source = createSource({ x: 50, y: 10 });
    dot.source = source;
    expect(dot.style.left).toBe("50%");
    expect(dot.style.top).toBe("0%");
    source.set({ x: 100, y: 0 });
    expect(dot.style.left).toBe("100%");
    expect(dot.getAttribute("aria-hidden")).toBe("true");
  });

  test("the cursor follows the pointer in CSS variables, its readout says what is under it, and both leave with it", () => {
    document.body.innerHTML = `
      <audio-ui-plot max-x="100" max-y="10">
        <audio-ui-plot-cursor>
          <audio-ui-plot-cursor-readout></audio-ui-plot-cursor-readout>
        </audio-ui-plot-cursor>
      </audio-ui-plot>`;
    const root = document.querySelector("audio-ui-plot") as PlotElement;
    mockRect(root, { bottom: 100, height: 100, right: 200, width: 200 });
    const cursor = root.querySelector("audio-ui-plot-cursor") as HTMLElement;
    const readout = root.querySelector(
      "audio-ui-plot-cursor-readout"
    ) as PlotCursorReadoutElement;
    pointer(root, "pointermove", {
      clientX: 50,
      clientY: 20,
      pointerType: "mouse",
    });
    expect(cursor.style.getPropertyValue("--plot-cursor-x")).toBe("25%");
    expect(cursor.style.getPropertyValue("--plot-cursor-y")).toBe("20%");
    expect(cursor.hasAttribute("data-active")).toBe(true);
    expect(readout.textContent).toBe("25, 8");
    readout.format = ({ x, y }) => `${x} Hz, ${y} dB`;
    expect(readout.textContent).toBe("25 Hz, 8 dB");
    pointer(root, "pointermove", {
      clientX: 100,
      clientY: 20,
      pointerType: "touch",
    });
    expect(readout.textContent).toBe("25 Hz, 8 dB");
    root.dispatchEvent(new PointerEvent("pointerleave"));
    expect(cursor.hasAttribute("data-active")).toBe(false);
    expect(readout.textContent).toBe("");
  });

  test("valueAt turns a pointer position into a value, kept within the axes", () => {
    const { root } = renderPlot();
    expect(root.valueAt(50, 20)).toEqual({ x: 25, y: 8 });
    expect(root.valueAt(-40, 300)).toEqual({ x: 0, y: 0 });
  });
});

describe("the plot's grid", () => {
  function renderGrid(attributes: string, plot = 'max-x="100" max-y="10"') {
    document.body.innerHTML = `
      <audio-ui-plot ${plot}>
        <audio-ui-plot-grid ${attributes}></audio-ui-plot-grid>
      </audio-ui-plot>`;
    const grid = document.querySelector(
      "audio-ui-plot-grid"
    ) as PlotGridElement;
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

  test("draws lines and labels at round values on both axes, hidden from assistive technology", () => {
    const { grid, labels, lines } = renderGrid("");
    expect(grid.getAttribute("aria-hidden")).toBe("true");
    expect(labels("x")).toEqual(["0", "20", "40", "60", "80", "100"]);
    expect(lines("x")[1]?.getAttribute("x1")).toBe("0.2");
    expect(labels("y")).toEqual(["0", "2", "4", "6", "8", "10"]);
  });

  test("draws only the axis it is given, at the ticks it is given, formatted as asked", () => {
    const { grid, labels, lines } = renderGrid('axis="y" y-ticks="2, 8"');
    expect(lines("x")).toHaveLength(0);
    expect(labels("y")).toEqual(["2", "8"]);
    grid.format = (value, axis) => `${value} ${axis === "y" ? "dB" : "Hz"}`;
    expect(labels("y")).toEqual(["2 dB", "8 dB"]);
  });

  test("puts labels at their value, can leave them out, and marks the line at zero", () => {
    const { grid, labels, lines } = renderGrid('x-ticks="25" y-ticks="0 10"');
    const across = grid.querySelector(
      '[data-part="label"][data-axis="x"]'
    ) as HTMLElement;
    expect(across.style.left).toBe("25%");
    expect(lines("y")[0]?.hasAttribute("data-zero")).toBe(true);
    expect(lines("y")[1]?.hasAttribute("data-zero")).toBe(false);
    grid.setAttribute("labels", "y");
    expect(labels("x")).toHaveLength(0);
    expect(lines("x")).toHaveLength(1);
    grid.setAttribute("labels", "none");
    expect(labels("y")).toHaveLength(0);
  });

  test("follows a logarithmic axis by powers of ten", () => {
    const { labels } = renderGrid(
      'axis="x" x-count="6"',
      'min-x="20" max-x="20000" scale-x="log"'
    );
    expect(labels("x")).toEqual(["100", "1k", "10k"]);
  });
});

describe("the plot's handle", () => {
  test("sits at its value, with a named slider per axis", () => {
    const { handle, inputs } = renderPlot();
    expect(handle.style.left).toBe("50%");
    expect(handle.style.top).toBe("50%");
    expect(inputs().map((input) => input.getAttribute("aria-label"))).toEqual([
      "Band X",
      "Band Y",
    ]);
    expect(handle.hasAttribute("aria-label")).toBe(false);
    expect(inputs()[1]?.tabIndex).toBe(-1);
    expect(inputs()[0]?.getAttribute("aria-valuetext")).toBe("50");
    expect(handle.getAttribute("data-axis")).toBe("both");
  });

  test("moves from where it is, never jumping to the pointer, and commits", () => {
    const { changes, commits, handle } = renderPlot();
    // 40px right is 20 units; 20px up is 2 units.
    drag(handle, [100, 50], [140, 30]);
    expect(changes.at(-1)).toEqual([{ x: 70, y: 7 }, "drag"]);
    expect(commits.at(-1)).toEqual([{ x: 70, y: 7 }, "drag"]);
    expect(handle.style.left).toBe("70%");
  });

  test("holds to one axis when asked, with one input named after it", () => {
    const { commits, handle, inputs } = renderPlot(
      "",
      'axis="x" default-value="50 5"'
    );
    expect(inputs()).toHaveLength(1);
    expect(inputs()[0]?.getAttribute("aria-label")).toBe("Band");
    drag(handle, [100, 50], [140, 10]);
    expect(commits.at(-1)?.[0]).toEqual({ x: 70, y: 5 });
  });

  test("moves a hundredth of the axis with the arrow keys, and a double click resets it", () => {
    const { changes, commits, handle, inputs } = renderPlot();
    key(inputs()[0] as HTMLInputElement, "ArrowRight");
    expect(commits.at(-1)?.[0].x).toBeCloseTo(51);
    expect(commits.at(-1)?.[1]).toBe("keyboard");
    handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(changes.at(-1)).toEqual([{ x: 50, y: 5 }, "reset"]);
  });

  test("a value set from outside follows the drag, and preventDefault() refuses a move", () => {
    const { handle } = renderPlot("", 'value="50 5"');
    drag(handle, [100, 50], [140, 50]);
    expect(handle.style.left).toBe("70%");
    handle.setAttribute("aria-describedby", "help");
    expect(handle.style.left).toBe("70%");
    handle.addEventListener("input", (event) => event.preventDefault());
    drag(handle, [140, 50], [180, 50]);
    expect(handle.style.left).toBe("70%");
  });

  test("ignores everything when the plot is disabled", () => {
    const { changes, handle, inputs } = renderPlot("disabled");
    drag(handle, [100, 50], [140, 50]);
    key(inputs()[0] as HTMLInputElement, "ArrowRight");
    expect(changes).toHaveLength(0);
    expect(handle.hasAttribute("data-disabled")).toBe(true);
    expect(inputs()[0]?.disabled).toBe(true);
  });

  test("getAriaValueText writes what each input announces", () => {
    const { handle, inputs, root } = renderPlot();
    handle.getAriaValueText = (value, axis) => `${axis}=${value}`;
    root.paint();
    expect(inputs()[1]?.getAttribute("aria-valuetext")).toBe("y=5");
  });
});
