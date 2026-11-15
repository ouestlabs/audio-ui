import { act } from "react";
import { createRoot } from "react-dom/client";
import { Meter } from "@/registry-audio/bases/base/primitives/meter/react.tsx";
import { decibels, meterSuite } from "./meter-suite.ts";

meterSuite("React", async ({ labels, marks, options }) => {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  await act(() => {
    root.render(
      <Meter.Root aria-label="Output" {...options}>
        {({ channelCount }) => (
          <>
            {(marks ?? []).map((mark) => (
              <Meter.Mark key={mark} value={mark} />
            ))}
            {Array.from({ length: channelCount }, (_, index) => (
              <Meter.Channel
                aria-label={`Output ${index + 1}`}
                getAriaValueText={decibels}
                index={index}
                key={index}
              >
                <Meter.Track>
                  <Meter.Indicator />
                  <Meter.Peak />
                </Meter.Track>
                {labels ? <Meter.Label>Channel</Meter.Label> : null}
                <Meter.Value />
              </Meter.Channel>
            ))}
          </>
        )}
      </Meter.Root>
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
