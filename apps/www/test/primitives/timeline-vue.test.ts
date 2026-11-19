import { createApp, h, nextTick } from "vue";
import { Timeline } from "@/registry/primitives/timeline/vue/index.ts";
import { timelineSuite } from "./timeline-suite.ts";

timelineSuite("Vue", async (tree) => {
  const container = document.body.appendChild(document.createElement("div"));
  const inner = () => [
    tree.playhead ? h(Timeline.Playhead) : null,
    tree.mark ? h(Timeline.Mark, tree.mark as never) : null,
    tree.range
      ? h(
          Timeline.Range,
          {
            "aria-label": tree.range.label,
            defaultValue: tree.range.defaultValue,
            drawable: tree.range.drawable,
            range: tree.range.range,
          } as never,
          () => [
            h(Timeline.RangeHandle, {
              "aria-label": "Loop start",
              edge: "start",
              range: tree.range?.range,
            } as never),
            h(Timeline.RangeHandle, {
              "aria-label": "Loop end",
              edge: "end",
              range: tree.range?.range,
            } as never),
          ]
        )
      : null,
    tree.clip
      ? h(
          Timeline.Clip,
          {
            "aria-label": tree.clip.label,
            clip: tree.clip.clip,
            defaultValue: tree.clip.defaultValue,
          } as never,
          () => {
            const clip = tree.clip?.clip;
            return [
              h(Timeline.ClipHeader, { clip } as never),
              h(Timeline.ClipFade, { clip, edge: "in" } as never),
              h(Timeline.ClipFade, { clip, edge: "out" } as never),
              h(Timeline.ClipHandle, { clip, edge: "start" } as never),
              h(Timeline.ClipHandle, { clip, edge: "end" } as never),
              h(Timeline.ClipFadeHandle, { clip, edge: "in" } as never),
              h(Timeline.ClipFadeHandle, { clip, edge: "out" } as never),
            ];
          }
        )
      : null,
  ];
  const app = createApp({
    render: () =>
      h(Timeline.Root, tree.options as never, () => [
        tree.navigator
          ? h(Timeline.Navigator, null, () => [
              h(Timeline.NavigatorWindow, {
                "aria-label": tree.navigator?.label,
              }),
              h(Timeline.NavigatorHandle, {
                "aria-label": "Zoom start",
                edge: "start",
              }),
              h(Timeline.NavigatorHandle, {
                "aria-label": "Zoom end",
                edge: "end",
              }),
            ])
          : null,
        h(Timeline.Viewport, null, () => [
          tree.ruler
            ? h(Timeline.Ruler, { "aria-label": tree.ruler.label }, () =>
                tree.lane ? [] : inner()
              )
            : null,
          tree.lane ? h(Timeline.Lane, tree.lane, inner) : null,
          tree.track
            ? h(
                Timeline.Track,
                { height: tree.track.height, track: tree.track.track } as never,
                () => [
                  h(Timeline.TrackResizeHandle, {
                    "aria-label": tree.track?.label,
                    track: tree.track?.track,
                  } as never),
                ]
              )
            : null,
        ]),
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
