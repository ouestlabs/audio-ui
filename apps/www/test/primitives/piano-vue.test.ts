import { createApp, h, nextTick } from "vue";
import { Piano } from "@/registry-audio/bases/base/primitives/piano/vue.ts";
import { pianoSuite } from "./piano-suite.ts";

pianoSuite("Vue", async ({ labels, options }) => {
  const container = document.body.appendChild(document.createElement("div"));
  const app = createApp({
    render: () =>
      h(Piano.Root, options, {
        default: ({ state }: { state: { pitches: number[] } }) =>
          state.pitches.map((pitch) =>
            h(Piano.Key, { key: pitch, pitch }, () =>
              labels ? h(Piano.Label) : null
            )
          ),
      }),
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
