import { describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Piano } from "@/registry/primitives/piano/react/index.tsx";
import { PianoRoll } from "@/registry/primitives/piano-roll/react/index.tsx";
import { mockRect, pointer } from "./helpers.ts";

const notes = [
  { id: "a", length: 1, pitch: 60, start: 0 },
  { id: "b", length: 1, pitch: 62, start: 1 },
];

async function render(onNoteOn?: (pitch: number) => void) {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  await act(() => {
    root.render(
      <PianoRoll.Root
        duration={4}
        maxPitch={64}
        minPitch={60}
        onNoteOn={onNoteOn}
        value={notes}
      >
        <PianoRoll.Keys>
          {({ active, keyOff, keyOn, pitches }) => (
            <Piano.Root
              activeNotes={active}
              layout="even"
              onNoteOff={keyOff}
              onNoteOn={keyOn}
              orientation="vertical"
              pitches={pitches}
            >
              {({ pitches: drawn }) =>
                drawn.map((pitch) => <Piano.Key key={pitch} pitch={pitch} />)
              }
            </Piano.Root>
          )}
        </PianoRoll.Keys>
        <PianoRoll.Grid>
          <PianoRoll.Notes>
            {(note) => <PianoRoll.Note note={note} />}
          </PianoRoll.Notes>
        </PianoRoll.Grid>
      </PianoRoll.Root>
    );
  });
  return { container, unmount: () => act(() => root.unmount()) };
}

describe("PianoRoll.Keys over a Piano", () => {
  test("renders a key for each pitch without looping", async () => {
    const { container, unmount } = await render();
    expect(container.querySelectorAll('[data-slot="piano-key"]').length).toBe(
      5
    );
    await unmount();
  });

  test("a key sounds its pitch, and Shift selects the notes on its row", async () => {
    const sounded: number[] = [];
    const { container, unmount } = await render((pitch) => sounded.push(pitch));
    const piano = container.querySelector('[data-slot="piano"]') as Element;
    // A 100×100 keyboard of five keys, the lowest pitch at the bottom.
    mockRect(piano, { bottom: 100, height: 100, right: 100, width: 100 });
    const at = { clientX: 50, clientY: 90, pointerId: 1 };
    await act(() => pointer(piano, "pointerdown", at));
    expect(sounded).toEqual([60]);
    await act(() => pointer(piano, "pointerup", at));
    await act(() => {
      pointer(piano, "pointerdown", { ...at, shiftKey: true });
      pointer(piano, "pointerup", { ...at, shiftKey: true });
    });
    expect(
      container.querySelector('[data-note="a"]')?.hasAttribute("data-selected")
    ).toBe(true);
    await unmount();
  });
});
