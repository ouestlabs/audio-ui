import { act } from "react";
import { createRoot } from "react-dom/client";
import { Envelope } from "@/registry/bases/base/primitives/envelope/react/index.tsx";
import { envelopeSuite } from "./envelope-suite.ts";
import { range } from "./helpers.ts";

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
            {range(value.length).map((index) => (
              <Envelope.Point
                aria-label={`Point ${index + 1}`}
                index={index}
                key={index}
              />
            ))}
            {range(value.length - 1).map((index) => (
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
