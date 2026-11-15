import { timeline } from "@audio-ui/primitives/timeline";
import { createParts } from "@ui-sdk/react/primitive";
import type { ComponentProps, ReactNode } from "react";

/** Which element each part is. */
const parts = createParts(timeline, {
  lane: "div",
  mark: "div",
  playhead: "div",
  root: "div",
  ruler: "div",
  rulerInput: "input",
  track: "div",
  trackHeader: "div",
  trackResizeHandle: "div",
  trackResizeInput: "input",
  viewport: "div",
});

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

export const Timeline = {
  Lane: parts.Lane,
  Mark,
  Playhead: parts.Playhead,
  Root: parts.Root,
  Ruler,
  Track: parts.Track,
  TrackHeader: parts.TrackHeader,
  TrackResizeHandle,
  Viewport: parts.Viewport,
};
