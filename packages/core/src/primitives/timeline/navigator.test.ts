import { describe, expect, mock, test } from "bun:test";
import {
  createNavigatorController,
  movedRange,
  type NavigatorMetrics,
  type NavigatorOptions,
  visibleRange,
} from "./navigator.ts";

const key = (name: string, extra: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent("keydown", { key: name, ...extra });

const METRICS: NavigatorMetrics = {
  origin: 0,
  scrollStart: 0,
  width: 200,
  zoom: 2,
};

const create = (
  overrides: Partial<NavigatorOptions> = {},
  metrics = METRICS
) => {
  const scrollTo = mock((_left: number) => undefined);
  const zoomTo = mock(
    (_next: number, _details: unknown, _anchor: unknown) => true
  );
  const controller = createNavigatorController({
    duration: 100,
    metrics: () => metrics,
    scrollTo,
    zoomTo: zoomTo as never,
    ...overrides,
  });
  return { controller, scrollTo, zoomTo };
};

describe("Navigator geometry", () => {
  test("the visible range follows the scroll and the zoom, clamped to the timeline", () => {
    expect(visibleRange(METRICS, 100)).toEqual([0, 100]);
    expect(visibleRange({ ...METRICS, zoom: 4 }, 100)).toEqual([0, 50]);
    expect(
      visibleRange({ ...METRICS, zoom: 4, scrollStart: 200 }, 100)
    ).toEqual([50, 100]);
    expect(visibleRange({ ...METRICS, zoom: 0 }, 100)).toEqual([0, 100]);
  });

  test("a window keeps its span inside the timeline, an edge keeps its minimum span", () => {
    expect(movedRange("window", [10, 30], 90, 100)).toEqual([80, 100]);
    expect(movedRange("start", [10, 30], 50, 100)).toEqual([30 - 0.1, 30]);
    expect(movedRange("end", [10, 30], -50, 100)).toEqual([10, 10.1]);
  });
});

describe("Navigator keys and input", () => {
  test("a window key scrolls the viewport to where the window now starts", () => {
    const { controller, scrollTo } = create({}, { ...METRICS, zoom: 4 });
    expect(controller.keyDown("window", key("ArrowRight"))).toBe(true);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo.mock.calls[0]?.[0]).toBeCloseTo(2 * 4, 10);
  });

  test("an edge key zooms, holding the other edge in place", () => {
    const { controller, zoomTo } = create({}, { ...METRICS, zoom: 4 });
    expect(controller.keyDown("end", key("ArrowLeft"))).toBe(true);
    const [next, , anchor] = zoomTo.mock.calls[0] as unknown as [
      number,
      unknown,
      { value: number },
    ];
    expect(anchor.value).toBe(0);
    expect(next).toBeGreaterThan(2);
  });

  test("a key that is not the navigator's is left alone, and a disabled one ignores keys", () => {
    expect(create().controller.keyDown("window", key("a"))).toBe(false);
    expect(
      create({ disabled: true }).controller.keyDown("window", key("ArrowRight"))
    ).toBe(false);
  });

  test("an input moves an edge to a value", () => {
    const { controller, zoomTo } = create({}, { ...METRICS, zoom: 4 });
    controller.typeAt("start", 10, new Event("input"));
    expect(zoomTo).toHaveBeenCalledTimes(1);
  });
});

describe("Navigator double click", () => {
  test("shows everything: the whole timeline is zoomed to the lane", () => {
    const { controller, zoomTo } = create({}, { ...METRICS, zoom: 4 });
    controller.doubleClick(new MouseEvent("dblclick"));
    expect(zoomTo).toHaveBeenCalledTimes(1);
    expect(zoomTo.mock.calls[0]?.[0]).toBeCloseTo(200 / 100, 10);
  });
});
