import { waveform } from "@audio-ui/primitives/waveform";
import { createParts } from "@ui-sdk/vue/primitive";
import { defineComponent, h } from "vue";

/** Which element each part is. */
const parts = createParts(waveform, {
  bar: "span",
  bars: "div",
  canvas: "canvas",
  control: "div",
  hover: "div",
  input: "input",
  marker: "div",
  playhead: "div",
  region: "div",
  regionEnd: "div",
  regionEndInput: "input",
  regionStart: "div",
  regionStartInput: "input",
  root: "div",
  thumb: "div",
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
 * The seekable surface: a press jumps to the pointer and a drag scrubs. It
 * holds the native `<input type="range">` that takes focus, handles the
 * keyboard and carries the accessible name. Leave it out for a waveform that
 * is only shown.
 */
const Control = defineComponent(
  (
    props: { getAriaValueText?: (value: number, duration: number) => string },
    { attrs, slots }
  ) =>
    () => {
      const { naming, rest } = nameOf(attrs);
      return h(parts.Control, rest as never, {
        default: (scope: object) => [
          slots.default?.(scope),
          h(parts.Input, {
            ...naming,
            getAriaValueText: props.getAriaValueText,
          } as never),
        ],
      });
    },
  { inheritAttrs: false, name: "WaveformControl", props: ["getAriaValueText"] }
);

/** The levels as a fixed number of elements, one `Waveform.Bar` each, styled in plain CSS from `--waveform-level`. */
const Bars = defineComponent(
  (props: { count?: number }, { attrs, slots }) =>
    () => {
      const count = props.count ?? 24;
      return h(parts.Bars, { ...attrs, count } as never, {
        default: () =>
          Array.from({ length: count }, (_, index) =>
            slots.default
              ? slots.default({ count, index })
              : h(parts.Bar, { index, key: index } as never)
          ),
      });
    },
  { inheritAttrs: false, name: "WaveformBars", props: ["count"] }
);

/** Resizes one edge of a region, by dragging or from the keyboard through its native input. */
const RegionHandle = defineComponent(
  (
    props: {
      edge: "end" | "start";
      getAriaValueText?: (value: number, duration: number) => string;
      region: string;
    },
    { attrs, slots }
  ) =>
    () => {
      const { naming, rest } = nameOf(attrs);
      const start = props.edge === "start";
      return h(
        start ? parts.RegionStart : parts.RegionEnd,
        { ...rest, region: props.region } as never,
        {
          default: (scope: object) => [
            slots.default?.(scope),
            h(start ? parts.RegionStartInput : parts.RegionEndInput, {
              ...naming,
              getAriaValueText: props.getAriaValueText,
              region: props.region,
            } as never),
          ],
        }
      );
    },
  {
    inheritAttrs: false,
    name: "WaveformRegionHandle",
    props: ["edge", "getAriaValueText", "region"],
  }
);

export const Waveform = {
  Bar: parts.Bar,
  Bars,
  Canvas: parts.Canvas,
  Control,
  Hover: parts.Hover,
  Marker: parts.Marker,
  Playhead: parts.Playhead,
  Region: parts.Region,
  RegionHandle,
  Root: parts.Root,
  Thumb: parts.Thumb,
};
