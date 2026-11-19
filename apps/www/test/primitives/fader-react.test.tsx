import { act } from "react";
import { createRoot } from "react-dom/client";
import { Fader } from "@/registry/primitives/fader/react/index.tsx";
import { faderSuite } from "./fader-suite.ts";

faderSuite("React", async ({ label, marks, options, thumbLabel }) => {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  await act(() => {
    root.render(
      <Fader.Root {...options}>
        {label ? <Fader.Label>{label}</Fader.Label> : null}
        <Fader.Control>
          <Fader.Track>
            <Fader.Indicator />
            {marks?.map((mark) => (
              <Fader.Mark key={mark} value={mark} />
            ))}
          </Fader.Track>
          <Fader.Thumb aria-label={thumbLabel} />
        </Fader.Control>
        <Fader.Value />
      </Fader.Root>
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
