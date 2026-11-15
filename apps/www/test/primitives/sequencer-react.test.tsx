import { act } from "react";
import { createRoot } from "react-dom/client";
import { Sequencer } from "@/registry-audio/bases/base/primitives/sequencer/react.tsx";
import { sequencerSuite } from "./sequencer-suite.ts";

sequencerSuite("React", async ({ options, velocityBars }) => {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  await act(() => {
    root.render(
      <Sequencer.Root {...options}>
        {({ rows, steps }) =>
          Array.from({ length: rows }, (_, row) => (
            <Sequencer.Row index={row} key={row}>
              {Array.from({ length: steps }, (_, step) => (
                <Sequencer.Cell key={step} row={row} step={step} />
              ))}
              {velocityBars
                ? Array.from({ length: steps }, (_, step) => (
                    <Sequencer.Velocity key={step} row={row} step={step} />
                  ))
                : null}
            </Sequencer.Row>
          ))
        }
      </Sequencer.Root>
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
