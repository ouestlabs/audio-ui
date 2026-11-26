import { createParts } from "@ui-sdk/vue/primitive";
import {
  defineComponent,
  getCurrentInstance,
  h,
  onBeforeUnmount,
  onMounted,
  watch,
} from "vue";
import {
  editableReadout,
  type FaderPublicState,
  fader,
} from "@/primitives/fader";

/** Which element each part is. */
const parts = createParts(fader, {
  control: "div",
  indicator: "div",
  input: "input",
  label: "div",
  mark: "div",
  root: "div",
  thumb: "div",
  track: "div",
  value: "output",
});

/** The thumb, with the native input that carries the fader's name inside it. */
const Thumb = defineComponent(
  (
    props: {
      getAriaValueText?: (
        formatted: string,
        value: number,
        index: number
      ) => string;
    },
    { attrs, slots }
  ) =>
    () => {
      const { "aria-label": label, ...rest } = attrs;
      return h(parts.Thumb, rest, {
        default: (scope: { state: FaderPublicState }) => [
          slots.default?.(scope),
          h(parts.Input, {
            "aria-label": label as string | undefined,
            getAriaValueText: props.getAriaValueText,
          }),
        ],
      });
    },
  { inheritAttrs: false, name: "FaderThumb", props: ["getAriaValueText"] }
);

const Value = defineComponent(
  (props: { editable?: boolean }, { attrs, slots }) => {
    const self = getCurrentInstance();
    let detach: (() => void) | undefined;
    // An editable readout lays a field over the text Vue keeps drawing.
    const sync = () => {
      detach?.();
      detach = undefined;
      const el = self?.subTree.el;
      if (props.editable && el instanceof HTMLElement) {
        detach = editableReadout(el, "fader");
      }
    };
    onMounted(sync);
    watch(() => props.editable, sync, { flush: "post" });
    onBeforeUnmount(() => detach?.());
    return () =>
      h(parts.Value, attrs, {
        default:
          slots.default ??
          (({ state }: { state: FaderPublicState }) => state.formatted),
      });
  },
  { inheritAttrs: false, name: "FaderValue", props: ["editable"] }
);

export const Fader = {
  Control: parts.Control,
  Indicator: parts.Indicator,
  Label: parts.Label,
  Mark: parts.Mark,
  Root: parts.Root,
  Thumb,
  Track: parts.Track,
  Value,
};
