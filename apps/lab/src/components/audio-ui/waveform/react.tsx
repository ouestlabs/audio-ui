import { createParts } from "@ui-sdk/react/primitive";
import type { ComponentProps, ComponentType, ReactNode } from "react";
import { waveform } from "./waveform";

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
  createParts(waveform, {
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
  })
);

type Naming = {
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

type ControlProps = ComponentProps<typeof parts.Control> &
  Naming & {
    /** Returns how the position is announced, e.g. `"0:12 of 1:42"`. Defaults to the played share, e.g. `"30%"`. */
    getAriaValueText?: (value: number, duration: number) => string;
  };

/**
 * The seekable surface: a press jumps to the pointer and a drag scrubs. It
 * holds the native `<input type="range">` that takes focus, handles the
 * keyboard and carries the accessible name. Leave it out for a waveform that
 * is only shown.
 */
function Control({
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children,
  getAriaValueText,
  ...props
}: ControlProps) {
  return (
    <parts.Control {...props}>
      {children as ReactNode}
      <parts.Input
        aria-describedby={describedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        getAriaValueText={getAriaValueText}
      />
    </parts.Control>
  );
}

type BarsProps = Omit<ComponentProps<typeof parts.Bars>, "children"> & {
  /** Called once per bar; returns its `Waveform.Bar`. Left out, plain bars are rendered. */
  children?: (index: number, count: number) => ReactNode;
};

/** The levels as a fixed number of elements, one `Waveform.Bar` each, styled in plain CSS from `--waveform-level`. */
function Bars({ children, count = 24, ...props }: BarsProps) {
  const indexes = Array.from({ length: count }, (_, index) => index);
  return (
    <parts.Bars count={count} {...props}>
      {indexes.map((index) =>
        children ? (
          children(index, count)
        ) : (
          <parts.Bar index={index} key={index} />
        )
      )}
    </parts.Bars>
  );
}

type RegionHandleProps = Omit<
  ComponentProps<typeof parts.RegionStart>,
  "children"
> &
  Naming & {
    children?: ReactNode;
    /** The edge of the region this handle resizes. */
    edge: "end" | "start";
    /** Returns how the edge's position is announced. Defaults to its share, e.g. `"30%"`. */
    getAriaValueText?: (value: number, duration: number) => string;
    /** The name of the region it belongs to. */
    region: string;
  };

/** Resizes one edge of a region, by dragging or from the keyboard through its native input. */
function RegionHandle({
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children,
  edge,
  getAriaValueText,
  region,
  ...props
}: RegionHandleProps) {
  const Handle = edge === "start" ? parts.RegionStart : parts.RegionEnd;
  const Input =
    edge === "start" ? parts.RegionStartInput : parts.RegionEndInput;
  return (
    <Handle {...(props as object)} region={region}>
      {children}
      <Input
        aria-describedby={describedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        getAriaValueText={getAriaValueText}
        region={region}
      />
    </Handle>
  );
}

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
