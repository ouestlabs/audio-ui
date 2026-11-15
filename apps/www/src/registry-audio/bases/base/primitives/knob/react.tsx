import { DEFAULT_ARC_STROKE_WIDTH } from "@audio-ui/core/knob";
import {
  type ArcState,
  type ChangeDetails,
  type KnobPrimitiveOptions,
  type KnobPublicState,
  knob,
} from "@audio-ui/primitives/knob";
import { createParts } from "@ui-sdk/react/primitive";
import { type ComponentProps, createContext, type ReactNode, use } from "react";

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

/**
 * What a provider gives every knob below it. UI SDK has no such thing, so
 * each framework writes its own.
 */
type Defaults = Pick<KnobPrimitiveOptions, "dragMode">;
const KnobDefaults = createContext<Defaults>({});

function Provider({
  children,
  ...defaults
}: Defaults & { children: ReactNode }) {
  return <KnobDefaults value={defaults}>{children}</KnobDefaults>;
}

function KnobRoot(props: ComponentProps<typeof parts.Root>) {
  const defaults = use(KnobDefaults);
  return <parts.Root {...defaults} {...props} />;
}

/** An arc in the part's own state, written as its child so the server renders it. */
function arc(strokeWidth: number) {
  return ({ arc: d }: ArcState) =>
    d ? (
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
    ) : null;
}

function Track(props: ComponentProps<typeof parts.Track>) {
  return (
    <parts.Track {...props}>
      {arc(props.strokeWidth ?? DEFAULT_ARC_STROKE_WIDTH)}
    </parts.Track>
  );
}

function Indicator(props: ComponentProps<typeof parts.Indicator>) {
  return (
    <parts.Indicator {...props}>
      {arc(props.strokeWidth ?? DEFAULT_ARC_STROKE_WIDTH)}
    </parts.Indicator>
  );
}

type ThumbProps = ComponentProps<typeof parts.Thumb> & {
  getAriaValueText?: (formatted: string, value: number) => string;
};

const childrenOf = (
  children: ThumbProps["children"],
  state: KnobPublicState
): ReactNode => (typeof children === "function" ? children(state) : children);

/** The thumb, with the native input that carries the knob's name inside it. */
function KnobThumb({
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

/** The published knob's types, by part, so code written against it compiles. */
export namespace Knob {
  export namespace Root {
    export type Props = ComponentProps<typeof parts.Root>;
    export type State = KnobPublicState;
    export type ChangeEventDetails = ChangeDetails;
    export type CommitEventDetails = Parameters<
      NonNullable<KnobPrimitiveOptions["onValueCommitted"]>
    >[1];
  }
  export namespace Control {
    export type Props = ComponentProps<typeof parts.Control>;
    export type State = KnobPublicState;
  }
  export namespace Thumb {
    export type Props = ThumbProps;
    export type State = KnobPublicState;
  }
}

export const Knob = {
  Control: parts.Control,
  Indicator,
  Label: parts.Label,
  Mark: parts.Mark,
  Provider,
  Root: KnobRoot,
  Thumb: KnobThumb,
  Track,
  Value,
};
