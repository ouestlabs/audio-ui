import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { mockRect } from "../../test/helpers";
import { Piano } from "../piano";

/** C3 (48) to C4 (60): 8 white keys, 5 black keys, 13 keys total. */
function renderPiano(props: Partial<Piano.RootProps> = {}) {
  const onNoteOn = mock(() => undefined);
  const onNoteOff = mock(() => undefined);
  const view = render(
    <Piano.Root
      endNote={60}
      onNoteOff={onNoteOff}
      onNoteOn={onNoteOn}
      startNote={48}
      {...props}
    >
      <Piano.Track data-testid="track">
        <Piano.Keys>
          {(note, _color, index) => (
            <Piano.Key data-testid={`key-${note}`} index={index} key={note} />
          )}
        </Piano.Keys>
      </Piano.Track>
    </Piano.Root>
  );
  return {
    keys: view.getAllByRole("button"),
    onNoteOff,
    onNoteOn,
    track: view.getByTestId("track"),
    view,
  };
}

describe("Piano key layout", () => {
  test("renders one key per note in [startNote, endNote]", () => {
    const { keys } = renderPiano();
    expect(keys).toHaveLength(13);
  });

  test("classifies white and black keys following the chromatic pattern from C", () => {
    const { view } = renderPiano();
    expect(view.getByTestId("key-48").getAttribute("data-color")).toBe("white"); // C3
    expect(view.getByTestId("key-49").getAttribute("data-color")).toBe("black"); // C#3
    expect(view.getByTestId("key-50").getAttribute("data-color")).toBe("white"); // D3
    expect(view.getByTestId("key-60").getAttribute("data-color")).toBe("white"); // C4
  });

  test("gives each key a default aria-label with its note name", () => {
    const { view } = renderPiano();
    expect(view.getByTestId("key-48").getAttribute("aria-label")).toBe("C3");
    expect(view.getByTestId("key-49").getAttribute("aria-label")).toBe("C#3");
    expect(view.getByTestId("key-60").getAttribute("aria-label")).toBe("C4");
  });

  test("positions white keys as equal, non-overlapping slots spanning 0-100%", () => {
    const { view } = renderPiano();
    const first = view.getByTestId("key-48") as HTMLElement;
    const second = view.getByTestId("key-50") as HTMLElement;
    expect(first.style.left).toBe("0%");
    expect(second.style.left).toBe("12.5%"); // 100 / 8 white keys
  });
});

describe("Piano pointer interaction", () => {
  test("pointer down on a key fires onNoteOn and marks it pressed", () => {
    const { track, view, onNoteOn } = renderPiano();
    mockRect(track, { height: 100, width: 800 });

    fireEvent.pointerDown(track, { clientX: 10, clientY: 80, pointerId: 1 });
    expect(onNoteOn).toHaveBeenLastCalledWith(48);
    expect(view.getByTestId("key-48").getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  test("pointer up releases the pressed key and fires onNoteOff", () => {
    const { track, view, onNoteOn, onNoteOff } = renderPiano();
    mockRect(track, { height: 100, width: 800 });

    fireEvent.pointerDown(track, { clientX: 10, clientY: 80, pointerId: 1 });
    fireEvent.pointerUp(track, { clientX: 10, clientY: 80, pointerId: 1 });
    expect(onNoteOn).toHaveBeenCalledTimes(1);
    expect(onNoteOff).toHaveBeenLastCalledWith(48);
    expect(view.getByTestId("key-48").getAttribute("aria-pressed")).toBe(
      "false"
    );
  });

  test("dragging across keys (glissando) releases the old note and triggers the new one", () => {
    const { track, onNoteOn, onNoteOff } = renderPiano();
    mockRect(track, { height: 100, width: 800 });

    // key-48 (C3, white slot 0 of 8: 0-12.5%) at x=10 (1.25%)
    fireEvent.pointerDown(track, { clientX: 10, clientY: 80, pointerId: 1 });
    expect(onNoteOn).toHaveBeenLastCalledWith(48);

    // key-50 (D3, white slot 1: 12.5-25%) at x=150 (18.75%)
    fireEvent.pointerMove(track, { clientX: 150, clientY: 80, pointerId: 1 });
    expect(onNoteOff).toHaveBeenLastCalledWith(48);
    expect(onNoteOn).toHaveBeenLastCalledWith(50);
  });

  test("two simultaneous pointers can hold two different keys (polyphony)", () => {
    const { track, view, onNoteOn } = renderPiano();
    mockRect(track, { height: 100, width: 800 });

    fireEvent.pointerDown(track, { clientX: 10, clientY: 80, pointerId: 1 });
    fireEvent.pointerDown(track, { clientX: 150, clientY: 80, pointerId: 2 });

    expect(onNoteOn).toHaveBeenCalledWith(48);
    expect(onNoteOn).toHaveBeenCalledWith(50);
    expect(view.getByTestId("key-48").getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(view.getByTestId("key-50").getAttribute("aria-pressed")).toBe(
      "true"
    );

    fireEvent.pointerUp(track, { clientX: 10, clientY: 80, pointerId: 1 });
    expect(view.getByTestId("key-48").getAttribute("aria-pressed")).toBe(
      "false"
    );
    expect(view.getByTestId("key-50").getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  test("ignores pointer input when disabled", () => {
    const { track, onNoteOn } = renderPiano({ disabled: true });
    mockRect(track, { height: 100, width: 800 });

    fireEvent.pointerDown(track, { clientX: 10, clientY: 80, pointerId: 1 });
    expect(onNoteOn).not.toHaveBeenCalled();
  });
});

describe("Piano activeNotes overlay", () => {
  test("lights up notes from activeNotes without a pointer press", () => {
    const { view } = renderPiano({ activeNotes: [52] });
    expect(view.getByTestId("key-52").getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(view.getByTestId("key-48").getAttribute("aria-pressed")).toBe(
      "false"
    );
  });

  test("merges activeNotes with pointer-pressed notes", () => {
    const { track, view } = renderPiano({ activeNotes: [52] });
    mockRect(track, { height: 100, width: 800 });

    fireEvent.pointerDown(track, { clientX: 10, clientY: 80, pointerId: 1 });
    expect(view.getByTestId("key-48").getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(view.getByTestId("key-52").getAttribute("aria-pressed")).toBe(
      "true"
    );
  });
});

describe("Piano keyboard", () => {
  test("ArrowRight/ArrowLeft move the roving focus between keys", () => {
    const { keys } = renderPiano();
    expect(keys[0]?.tabIndex).toBe(0);
    expect(keys[1]?.tabIndex).toBe(-1);

    fireEvent.keyDown(keys[0] as HTMLElement, { key: "ArrowRight" });
    expect(document.activeElement).toBe(keys[1] as HTMLElement);
    expect(keys[1]?.tabIndex).toBe(0);
    expect(keys[0]?.tabIndex).toBe(-1);

    fireEvent.keyDown(keys[1] as HTMLElement, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(keys[0] as HTMLElement);
  });

  test("Home/End jump to the first/last key", () => {
    const { keys } = renderPiano();
    fireEvent.keyDown(keys[0] as HTMLElement, { key: "End" });
    expect(document.activeElement).toBe(keys.at(-1) as HTMLElement);
    fireEvent.keyDown(keys.at(-1) as HTMLElement, { key: "Home" });
    expect(document.activeElement).toBe(keys[0] as HTMLElement);
  });

  test("Enter taps the focused key: fires onNoteOn then onNoteOff", () => {
    const { keys, onNoteOn, onNoteOff } = renderPiano();
    fireEvent.keyDown(keys[0] as HTMLElement, { key: "Enter" });
    expect(onNoteOn).toHaveBeenLastCalledWith(48);
    expect(onNoteOff).toHaveBeenLastCalledWith(48);
  });

  test("Space taps the focused key", () => {
    const { keys, onNoteOn, onNoteOff } = renderPiano();
    fireEvent.keyDown(keys[0] as HTMLElement, { key: " " });
    expect(onNoteOn).toHaveBeenLastCalledWith(48);
    expect(onNoteOff).toHaveBeenLastCalledWith(48);
  });

  test("ignores keys when disabled", () => {
    const { keys, onNoteOn } = renderPiano({ disabled: true });
    fireEvent.keyDown(keys[0] as HTMLElement, { key: "Enter" });
    expect(onNoteOn).not.toHaveBeenCalled();
    expect(keys[0]?.tabIndex).toBe(-1);
  });
});
