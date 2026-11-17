import { createParts } from "@ui-sdk/vue/primitive";
import { defineComponent, h } from "vue";
import { sequencer, type VelocityState } from "@/primitives/sequencer";

/** Which element each part is. */
const parts = createParts(sequencer, {
  cell: "button",
  root: "div",
  row: "div",
  velocity: "div",
  velocityInput: "input",
});

/** One step of a row: a toggle button, pressed when the step is on. */
const Cell = defineComponent(
  (props: { row: number; step: number }, { attrs, slots }) =>
    () =>
      h(
        parts.Cell,
        {
          ...attrs,
          cell: `${props.row}:${props.step}`,
          row: props.row,
          step: props.step,
        },
        slots
      ),
  { inheritAttrs: false, name: "SequencerCell", props: ["row", "step"] }
);

/**
 * How loud one step plays, as a bar whose height is the `--sequencer-velocity`
 * CSS variable, with the native range input that carries its name inside it.
 */
const Velocity = defineComponent(
  (
    props: {
      getAriaValueText?: (velocity: number) => string;
      row: number;
      step: number;
    },
    { attrs, slots }
  ) =>
    () => {
      const { "aria-label": label, ...rest } = attrs;
      return h(
        parts.Velocity,
        {
          ...rest,
          cell: `${props.row}:${props.step}`,
          row: props.row,
          step: props.step,
        },
        {
          default: (scope: { state: VelocityState }) => [
            slots.default?.(scope),
            h(parts.VelocityInput, {
              "aria-label":
                (label as string | undefined) ?? `Step ${props.step + 1}`,
              cell: `${props.row}:${props.step}`,
              getAriaValueText: props.getAriaValueText,
              row: props.row,
              step: props.step,
            }),
          ],
        }
      );
    },
  {
    inheritAttrs: false,
    name: "SequencerVelocity",
    props: ["getAriaValueText", "row", "step"],
  }
);

/**
 * The rows, the cells and the velocity bars are written by the app, with
 * their `row` and `step`: the Root's default slot gets its state,
 * `{ rows, steps }`.
 */
export const Sequencer = { Cell, Root: parts.Root, Row: parts.Row, Velocity };
