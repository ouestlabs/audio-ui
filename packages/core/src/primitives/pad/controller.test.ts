import { describe, expect, mock, test } from "bun:test";
import {
  createPadController,
  KEYBOARD_VELOCITY,
  MIN_VELOCITY,
  type PadOffEventDetails,
  type PadOnEventDetails,
  type PadOptions,
  padTarget,
  strikeVelocity,
} from "./controller.ts";

const key = (name: string, extra: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent("keydown", { key: name, ...extra });

const VALUES = ["a", "b", "c", "d", "e", "f", "g", "h"];

const create = (options: Partial<PadOptions> = {}) => {
  const onPadOn = mock((_value: string, _details: PadOnEventDetails) => {
    /* recorded */
  });
  const onPadOff = mock((_value: string, _details: PadOffEventDetails) => {
    /* recorded */
  });
  const pads = createPadController({
    columns: 4,
    onPadOff,
    onPadOn,
    values: VALUES,
    ...options,
  });
  return { onPadOff, onPadOn, pads };
};

describe("strikeVelocity", () => {
  const rect = { height: 100, top: 0 };

  test("a mouse strike is harder toward the top of the pad", () => {
    const top = strikeVelocity(
      { clientY: 0, pointerType: "mouse", pressure: 0.5 },
      rect
    );
    const bottom = strikeVelocity(
      { clientY: 100, pointerType: "mouse", pressure: 0.5 },
      rect
    );
    expect(top).toBe(1);
    expect(bottom).toBe(MIN_VELOCITY);
  });

  test("a pointer that measures force strikes as hard as it presses", () => {
    const pen = strikeVelocity(
      { clientY: 100, pointerType: "pen", pressure: 1 },
      rect
    );
    expect(pen).toBe(1);
  });

  test("a touch reporting the unmeasured 0.5 falls back to where it lands", () => {
    const touch = strikeVelocity(
      { clientY: 50, pointerType: "touch", pressure: 0.5 },
      rect
    );
    expect(touch).toBeCloseTo(MIN_VELOCITY + (1 - MIN_VELOCITY) * 0.5);
  });

  test("a pad with no height strikes at the keyboard velocity", () => {
    const flat = strikeVelocity(
      { clientY: 0, pointerType: "mouse", pressure: 0.5 },
      { height: 0, top: 0 }
    );
    expect(flat).toBe(KEYBOARD_VELOCITY);
  });
});

describe("padTarget", () => {
  test("left and right step through the reading order, up and down by a row", () => {
    expect(padTarget(1, 8, 4, "ArrowRight")).toBe(2);
    expect(padTarget(3, 8, 4, "ArrowRight")).toBe(4);
    expect(padTarget(1, 8, 4, "ArrowDown")).toBe(5);
    expect(padTarget(5, 8, 4, "ArrowUp")).toBe(1);
    expect(padTarget(5, 8, 4, "Home")).toBe(0);
    expect(padTarget(5, 8, 4, "End")).toBe(7);
  });

  test("a key that would leave the grid, or does not move, gives null", () => {
    expect(padTarget(1, 8, 4, "ArrowUp")).toBeNull();
    expect(padTarget(7, 8, 4, "ArrowRight")).toBeNull();
    expect(padTarget(1, 8, 4, "a")).toBeNull();
  });
});

describe("Pad tab stop and navigation", () => {
  test("the tab stop starts on the first enabled pad and follows the focus", () => {
    const { pads } = create({ disabledValues: ["a"] });
    expect(pads.getSnapshot().tabStop).toBe("b");
    pads.focusPad("g");
    expect(pads.getSnapshot().tabStop).toBe("g");
  });

  test("arrows step over disabled pads in the direction they move", () => {
    const { pads } = create({ disabledValues: ["c", "f"] });
    expect(pads.navigate("b", key("ArrowRight"))).toBe("d");
    expect(pads.navigate("b", key("ArrowDown"))).toBeNull();
    expect(pads.navigate("e", key("ArrowRight"))).toBe("g");
    expect(pads.getSnapshot().tabStop).toBe("g");
  });

  test("Home and End land on the first and last enabled pads", () => {
    const { pads } = create({ disabledValues: ["a", "h"] });
    expect(pads.navigate("d", key("Home"))).toBe("b");
    expect(pads.navigate("d", key("End"))).toBe("g");
  });
});

describe("Pads struck from the keyboard", () => {
  test("Enter sounds a pad at the keyboard velocity until it is released", () => {
    const { onPadOff, onPadOn, pads } = create();
    pads.keyOn({ value: "a" }, key("Enter"));
    pads.keyOn({ value: "a" }, key("Enter", { repeat: true }));
    expect(onPadOn).toHaveBeenCalledTimes(1);
    expect(onPadOn.mock.calls[0]?.[1].velocity).toBe(KEYBOARD_VELOCITY);
    expect(onPadOn.mock.calls[0]?.[1].reason).toBe("keyboard");
    expect(pads.getSnapshot().active.has("a")).toBe(true);
    expect(pads.getSnapshot().velocities.get("a")).toBe(KEYBOARD_VELOCITY);

    pads.keyOff("a", key("Enter"));
    expect(onPadOff.mock.calls[0]?.[0]).toBe("a");
    expect(onPadOff.mock.calls[0]?.[1].reason).toBe("keyboard");
    expect(pads.getSnapshot().active.has("a")).toBe(false);
  });

  test("a cancelled strike stays silent and has nothing to release", () => {
    const { onPadOff, pads } = create({
      onPadOn: (_value, details) => details.cancel(),
    });
    pads.keyOn({ value: "a" }, key("Enter"));
    expect(pads.getSnapshot().active.has("a")).toBe(false);
    pads.keyOff("a", key("Enter"));
    expect(onPadOff).not.toHaveBeenCalled();
  });

  test("a disabled grid strikes nothing", () => {
    const { onPadOn, pads } = create({ disabled: true });
    pads.keyOn({ value: "a" }, key("Enter"));
    expect(onPadOn).not.toHaveBeenCalled();
  });

  test("pads lit from elsewhere are active too", () => {
    const { pads } = create({ activePads: ["c"] });
    expect(pads.getSnapshot().active.has("c")).toBe(true);
  });
});

describe("Choke groups", () => {
  const open = { chokeGroup: "hat", value: "open" };
  const closed = { chokeGroup: "hat", value: "closed" };

  test("striking a pad stops the last pad struck in its group, held or ringing", () => {
    const { onPadOff, pads } = create();
    pads.keyOn(open, key("Enter"));
    pads.keyOff("open", key("Enter"));
    onPadOff.mockClear();

    pads.keyOn(closed, key("Enter"));
    expect(onPadOff.mock.calls[0]?.[0]).toBe("open");
    expect(onPadOff.mock.calls[0]?.[1].reason).toBe("choke");
  });

  test("a held pad that is choked goes quiet, and its release fires nothing more", () => {
    const { onPadOff, pads } = create();
    pads.keyOn(open, key("Enter"));
    pads.keyOn(closed, key(" "));
    expect(pads.getSnapshot().active.has("open")).toBe(false);
    expect(pads.getSnapshot().active.has("closed")).toBe(true);
    onPadOff.mockClear();

    pads.keyOff("open", key("Enter"));
    expect(onPadOff).not.toHaveBeenCalled();
  });

  test("striking the same pad again, or a pad of another group, chokes nothing", () => {
    const { onPadOff, pads } = create();
    pads.keyOn(open, key("Enter"));
    pads.keyOff("open", key("Enter"));
    pads.keyOn(open, key("Enter"));
    pads.keyOn({ chokeGroup: "toms", value: "tom" }, key("Enter"));
    expect(
      onPadOff.mock.calls.filter(([, details]) => details.reason === "choke")
    ).toHaveLength(0);
  });
});
