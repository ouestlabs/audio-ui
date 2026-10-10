import { describe, expect, test } from "bun:test";
import { act, render } from "@testing-library/react";
import { Plot } from "../../../../plot";
import { createSource } from "../../../../source";
import { LINEAR_SCALE } from "../../../internal/parameter-scale";
import { tracePath } from "../../internal/path";

const y = { max: 10, min: 0, scale: LINEAR_SCALE };

function renderLive(onRender?: () => void) {
  const trace = createSource<ArrayLike<number>>([0, 10]);
  const dot = createSource({ x: 0, y: 0 });
  function Parts() {
    onRender?.();
    return (
      <>
        <Plot.Graph>
          <Plot.Trace data-testid="trace" source={trace} />
        </Plot.Graph>
        <Plot.Dot data-testid="dot" source={dot} />
      </>
    );
  }
  const view = render(
    <Plot.Root maxX={100} maxY={10} minX={0} minY={0}>
      <Parts />
    </Plot.Root>
  );
  return { dot, trace, view };
}

describe("tracePath", () => {
  test("spreads the values evenly across the axis, y going up", () => {
    expect(tracePath([0, 5, 10], y)).toBe("M 0 1 L 0.5 0.5 L 1 0");
  });

  test("puts a value that is not a number on the floor, and nothing on no values", () => {
    expect(tracePath([Number.NaN, 10], y)).toBe("M 0 1 L 1 0");
    expect(tracePath([], y)).toBe("");
  });

  test("closes down to fillTo for an area", () => {
    expect(tracePath([10, 10], y, 0)).toBe("M 0 0 L 1 0 L 1 1 L 0 1 Z");
  });
});

describe("Plot.Trace", () => {
  test("draws the source and follows it without re-rendering", () => {
    let renders = 0;
    const { trace, view } = renderLive(() => {
      renders += 1;
    });
    const path = view.getByTestId("trace");
    expect(path.getAttribute("d")).toBe("M 0 1 L 1 0");
    const before = renders;
    act(() => trace.set([10, 5, 0]));
    expect(path.getAttribute("d")).toBe("M 0 0 L 0.5 0.5 L 1 1");
    act(() => trace.set([5, 5]));
    expect(path.getAttribute("d")).toBe("M 0 0.5 L 1 0.5");
    expect(renders).toBe(before);
  });

  test("can be on a scale of its own", () => {
    const own = createSource<ArrayLike<number>>([-100, -50]);
    const view = render(
      <Plot.Root maxX={100} maxY={18} minX={0} minY={-18}>
        <Plot.Graph>
          <Plot.Trace data-testid="own" max={0} min={-100} source={own} />
        </Plot.Graph>
      </Plot.Root>
    );
    expect(view.getByTestId("own").getAttribute("d")).toBe("M 0 1 L 1 0.5");
  });

  test("follows an array updated in place", () => {
    const { trace, view } = renderLive();
    const values = new Float32Array([0, 0]);
    act(() => trace.set(values));
    values[1] = 10;
    act(() => trace.set(values));
    expect(view.getByTestId("trace").getAttribute("d")).toBe("M 0 1 L 1 0");
  });

  test("stops listening when it unmounts", () => {
    const { trace, view } = renderLive();
    let listeners = 0;
    const original = trace.subscribe;
    trace.subscribe = (listener) => {
      listeners += 1;
      const stop = original(listener);
      return () => {
        listeners -= 1;
        stop();
      };
    };
    view.unmount();
    expect(listeners).toBe(0);
  });
});

describe("Plot.Dot", () => {
  test("sits at the source's point and follows it in the DOM", () => {
    const { dot, view } = renderLive();
    const element = view.getByTestId("dot");
    expect(element.style.left).toBe("0%");
    expect(element.style.top).toBe("100%");
    expect(element.getAttribute("aria-hidden")).toBe("true");
    act(() => dot.set({ x: 50, y: 5 }));
    expect(element.style.left).toBe("50%");
    expect(element.style.top).toBe("50%");
  });

  test("holds a still value without a source", () => {
    const view = render(
      <Plot.Root maxX={100} maxY={10} minX={0} minY={0}>
        <Plot.Dot data-testid="still" value={{ x: 25, y: 10 }} />
      </Plot.Root>
    );
    const element = view.getByTestId("still");
    expect(element.style.left).toBe("25%");
    expect(element.style.top).toBe("0%");
  });
});
