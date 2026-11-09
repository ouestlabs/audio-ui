import { describe, expect, mock, test } from "bun:test";
import {
  boxElement,
  dragWithSecondFinger,
  ONE_FINGER,
} from "../../../test/helpers.ts";
import {
  createNavigatorController,
  movedRange,
  type NavigatorMetrics,
  type NavigatorOptions,
  type NavigatorPart,
  rangeOfThumb,
  thumbOf,
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

describe("Navigator window with a least width", () => {
  const DURATION = 100;
  const BAR = 1000;
  const LEAST = 48;

  test("drawn as it is when wide, at the least width when the stretch is tiny, inside the bar", () => {
    expect(thumbOf([0, 100], DURATION, BAR, LEAST)).toEqual([0, 1000]);
    const [from, to] = thumbOf([50, 50.001], DURATION, BAR, LEAST);
    expect(to - from).toBeCloseTo(LEAST, 1);
    const [atEndFrom, atEndTo] = thumbOf([99.999, 100], DURATION, BAR, LEAST);
    expect(atEndTo).toBeCloseTo(BAR, 5);
    expect(atEndTo - atEndFrom).toBeCloseTo(LEAST, 1);
    const [wideFrom, wideTo] = thumbOf([20, 70], DURATION, BAR, LEAST);
    expect(wideTo - wideFrom).toBeCloseTo(500, -1);
    expect(wideTo - wideFrom).toBeGreaterThanOrEqual(500);
    expect(wideFrom).toBeGreaterThanOrEqual(0);
  });

  test("a window drawn gives back the stretch it was drawn from", () => {
    for (const range of [
      [0, 100],
      [20, 70],
      [50, 51],
      [99, 100],
      [0, 0.5],
    ] as const) {
      const back = rangeOfThumb(
        thumbOf(range, DURATION, BAR, LEAST),
        DURATION,
        BAR,
        LEAST
      );
      expect(back[0]).toBeCloseTo(range[0], 6);
      expect(back[1]).toBeCloseTo(range[1], 6);
    }
  });

  test("with no least width, it is the stretch itself", () => {
    expect(thumbOf([20, 70], DURATION, BAR, 0)).toEqual([200, 700]);
    expect(rangeOfThumb([200, 700], DURATION, BAR, 0)).toEqual([20, 70]);
  });

  /** A viewport that does what it is asked, as far as its closest zoom. */
  function live(startRange: readonly [number, number], maxZoom = 1000) {
    const laneWidth = 1000;
    const metrics: NavigatorMetrics = {
      origin: 0,
      scrollStart:
        startRange[0] * (laneWidth / (startRange[1] - startRange[0])),
      width: laneWidth,
      zoom: laneWidth / (startRange[1] - startRange[0]),
    };
    let held = 0;
    const controller = createNavigatorController({
      duration: DURATION,
      maxZoom,
      metrics: () => metrics,
      minWindowWidth: LEAST,
      scrollTo: (left) => {
        metrics.scrollStart = left;
      },
      zoomTo: (next, _details, anchor) => {
        const zoom = Math.min(maxZoom, next);
        if (zoom === metrics.zoom) {
          return false;
        }
        metrics.zoom = zoom;
        held = anchor.value;
        metrics.scrollStart = held * zoom;
        return true;
      },
    });
    const track = { getBoundingClientRect: () => ({ width: BAR }) } as Element;
    const thumb = () => thumbOf(controller.range(), DURATION, BAR, LEAST);
    const drag = (part: NavigatorPart, to: number) => {
      const fire = (type: string) =>
        document.dispatchEvent(
          Object.assign(new Event(type), {
            buttons: 1,
            clientX: to,
            pointerId: 1,
          })
        );
      controller.press(
        part,
        { button: 0, clientX: 0, pointerId: 1 } as PointerEvent,
        document.createElement("div"),
        track
      );
      fire("pointermove");
      fire("pointerup");
    };
    return { controller, drag, metrics, thumb };
  }

  test("the end handle dragged in follows the pointer and holds the start, down to the least width, and the zoom stops there", () => {
    const { drag, metrics, thumb } = live([20, 70], 100);
    const [from, to] = thumb();
    drag("end", -100);
    const [movedFrom, movedTo] = thumb();
    expect(movedFrom).toBeCloseTo(from, 3);
    expect(movedTo).toBeCloseTo(to - 100, 3);
    // Far past what it can reach: it stops at the closest zoom, and the view with it.
    drag("end", -5000);
    const stopped = metrics.zoom;
    expect(stopped).toBeCloseTo(100, 6);
    const [stoppedFrom] = thumb();
    expect(stoppedFrom).toBeCloseTo(from, 1);
    drag("end", -5000);
    expect(metrics.zoom).toBe(stopped);
    expect(thumb()[0]).toBeCloseTo(stoppedFrom, 4);
  });

  test("the start handle dragged in holds the end, and at the closest zoom nothing slides", () => {
    const { drag, thumb } = live([20, 70], 100);
    const [, to] = thumb();
    drag("start", 100);
    expect(thumb()[1]).toBeCloseTo(to, 3);
    drag("start", 5000);
    const [stoppedFrom, stoppedTo] = thumb();
    expect(stoppedTo).toBeCloseTo(to, 1);
    drag("start", 5000);
    expect(thumb()[0]).toBeCloseTo(stoppedFrom, 4);
    expect(thumb()[1]).toBeCloseTo(stoppedTo, 4);
  });

  test("the window dragged scrolls by what the pointer moved, as far as the end of the bar", () => {
    const { drag, thumb } = live([50, 51], 1000);
    const [from, to] = thumb();
    drag("window", 100);
    expect(thumb()[0]).toBeCloseTo(from + 100, 3);
    expect(thumb()[1]).toBeCloseTo(to + 100, 3);
    drag("window", 5000);
    expect(thumb()[1]).toBeCloseTo(BAR, 3);
  });

  test("from the closest zoom, a handle dragged out grows the window under the pointer, with no jump of it", () => {
    const { drag, thumb } = live([50, 50.05], 20_000);
    const [from, to] = thumb();
    expect(to - from).toBeCloseTo(LEAST, 0);
    drag("start", -10);
    expect(thumb()[0]).toBeCloseTo(from - 10, 2);
    expect(thumb()[1]).toBeCloseTo(to, 2);
  });
});

describe("Navigator pointers", () => {
  test("a second finger on the bar is ignored, and the first goes on moving the window", () => {
    // A fifth of the timeline shown, on a 100px bar.
    const { controller, scrollTo, zoomTo } = create(
      {},
      { origin: 0, scrollStart: 0, width: 200, zoom: 10 }
    );
    const bar = boxElement(100, 10);
    let part: NavigatorPart = "window";
    const result = dragWithSecondFinger({
      changes: () => scrollTo.mock.calls.length + zoomTo.mock.calls.length,
      commits: () => 0,
      first: [
        [10, 5],
        [20, 5],
        [30, 5],
      ],
      press: (event) => {
        controller.press(part, event, bar, bar);
        part = "start";
      },
      second: [
        [0, 5],
        [50, 5],
      ],
    });
    // The bar moves the view as it goes: there is nothing to commit.
    expect(result).toEqual({ ...ONE_FINGER, commits: 0 });
  });
});
