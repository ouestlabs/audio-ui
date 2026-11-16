import { type XYPadPublicState, xypad } from "@audio-ui/primitives/xypad";
import { createParts } from "@ui-sdk/react/primitive";
import type { ComponentProps, ComponentType, ReactNode } from "react";

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
  createParts(xypad, {
    control: "div",
    inputX: "input",
    inputY: "input",
    label: "div",
    root: "div",
    thumb: "div",
    value: "output",
  })
);

type Axis = "x" | "y";

type ThumbProps = ComponentProps<typeof parts.Thumb> & {
  /** Names each axis input. Defaults to `aria-label` followed by "X" or "Y". */
  getAriaLabel?: (axis: Axis) => string;
  getAriaValueText?: (formatted: string, value: number, axis: Axis) => string;
};

const childrenOf = (
  children: ThumbProps["children"],
  state: XYPadPublicState
): ReactNode => (typeof children === "function" ? children(state) : children);

/** The thumb, with the two native inputs, one per axis, that carry the pad's name. */
function XYPadThumb({
  "aria-label": label,
  children,
  getAriaLabel,
  getAriaValueText,
  ...props
}: ThumbProps) {
  const nameOf = (axis: Axis) =>
    getAriaLabel?.(axis) ??
    (label ? `${label} ${axis.toUpperCase()}` : undefined);
  return (
    <parts.Thumb {...props}>
      {(state) => (
        <>
          {childrenOf(children, state)}
          <parts.InputX
            aria-label={nameOf("x")}
            getAriaValueText={getAriaValueText}
          />
          <parts.InputY
            aria-label={nameOf("y")}
            getAriaValueText={getAriaValueText}
          />
        </>
      )}
    </parts.Thumb>
  );
}

function Value({ children, ...props }: ComponentProps<typeof parts.Value>) {
  return (
    <parts.Value {...props}>
      {children ?? (({ formattedPair }) => formattedPair)}
    </parts.Value>
  );
}

export const XYPad = {
  Control: parts.Control,
  Label: parts.Label,
  Root: parts.Root,
  Thumb: XYPadThumb,
  Value,
};
