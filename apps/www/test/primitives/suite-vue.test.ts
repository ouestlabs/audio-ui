import { createApp, h, nextTick } from "vue";
import { Knob } from "@/registry-audio/bases/base/primitives/knob/vue/index.ts";
import { knobSuite } from "./knob-suite.ts";

knobSuite("Vue", async ({ label, options, provider, thumbLabel }) => {
  const container = document.body.appendChild(document.createElement("div"));
  const knob = () =>
    h(Knob.Root, options, () => [
      label ? h(Knob.Label, null, () => label) : null,
      h(Knob.Control, null, () => [
        h(Knob.Track),
        h(Knob.Indicator),
        h(Knob.Thumb, { "aria-label": thumbLabel }),
      ]),
      h(Knob.Value),
    ]);
  const app = createApp({
    render: () => (provider ? h(Knob.Provider, provider, knob) : knob()),
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
