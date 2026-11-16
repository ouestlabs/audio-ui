import { type XYPadPublicState, xypad } from "@audio-ui/primitives/xypad";
import { createParts } from "@ui-sdk/vue/primitive";
import { defineComponent, h } from "vue";

/** Which element each part is. */
const parts = createParts(xypad, {
  control: "div",
  inputX: "input",
  inputY: "input",
  label: "div",
  root: "div",
  thumb: "div",
  value: "output",
});

type Axis = "x" | "y";

/** The thumb, with the two native inputs, one per axis, that carry the pad's name. */
const Thumb = defineComponent(
  (
    props: {
      getAriaLabel?: (axis: Axis) => string;
      getAriaValueText?: (
        formatted: string,
        value: number,
        axis: Axis
      ) => string;
    },
    { attrs, slots }
  ) =>
    () => {
      const { "aria-label": label, ...rest } = attrs;
      const nameOf = (axis: Axis) =>
        props.getAriaLabel?.(axis) ??
        (label ? `${label} ${axis.toUpperCase()}` : undefined);
      return h(parts.Thumb, rest, {
        default: (scope: { state: XYPadPublicState }) => [
          slots.default?.(scope),
          h(parts.InputX, {
            "aria-label": nameOf("x"),
            getAriaValueText: props.getAriaValueText,
          }),
          h(parts.InputY, {
            "aria-label": nameOf("y"),
            getAriaValueText: props.getAriaValueText,
          }),
        ],
      });
    },
  {
    inheritAttrs: false,
    name: "XYPadThumb",
    props: ["getAriaLabel", "getAriaValueText"],
  }
);

const Value = defineComponent(
  (_props, { attrs, slots }) =>
    () =>
      h(parts.Value, attrs, {
        default:
          slots.default ??
          (({ state }: { state: XYPadPublicState }) => state.formattedPair),
      }),
  { inheritAttrs: false, name: "XYPadValue" }
);

export const XYPad = {
  Control: parts.Control,
  Label: parts.Label,
  Root: parts.Root,
  Thumb,
  Value,
};
