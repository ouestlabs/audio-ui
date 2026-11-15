import { type XYPadPublicState, xypad } from "@audio-ui/primitives/xypad";
import { createParts } from "@ui-sdk/react/primitive";
import type { ComponentProps, ReactNode } from "react";

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
