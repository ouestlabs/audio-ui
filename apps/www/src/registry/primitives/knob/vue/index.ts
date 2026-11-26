import { createParts } from "@ui-sdk/vue/primitive";
import {
  defineComponent,
  getCurrentInstance,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  watch,
} from "vue";
import {
  type ArcState,
  DEFAULT_ARC_STROKE_WIDTH,
  editableReadout,
  type KnobPrimitiveOptions,
  type KnobPublicState,
  knob,
} from "@/primitives/knob";

/** Which element each part is. */
const parts = createParts(knob, {
  control: "div",
  indicator: "svg",
  input: "input",
  label: "div",
  mark: "div",
  root: "div",
  thumb: "div",
  track: "svg",
  value: "output",
});

/** What a provider gives every knob below it. UI SDK has no such thing. */
type Defaults = Pick<KnobPrimitiveOptions, "dragMode">;
const DEFAULTS: InjectionKey<Defaults> = Symbol("knob defaults");

const Provider = defineComponent(
  (props: Defaults, { slots }) => {
    provide(DEFAULTS, props);
    return () => slots.default?.();
  },
  { name: "KnobProvider", props: ["dragMode"] }
);

const Root = defineComponent(
  (_props, { attrs, slots }) => {
    const defaults = inject(DEFAULTS, {});
    return () =>
      h(
        parts.Root,
        {
          ...attrs,
          dragMode: (attrs.dragMode ??
            defaults.dragMode) as Defaults["dragMode"],
        },
        slots
      );
  },
  { inheritAttrs: false, name: "KnobRoot" }
);

/** An arc in the part's own state, rendered as its content so the server writes it. */
const arc =
  (strokeWidth: number) =>
  ({ state }: { state: ArcState }) =>
    state.arc
      ? h("path", {
          d: state.arc,
          fill: "none",
          stroke: "currentColor",
          "stroke-linecap": "round",
          "stroke-width": strokeWidth,
        })
      : null;

/** The track or the indicator: an `<svg>` part with its arc inside. */
const arcPart = (part: typeof parts.Track, name: string) =>
  defineComponent(
    (props: { strokeWidth?: number }, { attrs }) =>
      () =>
        h(
          part,
          { ...attrs, strokeWidth: props.strokeWidth },
          { default: arc(props.strokeWidth ?? DEFAULT_ARC_STROKE_WIDTH) }
        ),
    { inheritAttrs: false, name, props: ["strokeWidth"] }
  );

const Track = arcPart(parts.Track, "KnobTrack");
const Indicator = arcPart(parts.Indicator, "KnobIndicator");

/** The thumb, with the native input that carries the knob's name inside it. */
const Thumb = defineComponent(
  (
    props: {
      getAriaValueText?: (formatted: string, value: number) => string;
    },
    { attrs, slots }
  ) =>
    () => {
      const { "aria-label": label, ...rest } = attrs;
      return h(parts.Thumb, rest, {
        default: (scope: { state: KnobPublicState }) => [
          slots.default?.(scope),
          h(parts.Input, {
            "aria-label": label as string | undefined,
            getAriaValueText: props.getAriaValueText,
          }),
        ],
      });
    },
  { inheritAttrs: false, name: "KnobThumb", props: ["getAriaValueText"] }
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
        detach = editableReadout(el, "knob");
      }
    };
    onMounted(sync);
    watch(() => props.editable, sync, { flush: "post" });
    onBeforeUnmount(() => detach?.());
    return () =>
      h(parts.Value, attrs, {
        default:
          slots.default ??
          (({ state }: { state: KnobPublicState }) => state.formatted),
      });
  },
  { inheritAttrs: false, name: "KnobValue", props: ["editable"] }
);

export const Knob = {
  Control: parts.Control,
  Indicator,
  Label: parts.Label,
  Mark: parts.Mark,
  Provider,
  Root,
  Thumb,
  Track,
  Value,
};
