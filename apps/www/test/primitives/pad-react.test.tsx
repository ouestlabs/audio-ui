import { act } from "react";
import { createRoot } from "react-dom/client";
import { Pad } from "@/registry-audio/bases/base/primitives/pad/react/index.tsx";
import { padSuite } from "./pad-suite.ts";

padSuite("React", async ({ options, pads }) => {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  await act(() => {
    root.render(
      <Pad.Root {...options}>
        {pads.map((pad) => (
          <Pad.Item
            chokeGroup={pad.chokeGroup}
            disabled={pad.disabled}
            key={pad.value}
            value={pad.value}
          >
            {pad.value}
          </Pad.Item>
        ))}
      </Pad.Root>
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
