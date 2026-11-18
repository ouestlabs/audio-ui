import { act } from "react";
import { createRoot } from "react-dom/client";
import { Waveform } from "@/registry/bases/shared/primitives/waveform/react/index.tsx";
import { waveformSuite } from "./waveform-suite.ts";

waveformSuite("React", async (tree) => {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  const { region } = tree;
  await act(() => {
    root.render(
      <Waveform.Root {...(tree.options as object)}>
        {tree.control ? (
          <Waveform.Control aria-label={tree.control.label} />
        ) : null}
        {tree.playhead ? <Waveform.Playhead /> : null}
        {tree.thumb ? <Waveform.Thumb /> : null}
        {tree.marker ? <Waveform.Marker {...tree.marker} /> : null}
        {tree.hover ? <Waveform.Hover {...tree.hover} /> : null}
        {tree.bars ? <Waveform.Bars {...tree.bars} /> : null}
        {tree.canvas ? <Waveform.Canvas /> : null}
        {region ? (
          <Waveform.Region
            defaultValue={region.defaultValue as never}
            region={region.region}
            value={region.value as never}
          >
            <Waveform.RegionHandle
              aria-label={region.label ? `${region.label} start` : undefined}
              edge="start"
              region={region.region}
            />
            <Waveform.RegionHandle
              aria-label={region.label ? `${region.label} end` : undefined}
              edge="end"
              region={region.region}
            />
          </Waveform.Region>
        ) : null}
      </Waveform.Root>
    );
  });
  return {
    act: async (interact) => {
      await act(() => {
        interact();
      });
    },
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
});
