import { createApp, h, nextTick } from "vue";
import { Sequencer } from "@/registry-audio/bases/base/primitives/sequencer/vue.ts";
import { sequencerSuite } from "./sequencer-suite.ts";

sequencerSuite("Vue", async ({ options, velocityBars }) => {
  const container = document.body.appendChild(document.createElement("div"));
  const app = createApp({
    render: () =>
      h(Sequencer.Root, options, {
        default: ({ state }: { state: { rows: number; steps: number } }) =>
          Array.from({ length: state.rows }, (_, row) =>
            h(Sequencer.Row, { index: row, key: row }, () => [
              ...Array.from({ length: state.steps }, (_, step) =>
                h(Sequencer.Cell, { key: step, row, step })
              ),
              ...(velocityBars
                ? Array.from({ length: state.steps }, (_, step) =>
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
