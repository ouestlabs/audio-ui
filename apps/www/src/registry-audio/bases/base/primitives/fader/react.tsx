import type { FaderPublicState } from "@audio-ui/primitives/fader";
import { fader } from "@audio-ui/primitives/fader";
import { createParts } from "@ui-sdk/react/primitive";
import type { ComponentProps, ReactNode } from "react";

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

type ThumbProps = ComponentProps<typeof parts.Thumb> & {
  getAriaValueText?: (
    formatted: string,
    value: number,
    index: number
  ) => string;
};

const childrenOf = (
  children: ThumbProps["children"],
  state: FaderPublicState
): ReactNode => (typeof children === "function" ? children(state) : children);

/** The thumb, with the native input that carries the fader's name inside it. */
function FaderThumb({
  "aria-label": label,
  children,
  getAriaValueText,
  ...props
}: ThumbProps) {
  return (
    <parts.Thumb {...props}>
      {(state) => (
        <>
          {childrenOf(children, state)}
          <parts.Input aria-label={label} getAriaValueText={getAriaValueText} />
        </>
      )}
    </parts.Thumb>
  );
}

function Value({ children, ...props }: ComponentProps<typeof parts.Value>) {
  return (
    <parts.Value {...props}>
      {children ?? (({ formatted }) => formatted)}
    </parts.Value>
  );
}

export const Fader = {
  Control: parts.Control,
  Indicator: parts.Indicator,
  Label: parts.Label,
  Mark: parts.Mark,
  Root: parts.Root,
  Thumb: FaderThumb,
  Track: parts.Track,
  Value,
};
