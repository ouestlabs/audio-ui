import { createParts } from "@ui-sdk/react/primitive";
import type { ComponentProps, ComponentType, ReactNode } from "react";
import { sequencer, type VelocityState } from "@/primitives/sequencer";

const noop = () => undefined;

/** The parts that are native inputs: `input`, `rulerInput`, `inputX`. */
const INPUT_PART = /input[xy]?$/i;

/**
 * The kernel listens to the native inputs itself, so React sees a `value` and
 * no `onChange`: this tells it the field is read elsewhere, and keeps it from
 * warning of one.
 */
function quietInputs<Parts extends object>(source: Parts): Parts {
  const quiet: Record<string, unknown> = {};
  for (const [name, Part] of Object.entries(source)) {
    const Component = Part as ComponentType<{ onChange?: () => void }>;
    quiet[name] = INPUT_PART.test(name)
      ? (props: object) => <Component {...props} onChange={noop} />
      : Part;
  }
  return quiet as Parts;
}

/** Which element each part is. */
const parts = quietInputs(
  createParts(sequencer, {
    cell: "button",
    root: "div",
    row: "div",
    velocity: "div",
    velocityInput: "input",
  })
);

type CellProps = Omit<ComponentProps<typeof parts.Cell>, "cell">;

/** One step of a row: a toggle button, pressed when the step is on. */
function Cell({ row, step, ...props }: CellProps) {
  return (
    <parts.Cell {...props} cell={`${row}:${step}`} row={row} step={step} />
  );
}

type VelocityProps = Omit<ComponentProps<typeof parts.Velocity>, "cell"> & {
  /** Announces the velocity in your own words. Defaults to a percentage. */
  getAriaValueText?: (velocity: number) => string;
};

const childrenOf = (
  children: VelocityProps["children"],
  state: VelocityState
): ReactNode => (typeof children === "function" ? children(state) : children);

/**
 * How loud one step plays, as a bar whose height is the `--sequencer-velocity`
 * CSS variable, with the native range input that carries its name inside it.
 */
function Velocity({
  "aria-label": label,
  children,
  getAriaValueText,
  row,
  step,
  ...props
}: VelocityProps) {
  return (
    <parts.Velocity {...props} cell={`${row}:${step}`} row={row} step={step}>
      {(state) => (
        <>
          {childrenOf(children, state)}
          <parts.VelocityInput
            aria-label={label ?? `Step ${step + 1}`}
            cell={`${row}:${step}`}
            getAriaValueText={getAriaValueText}
            row={row}
            step={step}
          />
        </>
      )}
    </parts.Velocity>
  );
}

/**
 * The rows, the cells and the velocity bars are written by the app, with
 * their `row` and `step`: the Root's children can be a function of its state,
 * `{ rows, steps }`.
 */
export const Sequencer = { Cell, Root: parts.Root, Row: parts.Row, Velocity };
