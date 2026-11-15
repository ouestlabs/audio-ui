import { describe, expect, mock, test } from "bun:test";
import { plot } from "../src/plot/index.ts";

/** The plot with no framework: the kernel's instance, driven through its api. */
function instance(options: Record<string, unknown> = {}) {
  const onValueChange = mock(
    (
      _value: { x: number; y: number },
      _details: { handle: string; reason: string }
    ) => undefined
  );
  const onValueCommitted = mock(
    (_value: { x: number; y: number }, _details: { handle: string }) =>
      undefined
  );
  const surface = plot({
    id: "p",
    maxX: 20_000,
    maxY: 12,
    minX: 20,
    minY: -12,
    onValueChange,
    onValueCommitted,
    scaleX: "log",
    ...options,
  } as never);
  return { onValueChange, onValueCommitted, surface };
}

describe("the plot primitive", () => {
  test("holds the two axes, a logarithmic one spreading frequency by decade", () => {
    const { surface } = instance();
    const { axes } = surface.get();
    expect(axes.x.min).toBe(20);
    expect(axes.y.max).toBe(12);
    expect(axes.x.scale.toPosition(632.45, 20, 20_000)).toBeCloseTo(0.5, 2);
    expect(axes.y.scale.toPosition(0, -12, 12)).toBe(0.5);
  });

  test("a new range is the state it is given", () => {
    const { surface } = instance();
    surface.setOptions({ id: "p", maxX: 100, minX: 0 } as never);
    expect(surface.get().axes.x.max).toBe(100);
  });

  test("a handle keeps a controller of its own, named, and reports its changes through the root", () => {
    const { surface, onValueChange } = instance();
    const state = surface.get();
    const controller = surface.api.controllerFor(state, { handle: "low" });
    expect(surface.api.controllerFor(state, { handle: "low" })).toBe(
      controller
    );
    expect(surface.api.controllerFor(state, { handle: "high" })).not.toBe(
      controller
    );
    controller.typeAt("x", 0.25, new Event("change"));
    const [, details] = onValueChange.mock.calls[0] ?? [];
    expect(details?.handle).toBe("low");
    expect(details?.reason).toBe("input-change");
  });

  test("a change an app refuses is not applied", () => {
    const { surface } = instance({
      onValueChange: (_value: unknown, details: { cancel: () => void }) =>
        details.cancel(),
    });
    const controller = surface.api.controllerFor(surface.get(), {
      handle: "h",
    });
    const before = controller.getSnapshot().value;
    controller.typeAt("x", 0.9, new Event("change"));
    expect(controller.getSnapshot().value).toEqual(before);
  });

  test("a controlled handle follows the value it is given", () => {
    const { surface } = instance();
    const state = surface.get();
    const controller = surface.api.controllerFor(state, {
      handle: "h",
      value: { x: 200, y: 0 },
    });
    expect(controller.getSnapshot().value.x).toBeCloseTo(200, 3);
    surface.api.controllerFor(state, { handle: "h", value: { x: 2000, y: 6 } });
    expect(controller.getSnapshot().value.x).toBeCloseTo(2000, 3);
  });
});
