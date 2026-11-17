import { createParts } from "@ui-sdk/vue/primitive";
import { defineComponent, h } from "vue";
import { timeline } from "@/primitives/timeline";

/** Which element each part is. */
const parts = createParts(timeline, {
  clip: "div",
  clipFadeIn: "svg",
  clipFadeInHandle: "div",
  clipFadeInInput: "input",
  clipFadeOut: "svg",
  clipFadeOutHandle: "div",
  clipFadeOutInput: "input",
  clipHeader: "div",
  clipInput: "input",
  clipTrimEnd: "div",
  clipTrimEndInput: "input",
  clipTrimStart: "div",
  clipTrimStartInput: "input",
  lane: "div",
  mark: "div",
  navigator: "div",
  navigatorEnd: "div",
  navigatorEndInput: "input",
  navigatorStart: "div",
  navigatorStartInput: "input",
  navigatorWindow: "div",
  navigatorWindowInput: "input",
  range: "div",
  rangeEnd: "div",
  rangeEndInput: "input",
  rangeInput: "input",
  rangeStart: "div",
  rangeStartInput: "input",
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

/**
 * A stretch of a source laid on a lane: a recording, a pattern. Its parts
 * (the header, the handles, the fades) take the same `clip` name. Its own
 * native `<input type="range">` moves it from the keyboard and carries its
 * name, unless it is not `movable`.
 */
const Clip = defineComponent(
  (
    props: {
      clip: string;
      getAriaValueText?: (value: number, duration: number) => string;
      movable?: boolean;
    },
    { attrs, slots }
  ) =>
    () => {
      const { naming, rest } = nameOf(attrs);
      const movable = props.movable ?? true;
      return h(parts.Clip, { ...rest, clip: props.clip, movable } as never, {
        default: (scope: object) => [
          slots.default?.(scope),
          movable
            ? h(parts.ClipInput, {
                ...naming,
                clip: props.clip,
                getAriaValueText: props.getAriaValueText,
              } as never)
            : null,
        ],
      });
    },
  {
    inheritAttrs: false,
    name: "TimelineClip",
    props: ["clip", "getAriaValueText", "movable"],
  }
);

/** An edge of a clip with the input it holds: a trim handle or a fade handle. */
const edged = (
  name: string,
  pick: (edge: string) => { handle: object; input: object }
) =>
  defineComponent(
    (
      props: {
        clip: string;
        edge: string;
        getAriaValueText?: (value: number, duration: number) => string;
      },
      { attrs, slots }
    ) =>
      () => {
        const { naming, rest } = nameOf(attrs);
        const { handle, input } = pick(props.edge);
        return h(handle as never, { ...rest, clip: props.clip } as never, {
          default: (scope: object) => [
            slots.default?.(scope),
            h(
              input as never,
              {
                ...naming,
                clip: props.clip,
                getAriaValueText: props.getAriaValueText,
              } as never
            ),
          ],
        });
      },
    {
      inheritAttrs: false,
      name,
      props: ["clip", "edge", "getAriaValueText"],
    }
  );

/** Trims one edge of the clip, by dragging or from the keyboard through its native input: it moves where in the source the clip begins instead of stretching it. */
const ClipHandle = edged("TimelineClipHandle", (edge) =>
  edge === "start"
    ? { handle: parts.ClipTrimStart, input: parts.ClipTrimStartInput }
    : { handle: parts.ClipTrimEnd, input: parts.ClipTrimEndInput }
);

/** Sets one fade of the clip, by dragging or from the keyboard through its native input. A double click, or Enter, steps its shape. */
const ClipFadeHandle = edged("TimelineClipFadeHandle", (edge) =>
  edge === "in"
    ? { handle: parts.ClipFadeInHandle, input: parts.ClipFadeInInput }
    : { handle: parts.ClipFadeOutHandle, input: parts.ClipFadeOutInput }
);

/** Shades a fade of the clip: its curve, in a 1 by 1 box. Style its `color` for the line, and `--clip-fade-shade` for the fill. */
const ClipFade = defineComponent(
  (props: { clip: string; edge: "in" | "out" }, { attrs }) =>
    () =>
      h(
        props.edge === "in" ? parts.ClipFadeIn : parts.ClipFadeOut,
        { ...attrs, clip: props.clip } as never,
        {
          default: ({ state }: { state: { fill: string; line: string } }) => [
            h("path", {
              d: state.fill,
              style: { fill: "var(--clip-fade-shade, currentColor)" },
            }),
            h("path", {
              d: state.line,
              fill: "none",
              stroke: "currentColor",
              "stroke-width": 1.5,
              style: { vectorEffect: "non-scaling-stroke" },
            }),
          ],
        }
      ),
  { inheritAttrs: false, name: "TimelineClipFade", props: ["clip", "edge"] }
);

/** The stretch the viewport shows, inside the navigator: dragging it scrolls. Its native input moves it from the keyboard. */
const NavigatorWindow = defineComponent(
  (
    props: { getAriaValueText?: (value: number, duration: number) => string },
    { attrs, slots }
  ) =>
    () => {
      const { naming, rest } = nameOf(attrs);
      return h(parts.NavigatorWindow, rest as never, {
        default: (scope: object) => [
          slots.default?.(scope),
          h(parts.NavigatorWindowInput, {
            ...naming,
            getAriaValueText: props.getAriaValueText,
          } as never),
        ],
      });
    },
  {
    inheritAttrs: false,
    name: "TimelineNavigatorWindow",
    props: ["getAriaValueText"],
  }
);

/** An edge with the input it holds, for the navigator and for a range. */
const bordered = (
  name: string,
  pick: (edge: string) => { handle: object; input: object },
  keyed?: string
) =>
  defineComponent(
    (
      props: {
        edge: string;
        getAriaValueText?: (value: number, duration: number) => string;
        range?: string;
      },
      { attrs, slots }
    ) =>
      () => {
        const { naming, rest } = nameOf(attrs);
        const { handle, input } = pick(props.edge);
        const own = keyed ? { [keyed]: props.range } : {};
        return h(handle as never, { ...rest, ...own } as never, {
          default: (scope: object) => [
            slots.default?.(scope),
            h(
              input as never,
              {
                ...naming,
                ...own,
                getAriaValueText: props.getAriaValueText,
              } as never
            ),
          ],
        });
      },
    {
      inheritAttrs: false,
      name,
      props: ["edge", "getAriaValueText", "range"],
    }
  );

/** An edge of the navigator's window: dragging it zooms, holding the other edge still. */
const NavigatorHandle = bordered("TimelineNavigatorHandle", (edge) =>
  edge === "start"
    ? { handle: parts.NavigatorStart, input: parts.NavigatorStartInput }
    : { handle: parts.NavigatorEnd, input: parts.NavigatorEndInput }
);

/** Resizes one edge of a range, by dragging or from the keyboard through its native input. */
const RangeHandle = bordered(
  "TimelineRangeHandle",
  (edge) =>
    edge === "start"
      ? { handle: parts.RangeStart, input: parts.RangeStartInput }
      : { handle: parts.RangeEnd, input: parts.RangeEndInput },
  "range"
);

/**
 * A stretch laid over a lane, such as a loop or a selection. Its edges take
 * the same `range` name. Its own native `<input type="range">` moves it from
 * the keyboard and carries its name, unless it is not `movable`.
 */
const Range = defineComponent(
  (
    props: {
      getAriaValueText?: (value: number, duration: number) => string;
      movable?: boolean;
      range: string;
    },
    { attrs, slots }
  ) =>
    () => {
      const { naming, rest } = nameOf(attrs);
      const movable = props.movable ?? true;
      return h(parts.Range, { ...rest, movable, range: props.range } as never, {
        default: (scope: object) => [
          slots.default?.(scope),
          movable
            ? h(parts.RangeInput, {
                ...naming,
                getAriaValueText: props.getAriaValueText,
                range: props.range,
              } as never)
            : null,
        ],
      });
    },
  {
    inheritAttrs: false,
    name: "TimelineRange",
    props: ["getAriaValueText", "movable", "range"],
  }
);

export const Timeline = {
  Clip,
  ClipFade,
  ClipFadeHandle,
  ClipHandle,
  ClipHeader: parts.ClipHeader,
  Lane: parts.Lane,
  Mark,
  Navigator: parts.Navigator,
  NavigatorHandle,
  NavigatorWindow,
  Playhead: parts.Playhead,
  Range,
  RangeHandle,
  Root: parts.Root,
  Ruler,
  Track: parts.Track,
  TrackHeader: parts.TrackHeader,
  TrackResizeHandle,
  Viewport: parts.Viewport,
};
