import { describe, expect, mock, test } from "bun:test";
import { pad } from "../src/pad/index.ts";

/** The pad grid with no framework: three pads registered as the elements of a document. */
function instance(options: Record<string, unknown> = {}) {
  const onPadOn = mock(
    (
      _value: string,
      _details: { source?: string; velocity: number; cancel: () => void }
    ) => undefined
  );
  const onPadOff = mock(
    (_value: string, _details: { reason: string }) => undefined
  );
  const grid = pad({
    columns: 3,
    id: "p",
    onPadOff,
    onPadOn,
    ...options,
  } as never);
  const elements = ["kick", "snare", "hat"].map((value) => {
    const el = document.createElement("button");
    document.body.appendChild(el);
    grid.api.register(value, el, () => ({ value }));
    return el;
  });
  return { elements, grid, onPadOff, onPadOn };
}

const key = () => new KeyboardEvent("keydown", { key: "Enter" });

describe("the pad primitive", () => {
  test("a strike sounds the pad, with a velocity and where it came from", () => {
    const { grid, onPadOn } = instance();
    grid.api.controller.keyOn({ value: "kick" }, key());
    const [value, details] = onPadOn.mock.calls[0] ?? [];
    expect(value).toBe("kick");
    expect(details?.velocity).toBe(0.8);
    expect(details?.source).toBe("keyboard");
    expect(grid.get().view.active.has("kick")).toBe(true);
  });

  test("a strike an app refuses is silent", () => {
    const { grid } = instance({
      onPadOn: (_value: string, details: { cancel: () => void }) =>
        details.cancel(),
    });
    grid.api.controller.keyOn({ value: "kick" }, key());
    expect(grid.get().view.active.has("kick")).toBe(false);
  });

  test("a release stops the pad", () => {
    const { grid, onPadOff } = instance();
    grid.api.controller.keyOn({ value: "kick" }, key());
    grid.api.controller.keyOff(
      "kick",
      new KeyboardEvent("keyup", { key: "Enter" })
    );
    expect(onPadOff.mock.calls[0]?.[0]).toBe("kick");
    expect(grid.get().view.active.has("kick")).toBe(false);
  });

  test("a pad of a choke group stops the last one struck", () => {
    const { grid, onPadOff } = instance();
    grid.api.controller.keyOn({ chokeGroup: "hats", value: "snare" }, key());
    grid.api.controller.keyOn({ chokeGroup: "hats", value: "hat" }, key());
    expect(onPadOff.mock.calls.map(([value, d]) => [value, d.reason])).toEqual([
      ["snare", "choke"],
    ]);
  });

  test("pads lit from elsewhere are active, and the arrow keys walk the grid", () => {
    const { grid } = instance({ activePads: ["hat"] });
    expect(grid.get().view.active.has("hat")).toBe(true);
    const next = grid.api.controller.navigate(
      "kick",
      new KeyboardEvent("keydown", { key: "ArrowRight" })
    );
    expect(next).toBe("snare");
  });
});
