import { expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Knob } from "@/registry/bases/shared/primitives/knob/react/index.tsx";

test("a mark is a layer over the dial, turned to its value", async () => {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  await act(() =>
    root.render(
      <Knob.Root defaultValue={0} max={100} min={0}>
        <Knob.Control>
          <Knob.Thumb aria-label="Gain" />
        </Knob.Control>
        <Knob.Mark value={100} />
      </Knob.Root>
    )
  );
  const style = container
    .querySelector('[data-slot="knob-mark"]')
    ?.getAttribute("style");
  expect(style).toContain("position: absolute");
  expect(style).toContain("inset: 0");
  expect(style).toContain("pointer-events: none");
  expect(style).toContain("--knob-mark-angle");
  await act(() => root.unmount());
});
