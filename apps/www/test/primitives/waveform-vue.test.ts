import { createApp, h, nextTick } from "vue";
import { Waveform } from "@/registry-audio/bases/base/primitives/waveform/vue/index.ts";
import { waveformSuite } from "./waveform-suite.ts";

waveformSuite("Vue", async (tree) => {
  const container = document.body.appendChild(document.createElement("div"));
  const { region } = tree;
  const app = createApp({
    render: () =>
      h(Waveform.Root, tree.options as never, () => [
        tree.control
          ? h(Waveform.Control, { "aria-label": tree.control.label })
          : null,
        tree.playhead ? h(Waveform.Playhead) : null,
        tree.thumb ? h(Waveform.Thumb) : null,
        tree.marker ? h(Waveform.Marker, tree.marker) : null,
        tree.hover ? h(Waveform.Hover, tree.hover as never) : null,
        tree.bars ? h(Waveform.Bars, tree.bars) : null,
        tree.canvas ? h(Waveform.Canvas) : null,
        region
          ? h(
              Waveform.Region,
              {
                defaultValue: region.defaultValue,
                region: region.region,
                value: region.value,
              } as never,
              () => [
                h(Waveform.RegionHandle, {
                  "aria-label": region.label
                    ? `${region.label} start`
                    : undefined,
                  edge: "start",
                  region: region.region,
                }),
                h(Waveform.RegionHandle, {
                  "aria-label": region.label
                    ? `${region.label} end`
                    : undefined,
                  edge: "end",
                  region: region.region,
                }),
              ]
            )
          : null,
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
