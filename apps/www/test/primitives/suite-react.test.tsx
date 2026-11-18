import { act } from "react";
import { createRoot } from "react-dom/client";
import { Knob } from "@/registry/bases/shared/primitives/knob/react/index.tsx";
import { knobSuite } from "./knob-suite.ts";

knobSuite("React", async ({ label, options, provider, thumbLabel }) => {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  const knob = (
    <Knob.Root {...options}>
      {label ? <Knob.Label>{label}</Knob.Label> : null}
      <Knob.Control>
        <Knob.Track />
        <Knob.Indicator />
        <Knob.Thumb aria-label={thumbLabel} />
      </Knob.Control>
      <Knob.Value />
    </Knob.Root>
  );
  await act(() => {
    root.render(
      provider ? <Knob.Provider {...provider}>{knob}</Knob.Provider> : knob
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
