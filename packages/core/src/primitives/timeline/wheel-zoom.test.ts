import { describe, expect, mock, test } from "bun:test";
import { createWheelZoom, WHEEL_ZOOM_SENSITIVITY } from "./wheel-zoom.ts";

// happy-dom drops the modifier keys of a WheelEvent init: a plain event carries what the zoom reads.
const wheel = (init: {
  ctrlKey?: boolean;
  deltaMode?: number;
  deltaY: number;
  clientX?: number;
}) =>
  ({
    clientX: init.clientX ?? 0,
    ctrlKey: init.ctrlKey ?? false,
    deltaMode: init.deltaMode ?? 0,
    deltaY: init.deltaY,
    metaKey: false,
    preventDefault: () => undefined,
  }) as unknown as WheelEvent;

const wait = () => new Promise((resolve) => setTimeout(resolve, 40));

const create = (options: { disabled?: boolean } = {}) => {
  const zoomTo = mock(
    (_next: number, _details: unknown, _anchor: unknown) => true
  );
  const zoom = createWheelZoom({
    drawnZoom: () => 10,
    duration: 100,
    origin: () => 0,
    zoomTo: zoomTo as never,
    ...options,
  });
  const element = document.createElement("div");
  return { element, zoom, zoomTo };
};

describe("Wheel zoom", () => {
  test("a bare wheel is left to scroll, and a disabled timeline ignores the wheel", () => {
    const { element, zoom, zoomTo } = create();
    expect(zoom.wheel(wheel({ deltaY: 40 }), element)).toBe(false);
    const disabled = create({ disabled: true });
    expect(
      disabled.zoom.wheel(
        wheel({ ctrlKey: true, deltaY: 40 }),
        disabled.element
      )
    ).toBe(false);
    expect(zoomTo).not.toHaveBeenCalled();
  });

  test("Cmd or Ctrl with the wheel zooms once per frame, by the summed delta, held on the pointer", async () => {
    const { element, zoom, zoomTo } = create();
    expect(zoom.wheel(wheel({ ctrlKey: true, deltaY: -3 }), element)).toBe(
      true
    );
    zoom.wheel(wheel({ ctrlKey: true, deltaY: -2 }), element);
    await wait();
    expect(zoomTo).toHaveBeenCalledTimes(1);
    const [next, , anchor] = zoomTo.mock.calls[0] as unknown as [
      number,
      unknown,
      { value: number },
    ];
    expect(next).toBeCloseTo(10 * Math.exp(5 * WHEEL_ZOOM_SENSITIVITY), 10);
    expect(anchor.value).toBeGreaterThanOrEqual(0);
  });

  test("a pinch goes from a whole sound to its samples in a few gestures", async () => {
    let drawn = 10;
    const zoom = createWheelZoom({
      drawnZoom: () => drawn,
      duration: 100,
      origin: () => 0,
      zoomTo: (next) => {
        drawn = next;
        return true;
      },
    });
    const element = document.createElement("div");
    // A trackpad's pinch, as Chrome sends it: -100 ln s of deltaY for a spread of s, here 3, a frame at a time.
    await Array.from({ length: 10 }).reduce<Promise<unknown>>(
      (previous) =>
        previous.then(() => {
          zoom.wheel(wheel({ ctrlKey: true, deltaY: -11 }), element);
          return wait();
        }),
      Promise.resolve()
    );
    // The zoom goes by the square of the spread: nine times in.
    expect(drawn / 10).toBeCloseTo(Math.exp(2.2), 6);
  });

  test("a frame zooms twice in or half out at most, whatever the wheel says", async () => {
    const { element, zoom, zoomTo } = create();
    zoom.wheel(wheel({ ctrlKey: true, deltaY: 1000 }), element);
    await wait();
    expect((zoomTo.mock.calls[0] as unknown as [number])[0]).toBeCloseTo(5, 10);
  });

  test("a wheel that counts in lines zooms as far as one that counts in pixels", async () => {
    const lines = create();
    lines.zoom.wheel(
      wheel({ ctrlKey: true, deltaMode: 1, deltaY: -1 }),
      lines.element
    );
    const pixels = create();
    pixels.zoom.wheel(wheel({ ctrlKey: true, deltaY: -16 }), pixels.element);
    await wait();
    expect((lines.zoomTo.mock.calls[0] as unknown as [number])[0]).toBeCloseTo(
      (pixels.zoomTo.mock.calls[0] as unknown as [number])[0],
      10
    );
  });

  test("a dispose drops the zoom waiting for its frame", async () => {
    const { element, zoom, zoomTo } = create();
    zoom.wheel(wheel({ ctrlKey: true, deltaY: 100 }), element);
    zoom.dispose();
    await wait();
    expect(zoomTo).not.toHaveBeenCalled();
  });
});
