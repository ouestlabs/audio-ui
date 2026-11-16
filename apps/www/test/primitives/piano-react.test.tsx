import { act } from "react";
import { createRoot } from "react-dom/client";
import { Piano } from "@/registry-audio/bases/base/primitives/piano/react/index.tsx";
import { pianoSuite } from "./piano-suite.ts";

pianoSuite("React", async ({ labels, options }) => {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  await act(() => {
    root.render(
      <Piano.Root {...options}>
        {({ pitches }) =>
          pitches.map((pitch) => (
            <Piano.Key key={pitch} pitch={pitch}>
              {labels ? <Piano.Label /> : null}
            </Piano.Key>
          ))
        }
      </Piano.Root>
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
