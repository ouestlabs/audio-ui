import { createApp, h, nextTick } from "vue";
import { XYPad } from "@/registry/bases/base/primitives/xypad/vue/index.ts";
import { xypadSuite } from "./xypad-suite.ts";

xypadSuite("Vue", async ({ label, options, thumbLabel }) => {
  const container = document.body.appendChild(document.createElement("div"));
  const app = createApp({
    render: () =>
      h(XYPad.Root, options, () => [
        label ? h(XYPad.Label, null, () => label) : null,
        h(XYPad.Control, null, () => [
          h(XYPad.Thumb, { "aria-label": thumbLabel }),
        ]),
        h(XYPad.Value),
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
