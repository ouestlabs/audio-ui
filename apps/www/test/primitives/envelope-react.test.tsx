import { act } from "react";
import { createRoot } from "react-dom/client";
import { Envelope } from "@/registry-audio/bases/base/primitives/envelope/react.tsx";
import { envelopeSuite } from "./envelope-suite.ts";

envelopeSuite("React", async ({ options }) => {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  await act(() => {
    root.render(
      <Envelope.Root {...options}>
        {({ value }) => (
          <>
            <Envelope.Graph>
              <Envelope.Fill />
              <Envelope.Line />
            </Envelope.Graph>
            {value.map((_, index) => (
              <Envelope.Point
                aria-label={`Point ${index + 1}`}
                index={index}
                key={index}
              />
            ))}
            {value.slice(0, -1).map((_, index) => (
              <Envelope.Segment
                aria-label={`Curve ${index + 1}`}
                index={index}
                key={index}
              />
            ))}
          </>
        )}
      </Envelope.Root>
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
