import { createApp, h, nextTick } from "vue";
import { Envelope } from "@/registry-audio/bases/base/primitives/envelope/vue/index.ts";
import { envelopeSuite } from "./envelope-suite.ts";

envelopeSuite("Vue", async ({ options }) => {
  const container = document.body.appendChild(document.createElement("div"));
  const app = createApp({
    render: () =>
      h(Envelope.Root, options, {
        default: ({ state }: { state: { value: unknown[] } }) => [
          h(Envelope.Graph, null, () => [h(Envelope.Fill), h(Envelope.Line)]),
          ...state.value.map((_, index) =>
            h(Envelope.Point, {
              "aria-label": `Point ${index + 1}`,
              index,
              key: index,
            })
          ),
          ...state.value.slice(0, -1).map((_, index) =>
            h(Envelope.Segment, {
              "aria-label": `Curve ${index + 1}`,
              index,
              key: index,
            })
          ),
        ],
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
