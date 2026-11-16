import { createApp, h, nextTick } from "vue";
import { Meter } from "@/registry-audio/bases/base/primitives/meter/vue/index.ts";
import { decibels, meterSuite } from "./meter-suite.ts";

meterSuite("Vue", async ({ labels, marks, options }) => {
  const container = document.body.appendChild(document.createElement("div"));
  const app = createApp({
    render: () =>
      h(
        Meter.Root,
        { "aria-label": "Output", ...options },
        {
          default: ({ state }: { state: { channelCount: number } }) => [
            ...(marks ?? []).map((mark) =>
              h(Meter.Mark, { key: mark, value: mark })
            ),
            ...Array.from({ length: state.channelCount }, (_, index) =>
              h(
                Meter.Channel,
                {
                  "aria-label": `Output ${index + 1}`,
                  getAriaValueText: decibels,
                  index,
                  key: index,
                },
                () => [
                  h(Meter.Track, null, () => [
                    h(Meter.Indicator),
                    h(Meter.Peak),
                  ]),
                  labels ? h(Meter.Label, null, () => "Channel") : null,
                  h(Meter.Value),
                ]
              )
            ),
          ],
        }
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
