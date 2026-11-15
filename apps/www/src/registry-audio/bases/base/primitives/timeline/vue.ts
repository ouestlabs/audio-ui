import { timeline } from "@audio-ui/primitives/timeline";
import { createParts } from "@ui-sdk/vue/primitive";
import { defineComponent, h } from "vue";

/** Which element each part is. */
const parts = createParts(timeline, {
  lane: "div",
  mark: "div",
  playhead: "div",
  root: "div",
  ruler: "div",
  rulerInput: "input",
  track: "div",
  trackHeader: "div",
  trackResizeHandle: "div",
  trackResizeInput: "input",
  viewport: "div",
});

const NAMING = ["aria-describedby", "aria-label", "aria-labelledby"] as const;

/** The accessible name given to a part goes to the input it holds. */
const nameOf = (attrs: Record<string, unknown>) => {
  const naming: Record<string, unknown> = {};
  const rest: Record<string, unknown> = { ...attrs };
  for (const key of NAMING) {
    naming[key] = rest[key];
    delete rest[key];
  }
  return { naming, rest };
};

/**
 * The lane that moves the position: a press jumps to the pointer and a drag
 * scrubs, on the grid unless Cmd/Ctrl is held. It holds the native
 * `<input type="range">` that takes focus and the keys and carries the name.
 */
const Ruler = defineComponent(
  (
    props: { getAriaValueText?: (value: number, duration: number) => string },
    { attrs, slots }
  ) =>
    () => {
      const { naming, rest } = nameOf(attrs);
      return h(parts.Ruler, rest as never, {
        default: (scope: object) => [
          slots.default?.(scope),
          h(parts.RulerInput, {
            ...naming,
            getAriaValueText: props.getAriaValueText,
          } as never),
        ],
      });
    },
  { inheritAttrs: false, name: "TimelineRuler", props: ["getAriaValueText"] }
);

/** Sets the track's height: by dragging, or from the keyboard through its native input. A double-click gives the height up. */
const TrackResizeHandle = defineComponent(
  (props: { track: string }, { attrs, slots }) =>
    () => {
      const { naming, rest } = nameOf(attrs);
      return h(
        parts.TrackResizeHandle,
        { ...rest, track: props.track } as never,
        {
          default: (scope: object) => [
            slots.default?.(scope),
            h(parts.TrackResizeInput, {
              ...naming,
              track: props.track,
            } as never),
          ],
        }
      );
    },
  {
    inheritAttrs: false,
    name: "TimelineTrackResizeHandle",
    props: ["track"],
  }
);

/** A point of interest at a `value`. With `movable`, a drag or the arrows move it. The `mark` name defaults to the value. */
const Mark = defineComponent(
  (props: { mark?: string; value: number }, { attrs, slots }) =>
    () =>
      h(
        parts.Mark,
        {
          ...attrs,
          mark: props.mark ?? String(props.value),
          value: props.value,
        } as never,
        slots
      ),
  { inheritAttrs: false, name: "TimelineMark", props: ["mark", "value"] }
);

export const Timeline = {
  Lane: parts.Lane,
  Mark,
  Playhead: parts.Playhead,
  Root: parts.Root,
  Ruler,
  Track: parts.Track,
  TrackHeader: parts.TrackHeader,
  TrackResizeHandle,
  Viewport: parts.Viewport,
};
