import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { PianoRoll } from "../../../../piano-roll";
import { drag, lastCall, NOTES, notesById, renderRoll } from "../helpers";

const NOTE_NAME = /to/;

describe("PianoRoll.Root", () => {
  test("counts its rows in --piano-roll-rows", () => {
    const { root } = renderRoll();
    expect(root.style.getPropertyValue("--piano-roll-rows")).toBe("4");
  });

  test("folds onto the pitches the notes use", () => {
    const { root, view } = renderRoll({ folded: true });
    expect(root.style.getPropertyValue("--piano-roll-rows")).toBe("2");
    expect(root.hasAttribute("data-folded")).toBe(true);
    expect(view.queryByTestId("row-61")).toBeNull();
  });

  test("must sit inside a timeline", () => {
    expect(() => render(<PianoRoll.Root />)).toThrow(
      "PianoRoll.Root must be used within Timeline.Root"
    );
  });

  test("places each note on the timeline and on its row", () => {
    const { note } = renderRoll();
    const b = note("b");
    expect(b.style.getPropertyValue("--timeline-offset")).toBe("4");
    expect(b.style.getPropertyValue("--timeline-length")).toBe("4");
    expect(b.style.getPropertyValue("--piano-roll-row")).toBe("1");
    expect(b.style.getPropertyValue("--piano-roll-velocity")).toBe("0.5");
  });

  test("renders the notes in reading order", () => {
    const { view } = renderRoll({
      defaultValue: [...NOTES].reverse(),
    });
    expect(
      view
        .getAllByRole("button", { name: NOTE_NAME })
        .map((element) => element.dataset.testid)
    ).toEqual(["note-a", "note-b"]);
  });

  test("follows the pointer while a controlled value lags, then shows the value again", () => {
    const { grid, note, onValueCommitted } = renderRoll({
      defaultValue: undefined,
      value: NOTES,
    });
    const a = note("a");
    drag(a, [5, 35], [37, 35]);
    expect(notesById(lastCall(onValueCommitted)[0]).a?.start).toBe(3);
    expect(a.style.getPropertyValue("--timeline-offset")).toBe("0");
    expect(grid.hasAttribute("data-editing")).toBe(false);
  });

  test("follows a controlled selection", () => {
    const { note } = renderRoll({ selection: ["b"] });
    expect(note("b").getAttribute("aria-pressed")).toBe("true");
    expect(note("a").getAttribute("aria-pressed")).toBe("false");
  });
});
