import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { PianoRoll } from "../../../../entries/piano-roll.ts";
import { drag, lastCall, NOTES, notesById, renderRoll } from "../helpers.tsx";

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

  test("says when notes are selected, and spans the time they cover", () => {
    const { root, view } = renderRoll({ defaultSelection: [] });
    expect(root.hasAttribute("data-has-selection")).toBe(false);
    expect(view.queryByTestId("span")).toBeNull();
    view.unmount();
    const selected = renderRoll({ defaultSelection: ["a", "b"] });
    expect(selected.root.hasAttribute("data-has-selection")).toBe(true);
    const span = selected.view.getByTestId("span");
    expect(span.style.getPropertyValue("--timeline-offset")).toBe("0");
    expect(span.style.getPropertyValue("--timeline-length")).toBe("8");
    expect(span.getAttribute("aria-hidden")).toBe("true");
  });

  test("marks a deactivated note and its velocity, and gives each note its chance", () => {
    const { note, view } = renderRoll({
      defaultValue: [
        { chance: 0.5, id: "a", length: 2, muted: true, pitch: 60, start: 0 },
      ],
    });
    expect(note("a").hasAttribute("data-muted")).toBe(true);
    expect(note("a").style.getPropertyValue("--piano-roll-chance")).toBe("0.5");
    expect(view.getByTestId("velocity-a").hasAttribute("data-muted")).toBe(
      true
    );
  });
});
