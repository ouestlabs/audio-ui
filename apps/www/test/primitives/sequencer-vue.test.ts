import { createApp, h, nextTick } from "vue";
import { Sequencer } from "@/registry/bases/shared/primitives/sequencer/vue/index.ts";
import { range } from "./helpers.ts";
import { sequencerSuite } from "./sequencer-suite.ts";

sequencerSuite("Vue", async ({ options, velocityBars }) => {
  const container = document.body.appendChild(document.createElement("div"));
  const app = createApp({
    render: () =>
      h(Sequencer.Root, options, {
        default: ({ state }: { state: { rows: number; steps: number } }) =>
          range(state.rows).map((row) =>
            h(Sequencer.Row, { index: row, key: row }, () => [
              ...range(state.steps).map((step) =>
                h(Sequencer.Cell, { key: step, row, step })
              ),
              ...(velocityBars
                ? range(state.steps).map((step) =>
                    h(Sequencer.Velocity, { key: step, row, step })
                  )
                : []),
            ])
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
