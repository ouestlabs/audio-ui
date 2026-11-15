import { act } from "react";
import { createRoot } from "react-dom/client";
import { Timeline } from "@/registry-audio/bases/base/primitives/timeline/react.tsx";
import { timelineSuite } from "./timeline-suite.ts";

timelineSuite("React", async (tree) => {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  const inner = (
    <>
      {tree.playhead ? <Timeline.Playhead /> : null}
      {tree.mark ? <Timeline.Mark {...tree.mark} /> : null}
      {tree.clip ? (
        <Timeline.Clip
          aria-label={tree.clip.label}
          clip={tree.clip.clip}
          defaultValue={tree.clip.defaultValue}
        >
          <Timeline.ClipHeader clip={tree.clip.clip} />
          <Timeline.ClipFade clip={tree.clip.clip} edge="in" />
          <Timeline.ClipFade clip={tree.clip.clip} edge="out" />
          <Timeline.ClipHandle clip={tree.clip.clip} edge="start" />
          <Timeline.ClipHandle clip={tree.clip.clip} edge="end" />
          <Timeline.ClipFadeHandle
            aria-label="Fade in"
            clip={tree.clip.clip}
            edge="in"
          />
          <Timeline.ClipFadeHandle clip={tree.clip.clip} edge="out" />
        </Timeline.Clip>
      ) : null}
    </>
  );
  await act(() => {
    root.render(
      <Timeline.Root {...(tree.options as object)}>
        <Timeline.Viewport>
          {tree.ruler ? (
            <Timeline.Ruler aria-label={tree.ruler.label}>
              {tree.lane ? null : inner}
            </Timeline.Ruler>
          ) : null}
          {tree.lane ? (
            <Timeline.Lane {...tree.lane}>{inner}</Timeline.Lane>
          ) : null}
          {tree.track ? (
            <Timeline.Track height={tree.track.height} track={tree.track.track}>
              <Timeline.TrackResizeHandle
                aria-label={tree.track.label}
                track={tree.track.track}
              />
            </Timeline.Track>
          ) : null}
        </Timeline.Viewport>
      </Timeline.Root>
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
