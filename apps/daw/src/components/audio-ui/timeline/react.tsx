import { createParts } from "@ui-sdk/react/primitive";
import type { ComponentProps, ComponentType, ReactNode } from "react";
import { timeline } from "./timeline";

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
  createParts(timeline, {
    clip: "div",
    clipFadeIn: "svg",
    clipFadeInHandle: "div",
    clipFadeInInput: "input",
    clipFadeOut: "svg",
    clipFadeOutHandle: "div",
    clipFadeOutInput: "input",
    clipHeader: "div",
    clipInput: "input",
    clipTrimEnd: "div",
    clipTrimEndInput: "input",
    clipTrimStart: "div",
    clipTrimStartInput: "input",
    lane: "div",
    mark: "div",
    navigator: "div",
    navigatorEnd: "div",
    navigatorEndInput: "input",
    navigatorStart: "div",
    navigatorStartInput: "input",
    navigatorWindow: "div",
    navigatorWindowInput: "input",
    range: "div",
    rangeEnd: "div",
    rangeEndInput: "input",
    rangeInput: "input",
    rangeStart: "div",
    rangeStartInput: "input",
    playhead: "div",
    root: "div",
    ruler: "div",
    rulerInput: "input",
    track: "div",
    trackHeader: "div",
    trackResizeHandle: "div",
    trackResizeInput: "input",
    viewport: "div",
  })
);

type Naming = {
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

type RulerProps = ComponentProps<typeof parts.Ruler> &
  Naming & {
    /** Returns how the position is announced, e.g. `"bar 3, beat 2"`. Defaults to the number. */
    getAriaValueText?: (value: number, duration: number) => string;
  };

/**
 * The lane that moves the position: a press jumps to the pointer and a drag
 * scrubs, on the grid unless Cmd/Ctrl is held. It holds the native
 * `<input type="range">` that takes focus and the keys and carries the name.
 */
function Ruler({
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children,
  getAriaValueText,
  ...props
}: RulerProps) {
  return (
    <parts.Ruler {...props}>
      {children as ReactNode}
      <parts.RulerInput
        aria-describedby={describedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        getAriaValueText={getAriaValueText}
      />
    </parts.Ruler>
  );
}

type TrackResizeHandleProps = Omit<
  ComponentProps<typeof parts.TrackResizeHandle>,
  "children"
> &
  Naming & { children?: ReactNode };

/** Sets the track's height: by dragging, or from the keyboard through its native input. A double-click gives the height up. */
function TrackResizeHandle({
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children,
  track,
  ...props
}: TrackResizeHandleProps) {
  return (
    <parts.TrackResizeHandle {...props} track={track}>
      {children}
      <parts.TrackResizeInput
        aria-describedby={describedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        track={track}
      />
    </parts.TrackResizeHandle>
  );
}

type MarkProps = Omit<ComponentProps<typeof parts.Mark>, "mark"> & {
  /** The name of the mark. Defaults to its value, which is enough for one that does not move. */
  mark?: string;
};

/** A point of interest at a `value`, such as a cue or a loop edge. With `movable`, a drag or the arrows move it. */
function Mark({ mark, value, ...props }: MarkProps) {
  return <parts.Mark {...props} mark={mark ?? String(value)} value={value} />;
}

type ClipProps = Omit<ComponentProps<typeof parts.Clip>, "children"> &
  Naming & {
    children?: ReactNode;
    /** Returns how a position is announced. Defaults to the number. */
    getAriaValueText?: (value: number, duration: number) => string;
  };

/**
 * A stretch of a source laid on a lane: a recording, a pattern. Its parts
 * (the header, the handles, the fades) take the same `clip` name. Its own
 * native `<input type="range">` moves it from the keyboard and carries its
 * name, unless it is not `movable`; Delete and Backspace on it call `onClipRemove`.
 */
function Clip({
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children,
  clip,
  getAriaValueText,
  movable = true,
  ...props
}: ClipProps) {
  return (
    <parts.Clip {...props} clip={clip} movable={movable}>
      {children}
      {movable ? (
        <parts.ClipInput
          aria-describedby={describedBy}
          aria-label={label}
          aria-labelledby={labelledBy}
          clip={clip}
          getAriaValueText={getAriaValueText}
        />
      ) : null}
    </parts.Clip>
  );
}

type ClipHandleProps = Omit<
  ComponentProps<typeof parts.ClipTrimStart>,
  "children"
> &
  Naming & {
    children?: ReactNode;
    /** The edge of the clip this handle trims. */
    edge: "end" | "start";
    getAriaValueText?: (value: number, duration: number) => string;
  };

/** Trims one edge of the clip, by dragging or from the keyboard through its native input: it moves where in the source the clip begins instead of stretching it. */
function ClipHandle({
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children,
  clip,
  edge,
  getAriaValueText,
  ...props
}: ClipHandleProps) {
  const Handle = edge === "start" ? parts.ClipTrimStart : parts.ClipTrimEnd;
  const Input =
    edge === "start" ? parts.ClipTrimStartInput : parts.ClipTrimEndInput;
  return (
    <Handle {...(props as object)} clip={clip}>
      {children}
      <Input
        aria-describedby={describedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        clip={clip}
        getAriaValueText={getAriaValueText}
      />
    </Handle>
  );
}

type ClipFadeHandleProps = Omit<
  ComponentProps<typeof parts.ClipFadeInHandle>,
  "children"
> &
  Naming & {
    children?: ReactNode;
    /** The fade of the clip this handle sets: the one at its start or at its end. */
    edge: "in" | "out";
    getAriaValueText?: (value: number, duration: number) => string;
  };

/** Sets one fade of the clip, by dragging or from the keyboard through its native input. A double click, or Enter, steps its shape. */
function ClipFadeHandle({
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children,
  clip,
  edge,
  getAriaValueText,
  ...props
}: ClipFadeHandleProps) {
  const Handle =
    edge === "in" ? parts.ClipFadeInHandle : parts.ClipFadeOutHandle;
  const Input = edge === "in" ? parts.ClipFadeInInput : parts.ClipFadeOutInput;
  return (
    <Handle {...(props as object)} clip={clip}>
      {children}
      <Input
        aria-describedby={describedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        clip={clip}
        getAriaValueText={getAriaValueText}
      />
    </Handle>
  );
}

type ClipFadeProps = Omit<
  ComponentProps<typeof parts.ClipFadeIn>,
  "children"
> & {
  /** The fade of the clip this shades: the one at its start or at its end. */
  edge: "in" | "out";
};

/** Shades a fade of the clip: its curve, in a 1 by 1 box. Style its `color` for the line, and `--clip-fade-shade` for the fill. */
function ClipFade({ clip, edge, ...props }: ClipFadeProps) {
  const Fade = edge === "in" ? parts.ClipFadeIn : parts.ClipFadeOut;
  return (
    <Fade {...(props as object)} clip={clip}>
      {({ fill, line }: { fill: string; line: string }) => (
        <>
          <path
            d={fill}
            style={{ fill: "var(--clip-fade-shade, currentColor)" }}
          />
          <path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
    </Fade>
  );
}

type WindowProps = Omit<
  ComponentProps<typeof parts.NavigatorWindow>,
  "children"
> &
  Naming & {
    children?: ReactNode;
    getAriaValueText?: (value: number, duration: number) => string;
  };

/** The stretch the viewport shows, inside the navigator: dragging it scrolls. Its native input moves it from the keyboard. */
function NavigatorWindow({
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children,
  getAriaValueText,
  ...props
}: WindowProps) {
  return (
    <parts.NavigatorWindow {...props}>
      {children}
      <parts.NavigatorWindowInput
        aria-describedby={describedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        getAriaValueText={getAriaValueText}
      />
    </parts.NavigatorWindow>
  );
}

type NavigatorHandleProps = Omit<
  ComponentProps<typeof parts.NavigatorStart>,
  "children"
> &
  Naming & {
    children?: ReactNode;
    /** The edge of the window this handle moves: dragging it zooms. */
    edge: "end" | "start";
    getAriaValueText?: (value: number, duration: number) => string;
  };

/** An edge of the navigator's window: dragging it zooms, holding the other edge still. */
function NavigatorHandle({
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children,
  edge,
  getAriaValueText,
  ...props
}: NavigatorHandleProps) {
  const Handle = edge === "start" ? parts.NavigatorStart : parts.NavigatorEnd;
  const Input =
    edge === "start" ? parts.NavigatorStartInput : parts.NavigatorEndInput;
  return (
    <Handle {...(props as object)}>
      {children}
      <Input
        aria-describedby={describedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        getAriaValueText={getAriaValueText}
      />
    </Handle>
  );
}

type RangeProps = Omit<ComponentProps<typeof parts.Range>, "children"> &
  Naming & {
    children?: ReactNode;
    getAriaValueText?: (value: number, duration: number) => string;
  };

/**
 * A stretch laid over a lane, such as a loop or a selection. Its edges take
 * the same `range` name. Its own native `<input type="range">` moves it from
 * the keyboard and carries its name, unless it is not `movable`.
 */
function Range({
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children,
  getAriaValueText,
  movable = true,
  range,
  ...props
}: RangeProps) {
  return (
    <parts.Range {...props} movable={movable} range={range}>
      {children}
      {movable ? (
        <parts.RangeInput
          aria-describedby={describedBy}
          aria-label={label}
          aria-labelledby={labelledBy}
          getAriaValueText={getAriaValueText}
          range={range}
        />
      ) : null}
    </parts.Range>
  );
}

type RangeHandleProps = Omit<
  ComponentProps<typeof parts.RangeStart>,
  "children"
> &
  Naming & {
    children?: ReactNode;
    /** The edge of the range this handle resizes. */
    edge: "end" | "start";
    getAriaValueText?: (value: number, duration: number) => string;
  };

/** Resizes one edge of a range, by dragging or from the keyboard through its native input. */
function RangeHandle({
  "aria-describedby": describedBy,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  children,
  edge,
  getAriaValueText,
  range,
  ...props
}: RangeHandleProps) {
  const Handle = edge === "start" ? parts.RangeStart : parts.RangeEnd;
  const Input = edge === "start" ? parts.RangeStartInput : parts.RangeEndInput;
  return (
    <Handle {...(props as object)} range={range}>
      {children}
      <Input
        aria-describedby={describedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        getAriaValueText={getAriaValueText}
        range={range}
      />
    </Handle>
  );
}

export const Timeline = {
  Clip,
  ClipFade,
  ClipFadeHandle,
  ClipHandle,
  ClipHeader: parts.ClipHeader,
  Lane: parts.Lane,
  Mark,
  Navigator: parts.Navigator,
  NavigatorHandle,
  NavigatorWindow,
  Playhead: parts.Playhead,
  Range,
  RangeHandle,
  Root: parts.Root,
  Ruler,
  Track: parts.Track,
  TrackHeader: parts.TrackHeader,
  TrackResizeHandle,
  Viewport: parts.Viewport,
};
