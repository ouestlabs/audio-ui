import { createApp, h, nextTick } from "vue";
import { Fader } from "@/registry/bases/shared/primitives/fader/vue/index.ts";
import { faderSuite } from "./fader-suite.ts";

faderSuite("Vue", async ({ label, marks, options, thumbLabel }) => {
  const container = document.body.appendChild(document.createElement("div"));
  const app = createApp({
    render: () =>
      h(Fader.Root, options, () => [
        label ? h(Fader.Label, null, () => label) : null,
        h(Fader.Control, null, () => [
          h(Fader.Track, null, () => [
            h(Fader.Indicator),
            ...(marks ?? []).map((mark) =>
              h(Fader.Mark, { key: mark, value: mark })
            ),
          ]),
          h(Fader.Thumb, { "aria-label": thumbLabel }),
        ]),
        h(Fader.Value),
      ]),
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
