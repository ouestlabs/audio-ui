import { describe, expect, test } from "bun:test";
import { fireEvent } from "@testing-library/react";
import { lastCall, renderPiano } from "../helpers.js";

describe("Piano.Key", () => {
  test("is a button named after its pitch, placed along the keyboard", () => {
    const { key } = renderPiano();
    expect(key(49).tagName).toBe("BUTTON");
    expect(key(49).getAttribute("aria-label")).toBe("C#3");
    expect(key(49).getAttribute("data-color")).toBe("black");
    expect(key(50).getAttribute("data-color")).toBe("white");
    expect(key(50).style.left).toBe("12.5%");
  });

  test("puts the single tab stop on middle C, or the lowest key without one", () => {
    const { key, keys } = renderPiano();
    expect(keys.filter((element) => element.tabIndex === 0)).toEqual([key(60)]);
  });

  test("walks the keys with the arrows, an octave with Shift, the ends with Home and End", () => {
    const { key } = renderPiano();
    fireEvent.keyDown(key(60), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(key(59));
    expect(key(59).tabIndex).toBe(0);
    expect(key(60).tabIndex).toBe(-1);
    fireEvent.keyDown(key(59), { key: "ArrowDown", shiftKey: true });
    expect(document.activeElement).toBe(key(48));
    fireEvent.keyDown(key(48), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(key(48));
    fireEvent.keyDown(key(48), { key: "End" });
    expect(document.activeElement).toBe(key(60));
    fireEvent.keyDown(key(60), { key: "Home" });
    expect(document.activeElement).toBe(key(48));
  });

  test("sounds while Enter or Space is held", () => {
    const { key, onNoteOff, onNoteOn } = renderPiano();
    fireEvent.keyDown(key(60), { key: " " });
    fireEvent.keyDown(key(60), { key: " ", repeat: true });
    expect(onNoteOn).toHaveBeenCalledTimes(1);
    expect(lastCall(onNoteOn)[1].reason).toBe("keyboard");
    expect(key(60).hasAttribute("data-active")).toBe(true);
    expect(onNoteOff).not.toHaveBeenCalled();

    fireEvent.keyUp(key(60), { key: " " });
    expect(lastCall(onNoteOff)).toMatchObject([60, { reason: "keyboard" }]);
    expect(key(60).hasAttribute("data-active")).toBe(false);
  });

  test("releases a held key when it loses focus", () => {
    const { key, onNoteOff } = renderPiano();
    fireEvent.keyDown(key(60), { key: "Enter" });
    fireEvent.blur(key(60));
    expect(lastCall(onNoteOff)[0]).toBe(60);
  });

  test("is out of the tab order and silent when disabled", () => {
    const { key, keys, onNoteOn } = renderPiano({ disabled: true });
    fireEvent.keyDown(key(60), { key: "Enter" });
    expect(onNoteOn).not.toHaveBeenCalled();
    expect(keys.every((element) => element.hasAttribute("disabled"))).toBe(
      true
    );
  });

  test("holds a label with its pitch name, hidden from assistive technology", () => {
    const { view } = renderPiano();
    const label = view.getByTestId("label-49");
    expect(label.textContent).toBe("C#3");
    expect(label.getAttribute("aria-hidden")).toBe("true");
  });
});
