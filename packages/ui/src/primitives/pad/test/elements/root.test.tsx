import { describe, expect, test } from "bun:test";
import { fireEvent } from "@testing-library/react";
import { lastCall, renderPad } from "../helpers.tsx";

const strike = (y = 50, pointerId = 1) => ({
  button: 0,
  clientX: 50,
  clientY: y,
  pointerId,
  pointerType: "mouse",
});

describe("Pad.Root", () => {
  test("renders a group of pads", () => {
    const { pads, root } = renderPad();
    expect(root.getAttribute("role")).toBe("group");
    expect(pads).toHaveLength(6);
  });

  test("a pad sounds from the strike until the pointer is released", () => {
    const { onPadOff, onPadOn, pad } = renderPad();
    fireEvent.pointerDown(pad("kick"), strike());
    expect(lastCall(onPadOn)[0]).toBe("kick");
    expect(lastCall(onPadOn)[1].reason).toBe("press");
    expect(pad("kick").hasAttribute("data-active")).toBe(true);

    fireEvent.pointerUp(pad("kick"), strike());
    expect(lastCall(onPadOff)).toMatchObject(["kick", { reason: "press" }]);
    expect(pad("kick").hasAttribute("data-active")).toBe(false);
  });

  test("a strike near the top of a pad is harder, and shown in --pad-velocity", () => {
    const { onPadOn, pad } = renderPad();
    fireEvent.pointerDown(pad("kick"), strike(5));
    fireEvent.pointerUp(pad("kick"), strike(5));
    const hard = lastCall(onPadOn)[1].velocity;
    fireEvent.pointerDown(pad("kick"), strike(95, 2));
    const soft = lastCall(onPadOn)[1].velocity;
    expect(hard).toBeGreaterThan(soft);
    expect(pad("kick").style.getPropertyValue("--pad-velocity")).toBe(
      String(soft)
    );
  });

  test("each pointer holds its own pad", () => {
    const { pad } = renderPad();
    fireEvent.pointerDown(pad("kick"), strike(50, 1));
    fireEvent.pointerDown(pad("snare"), strike(50, 2));
    fireEvent.pointerUp(pad("kick"), strike(50, 1));
    expect(pad("kick").hasAttribute("data-active")).toBe(false);
    expect(pad("snare").hasAttribute("data-active")).toBe(true);
  });

  test("a cancelled strike stays silent, with nothing to release", () => {
    const { onPadOff, pad } = renderPad({
      onPadOn: (_value, details) => details.cancel(),
    });
    fireEvent.pointerDown(pad("kick"), strike());
    expect(pad("kick").hasAttribute("data-active")).toBe(false);
    fireEvent.pointerUp(pad("kick"), strike());
    expect(onPadOff).not.toHaveBeenCalled();
  });

  test("striking a hat chokes the other one, even after it was released", () => {
    const { onPadOff, pad } = renderPad();
    fireEvent.pointerDown(pad("open"), strike());
    fireEvent.pointerUp(pad("open"), strike());
    fireEvent.pointerDown(pad("closed"), strike(50, 2));
    expect(lastCall(onPadOff)).toMatchObject(["open", { reason: "choke" }]);
  });

  test("lights the activePads alongside the held ones", () => {
    const { pad } = renderPad({ activePads: ["clap"] });
    fireEvent.pointerDown(pad("kick"), strike());
    expect(pad("kick").hasAttribute("data-active")).toBe(true);
    expect(pad("clap").hasAttribute("data-active")).toBe(true);
    expect(pad("snare").hasAttribute("data-active")).toBe(false);
  });

  test("ignores the pointer when disabled", () => {
    const { onPadOn, pad, root } = renderPad({ disabled: true });
    fireEvent.pointerDown(pad("kick"), strike());
    expect(onPadOn).not.toHaveBeenCalled();
    expect(root.hasAttribute("data-disabled")).toBe(true);
  });
});
