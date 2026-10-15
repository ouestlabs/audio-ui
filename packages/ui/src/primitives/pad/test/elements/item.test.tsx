import { describe, expect, test } from "bun:test";
import { fireEvent } from "@testing-library/react";
import { lastCall, renderPad } from "../helpers.tsx";

describe("Pad.Item", () => {
  test("is a button named by its content", () => {
    const { pad } = renderPad();
    expect(pad("kick").tagName).toBe("BUTTON");
    expect(pad("kick").textContent).toBe("kick");
  });

  test("puts the single tab stop on the first enabled pad", () => {
    const { pad, pads } = renderPad({ disabledPads: ["kick"] });
    expect(pads.filter((element) => element.tabIndex === 0)).toEqual([
      pad("snare"),
    ]);
  });

  test("walks the pads with the arrows, a row with up and down, the ends with Home and End", () => {
    const { pad } = renderPad();
    fireEvent.keyDown(pad("kick"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(pad("snare"));
    expect(pad("snare").tabIndex).toBe(0);
    expect(pad("kick").tabIndex).toBe(-1);
    fireEvent.keyDown(pad("snare"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(pad("open"));
    fireEvent.keyDown(pad("open"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(pad("open"));
    fireEvent.keyDown(pad("open"), { key: "Home" });
    expect(document.activeElement).toBe(pad("kick"));
    fireEvent.keyDown(pad("kick"), { key: "End" });
    expect(document.activeElement).toBe(pad("open"));
  });

  test("steps over a disabled pad", () => {
    const { pad } = renderPad({ disabledPads: ["snare"] });
    fireEvent.keyDown(pad("kick"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(pad("clap"));
  });

  test("sounds while Enter or Space is held", () => {
    const { onPadOff, onPadOn, pad } = renderPad();
    fireEvent.keyDown(pad("kick"), { key: " " });
    fireEvent.keyDown(pad("kick"), { key: " ", repeat: true });
    expect(onPadOn).toHaveBeenCalledTimes(1);
    expect(lastCall(onPadOn)[1]).toMatchObject({
      reason: "keyboard",
      velocity: 0.8,
    });
    expect(pad("kick").hasAttribute("data-active")).toBe(true);

    fireEvent.keyUp(pad("kick"), { key: " " });
    expect(lastCall(onPadOff)).toMatchObject(["kick", { reason: "keyboard" }]);
    expect(pad("kick").hasAttribute("data-active")).toBe(false);
  });

  test("releases a held pad when it loses focus", () => {
    const { onPadOff, pad } = renderPad();
    fireEvent.keyDown(pad("kick"), { key: "Enter" });
    fireEvent.blur(pad("kick"));
    expect(lastCall(onPadOff)[0]).toBe("kick");
  });

  test("a disabled pad is silent, and is the only one", () => {
    const { onPadOn, pad } = renderPad({ disabledPads: ["kick"] });
    fireEvent.pointerDown(pad("kick"), { button: 0, pointerId: 1 });
    fireEvent.keyDown(pad("kick"), { key: "Enter" });
    expect(onPadOn).not.toHaveBeenCalled();
    expect(pad("kick").hasAttribute("data-disabled")).toBe(true);
    expect(pad("snare").hasAttribute("data-disabled")).toBe(false);
  });
});
