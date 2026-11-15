import { createApp, h, nextTick } from "vue";
import { Pad } from "@/registry-audio/bases/base/primitives/pad/vue.ts";
import { padSuite } from "./pad-suite.ts";

padSuite("Vue", async ({ options, pads }) => {
  const container = document.body.appendChild(document.createElement("div"));
  const app = createApp({
    render: () =>
      h(Pad.Root, options, () =>
        pads.map((pad) =>
          h(
            Pad.Item,
            {
              chokeGroup: pad.chokeGroup,
              disabled: pad.disabled,
              key: pad.value,
              value: pad.value,
            },
            () => pad.value
          )
        )
      ),
  });
  app.mount(container);
  await nextTick();
  return {
    act: async (interact) => {
      interact();
      await nextTick();
    },
    container,
    unmount: () => {
      app.unmount();
      container.remove();
    },
  };
});
