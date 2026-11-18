import { createApp, h, nextTick } from "vue";
import { PianoRoll } from "@/registry/bases/base/primitives/piano-roll/vue/index.ts";
import { pianoRollSuite } from "./piano-roll-suite.ts";

pianoRollSuite("Vue", async (tree) => {
  const container = document.body.appendChild(document.createElement("div"));
  const app = createApp({
    render: () =>
      h(PianoRoll.Root, tree.options as never, () => [
        h(PianoRoll.Grid, null, () => [
          h(PianoRoll.Rows, null, {
            default: ({ pitch }: { pitch: number }) =>
              h(PianoRoll.Row, { pitch }),
          }),
          h(PianoRoll.SelectionSpan, null, () => [
            h(PianoRoll.StretchHandle, { edge: "start" }),
            h(PianoRoll.StretchHandle, { edge: "end" }),
          ]),
          h(PianoRoll.Notes, null, {
            default: ({ note }: { note: never }) =>
              h(PianoRoll.Note, { note } as never, () => [
                h(PianoRoll.NoteHandle, { edge: "start", note } as never),
                h(PianoRoll.NoteHandle, { edge: "end", note } as never),
              ]),
          }),
          h(PianoRoll.Marquee),
        ]),
        h(PianoRoll.VelocityLane, null, () =>
          h(PianoRoll.Notes, null, {
            default: ({ note }: { note: never }) =>
              h(PianoRoll.Velocity, { note } as never),
          })
        ),
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
