import { act } from "react";
import { createRoot } from "react-dom/client";
import { PianoRoll } from "@/registry/bases/shared/primitives/piano-roll/react/index.tsx";
import { pianoRollSuite } from "./piano-roll-suite.ts";

pianoRollSuite("React", async (tree) => {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  await act(() => {
    root.render(
      <PianoRoll.Root {...(tree.options as object)}>
        <PianoRoll.Grid>
          <PianoRoll.Rows>
            {(pitch) => <PianoRoll.Row pitch={pitch} />}
          </PianoRoll.Rows>
          <PianoRoll.SelectionSpan>
            <PianoRoll.StretchHandle edge="start" />
            <PianoRoll.StretchHandle edge="end" />
          </PianoRoll.SelectionSpan>
          <PianoRoll.Notes>
            {(note) => (
              <PianoRoll.Note note={note}>
                <PianoRoll.NoteHandle edge="start" note={note} />
                <PianoRoll.NoteHandle edge="end" note={note} />
              </PianoRoll.Note>
            )}
          </PianoRoll.Notes>
          <PianoRoll.Marquee />
        </PianoRoll.Grid>
        <PianoRoll.VelocityLane>
          <PianoRoll.Notes>
            {(note) => <PianoRoll.Velocity note={note} />}
          </PianoRoll.Notes>
        </PianoRoll.VelocityLane>
      </PianoRoll.Root>
    );
  });
  return {
    act: async (interact) => {
      await act(() => {
        interact();
      });
    },
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
});
