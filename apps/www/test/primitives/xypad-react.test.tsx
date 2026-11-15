import { act } from "react";
import { createRoot } from "react-dom/client";
import { XYPad } from "@/registry-audio/bases/base/primitives/xypad/react.tsx";
import { xypadSuite } from "./xypad-suite.ts";

xypadSuite("React", async ({ label, options, thumbLabel }) => {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  await act(() => {
    root.render(
      <XYPad.Root {...options}>
        {label ? <XYPad.Label>{label}</XYPad.Label> : null}
        <XYPad.Control>
          <XYPad.Thumb aria-label={thumbLabel} />
        </XYPad.Control>
        <XYPad.Value />
      </XYPad.Root>
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
