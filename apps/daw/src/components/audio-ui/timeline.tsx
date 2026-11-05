"use client";

import { dbToGain, gainToDb } from "@audio-ui/core/analysis";
import { CurveIcon } from "@audio-ui/icons/react";
import {
  FADE_SHAPES,
  type FadeShape,
  fadeGain,
  Timeline as TimelinePrimitive,
} from "@audio-ui/react";
import {
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { Fader } from "@/components/audio-ui/fader";
import { Knob } from "@/components/audio-ui/knob";
import { Led } from "@/components/audio-ui/led";
import type { Mix } from "@/lib/arrangement";
import { CaretRightIcon } from "@phosphor-icons/react";

function Timeline({ className, ...props }: TimelinePrimitive.Root.Props) {
  return (
    <TimelinePrimitive.Root
      className={cn(
        "[--timeline-grid-color:color-mix(in_oklab,var(--border)_70%,transparent)] [--timeline-grid-accent-color:color-mix(in_oklab,var(--foreground)_16%,transparent)] flex w-full min-w-0 flex-col data-disabled:opacity-50",
        className
      )}
      data-slot="timeline"
      {...props}
    />
  );
}

type TimelineViewportProps = TimelinePrimitive.Viewport.Props & {
  /** `hidden` drops the native scrollbar, for a `TimelineNavigator` to scroll with instead. */
  scrollbar?: "hidden" | "native";
};

function TimelineViewport({
  className,
  scrollbar = "native",
  ...props
}: TimelineViewportProps) {
  return (
    <TimelinePrimitive.Viewport
      className={cn(
        "bg-background relative min-h-0 min-w-0 overscroll-x-contain",
        scrollbar === "hidden" &&
          "scrollbar-none [&::-webkit-scrollbar]:hidden",
        className
      )}
      data-slot="timeline-viewport"
      {...props}
    />
  );
}

function TimelineRuler({ className, ...props }: TimelinePrimitive.Ruler.Props) {
  return (
    <TimelinePrimitive.Ruler
      className={cn(
        "h-7 border-b bg-background text-muted-foreground text-xs has-focus-visible:bg-muted shrink-0 cursor-pointer touch-none select-none",
        "data-disabled:pointer-events-none",
        className
      )}
      data-slot="timeline-ruler"
      {...props}
    />
  );
}

type TimelineLaneProps = Omit<TimelinePrimitive.Lane.Props, "style"> & {
  /** Distance between grid lines, in the timeline's units. Leave it out for no lines. */
  gridStep?: number;
  style?: CSSProperties;
};

/** A line every `gridStep` units, sized from the lane's own unit so it follows the zoom. */
function gridLines(gridStep: number | undefined): CSSProperties | undefined {
  if (!(gridStep && gridStep > 0)) {
    return;
  }
  return {
    backgroundImage:
      "repeating-linear-gradient(to right, var(--timeline-grid-color) 0 1px, transparent 1px 100%)",
    backgroundSize: `calc(var(--timeline-unit) * ${gridStep}) 100%`,
  };
}

function TimelineLane({
  className,
  gridStep,
  style,
  ...props
}: TimelineLaneProps) {
  return (
    <TimelinePrimitive.Lane
      className={cn("h-14 border-b bg-muted/30", className)}
      data-slot="timeline-lane"
      style={{ ...gridLines(gridStep), ...style }}
      {...props}
    />
  );
}

function TimelineTrack({ className, ...props }: TimelinePrimitive.Track.Props) {
  return (
    <TimelinePrimitive.Track
      className={className}
      data-slot="timeline-track"
      {...props}
    />
  );
}

function TimelineTrackHeader({
  className,
  ...props
}: TimelinePrimitive.TrackHeader.Props) {
  return (
    <TimelinePrimitive.TrackHeader
      className={cn(
        "w-44 border-e bg-background text-sm data-[selected]:bg-muted hover:[--timeline-track-header-z:30] focus-within:[--timeline-track-header-z:30]",
        className
      )}
      data-slot="timeline-track-header"
      {...props}
    />
  );
}

function TimelineTrackResizeHandle({
  className,
  ...props
}: TimelinePrimitive.TrackResizeHandle.Props) {
  return (
    <TimelinePrimitive.TrackResizeHandle
      className={cn(
        "-bottom-px inset-x-0 z-10 h-0.5 cursor-row-resize bg-primary/0 hover:bg-primary/40 has-focus-visible:bg-primary/60 data-[resizing]:bg-primary/60 absolute touch-none outline-none before:absolute before:inset-x-0 before:-top-2 before:bottom-0 before:content-['']",
        className
      )}
      data-slot="timeline-track-resize-handle"
      {...props}
    />
  );
}

function TimelineMark({ className, ...props }: TimelinePrimitive.Mark.Props) {
  return (
    <TimelinePrimitive.Mark
      className={cn(
        "border-s ps-1.5 tabular-nums pointer-events-none inset-y-0 flex items-center data-dragging:z-10",
        className
      )}
      data-slot="timeline-mark"
      {...props}
    />
  );
}

function TimelinePlayhead({
  className,
  ...props
}: TimelinePrimitive.Playhead.Props) {
  return (
    <TimelinePrimitive.Playhead
      className={cn(
        "bg-primary pointer-events-none inset-y-0 w-px",
        className
      )}
      data-slot="timeline-playhead"
      {...props}
    />
  );
}

function TimelineRange({
  children,
  className,
  ...props
}: TimelinePrimitive.Range.Props) {
  return (
    <TimelinePrimitive.Range
      className={cn(
        "bg-primary/25 ring-inset hover:bg-primary/35 has-focus-visible:ring-2 has-focus-visible:ring-ring/50 @container/range inset-y-0 cursor-grab touch-none data-dragging:cursor-grabbing data-disabled:cursor-not-allowed",
        className
      )}
      data-slot="timeline-range"
      minDrawnWidth={32}
      {...props}
    >
      {/* Its true length against the ruler, while it is drawn wider to keep its handles apart. */}
      <span
        aria-hidden="true"
        className="bg-primary pointer-events-none absolute start-0 bottom-0 h-0.5 w-[calc(var(--timeline-unit)*var(--timeline-length))] @min-[4rem]/range:hidden"
        data-slot="timeline-range-extent"
      />
      {children}
    </TimelinePrimitive.Range>
  );
}

function TimelineRangeHandle({
  className,
  ...props
}: TimelinePrimitive.RangeHandle.Props) {
  return (
    <TimelinePrimitive.RangeHandle
      className={cn(
        "rounded-[min(var(--radius-sm),6px)] border-ring border bg-card transition-[color,box-shadow] hover:ring-2 hover:ring-ring/40 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 active:ring-3 active:ring-ring/50 motion-reduce:transition-none absolute inset-y-1 w-2 cursor-ew-resize data-[edge=end]:right-1 data-[edge=start]:left-1",
        // The room to aim at grows away from the other handle, never over it.
        "after:absolute after:inset-y-0 data-[edge=end]:after:-right-1.5 data-[edge=end]:after:left-0 data-[edge=start]:after:right-0 data-[edge=start]:after:-left-1.5 pointer-coarse:data-[edge=end]:after:-right-3 pointer-coarse:data-[edge=start]:after:-left-3",
        className
      )}
      data-slot="timeline-range-handle"
      {...props}
    />
  );
}

/** A track header's switch: as small as its other buttons, a letter or a light in it. */
const TRACK_SWITCH = "h-6 min-w-6 px-0";

/**
 * What a pressed Solo and Mute look like, wherever a track's switches are: a
 * tint each, read at a glance across many tracks, the letter as it is. A theme
 * sets `--solo` and `--mute`; without them, a blue and an amber.
 */
export const SWITCH_TONES = {
  mute: "aria-pressed:border-[color-mix(in_oklab,var(--mute,oklch(0.8_0.16_75))_55%,transparent)] aria-pressed:bg-[color-mix(in_oklab,var(--mute,oklch(0.8_0.16_75))_22%,transparent)]",
  solo: "aria-pressed:border-[color-mix(in_oklab,var(--solo,oklch(0.6_0.19_255))_55%,transparent)] aria-pressed:bg-[color-mix(in_oklab,var(--solo,oklch(0.6_0.19_255))_22%,transparent)]",
} as const;

/** Which of a track's switches are on, as its toggle group holds them. */
function switchesOn(mix: Pick<Mix, "muted" | "soloed">, armed?: boolean) {
  return [
    ...(mix.soloed ? ["solo"] : []),
    ...(mix.muted ? ["mute"] : []),
    ...(armed ? ["arm"] : []),
  ];
}

/** Where a fade being dragged stops: the other fade's start, as a dashed line. */
const FADE_LIMIT =
  "pointer-events-none absolute inset-y-0 z-30 hidden border-foreground/60 border-l border-dashed";

function TimelineClip({
  children,
  className,
  ...props
}: TimelinePrimitive.Clip.Props) {
  return (
    <TimelinePrimitive.Clip
      className={cn(
        "rounded-[min(var(--radius-sm),6px)] overflow-hidden bg-primary/25 ring-1 ring-primary/60 ring-inset data-[selected]:bg-primary/40 data-[selected]:ring-2 data-[selected]:ring-primary has-focus-visible:ring-2 has-focus-visible:ring-ring group/clip isolate inset-y-0 touch-none data-dragging:z-10 data-disabled:cursor-not-allowed",
        className
      )}
      data-slot="timeline-clip"
      {...props}
    >
      {children}
      <span
        aria-hidden="true"
        className={cn(FADE_LIMIT, "group-data-[fading=in]/clip:block")}
        style={{
          insetInlineStart:
            "calc(var(--timeline-unit) * var(--clip-fade-in-max))",
        }}
      />
      <span
        aria-hidden="true"
        className={cn(FADE_LIMIT, "group-data-[fading=out]/clip:block")}
        style={{
          insetInlineEnd:
            "calc(var(--timeline-unit) * var(--clip-fade-out-max))",
        }}
      />
    </TimelinePrimitive.Clip>
  );
}

/** The clip's title bar: drag it to move the clip. Put the clip's name in it. */
function TimelineClipHeader({
  className,
  ...props
}: TimelinePrimitive.ClipHeader.Props) {
  return (
    <TimelinePrimitive.ClipHeader
      className={cn(
        "bg-primary/30 data-[selected]:bg-primary/50 flex h-5 cursor-grab items-center truncate px-2 text-xs data-dragging:cursor-grabbing data-disabled:cursor-not-allowed",
        className
      )}
      data-slot="timeline-clip-header"
      {...props}
    />
  );
}

function TimelineClipHandle({
  className,
  ...props
}: TimelinePrimitive.ClipHandle.Props) {
  return (
    <TimelinePrimitive.ClipHandle
      className={cn(
        "bg-primary/0 hover:bg-primary/60 has-focus-visible:bg-primary absolute inset-y-0 z-10 w-2 cursor-ew-resize data-[edge=end]:right-0 data-[edge=start]:left-0",
        "after:absolute after:-inset-x-1.5 after:inset-y-0 pointer-coarse:after:-inset-x-3",
        className
      )}
      data-slot="timeline-clip-handle"
      {...props}
    />
  );
}

/** Shades what a fade attenuates, over the clip's content. */
function TimelineClipFade({
  className,
  ...props
}: TimelinePrimitive.ClipFade.Props) {
  return (
    <TimelinePrimitive.ClipFade
      className={cn("text-foreground/80 [--clip-fade-shade:color-mix(in_oklab,var(--background)_55%,transparent)]", className)}
      data-slot="timeline-clip-fade"
      {...props}
    />
  );
}

const FADE_SHAPE_LABELS: Record<FadeShape, string> = {
  fast: "Fast",
  linear: "Linear",
  slow: "Slow",
  smooth: "Smooth",
};

/** The gain of each fade shape, one stable function per shape: what its menu icon draws. */
const FADE_CURVES = Object.fromEntries(
  FADE_SHAPES.map((item) => [
    item,
    (progress: number) => fadeGain(item, progress),
  ])
) as Record<FadeShape, (progress: number) => number>;

type TimelineClipFadeHandleProps = TimelinePrimitive.ClipFadeHandle.Props & {
  /** The fade's curve. With `onShapeChange`, a right-click on the handle lists the curves. */
  shape?: FadeShape;
  onShapeChange?: (shape: FadeShape) => void;
};

function TimelineClipFadeHandle({
  className,
  onShapeChange,
  shape = "linear",
  ...props
}: TimelineClipFadeHandleProps) {
  const handleShape = useCallback(
    (value: string) => onShapeChange?.(value as FadeShape),
    [onShapeChange]
  );
  const handle = (
    <TimelinePrimitive.ClipFadeHandle
      className={cn(
        "rounded-[min(var(--radius-sm),6px)] border-ring border bg-card transition-[color,box-shadow] hover:ring-2 hover:ring-ring/40 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 active:ring-3 active:ring-ring/50 motion-reduce:transition-none top-6 z-20 size-3 cursor-ew-resize data-[edge=in]:ms-1 data-[edge=out]:me-1 opacity-0 transition-opacity",
        "group-hover/clip:opacity-100 group-data-selected/clip:opacity-100 data-dragging:opacity-100 has-focus-visible:opacity-100",
        "after:absolute after:-inset-1 pointer-coarse:opacity-100 pointer-coarse:after:-inset-2",
        className
      )}
      data-slot="timeline-clip-fade-handle"
      {...props}
    />
  );
  if (!onShapeChange) {
    return handle;
  }
  return (
    <ContextMenu>
      <ContextMenuTrigger render={handle} />
      <ContextMenuContent className="w-auto min-w-32">
        <ContextMenuRadioGroup onValueChange={handleShape} value={shape}>
          {FADE_SHAPES.map((item) => (
            <ContextMenuRadioItem key={item} value={item}>
              <CurveIcon
                className="size-4 shrink-0 text-muted-foreground"
                from={0}
                max={1}
                min={0}
                shape={FADE_CURVES[item]}
                to={1}
              />
              {FADE_SHAPE_LABELS[item]}
            </ContextMenuRadioItem>
          ))}
        </ContextMenuRadioGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** The whole timeline as one bar: drag the window to scroll, an edge to zoom, double-click to show everything. */
function TimelineNavigator({
  className,
  ...props
}: TimelinePrimitive.Navigator.Props) {
  return (
    <TimelinePrimitive.Navigator
      className={cn("h-6 rounded-[min(var(--radius-sm),6px)] bg-muted shrink-0 select-none", className)}
      data-slot="timeline-navigator"
      minWindowWidth={48}
      {...props}
    >
      <TimelinePrimitive.NavigatorWindow
        aria-label="Visible range"
        className="bg-primary/25 hover:bg-primary/35 has-focus-visible:ring-2 has-focus-visible:ring-ring/50 inset-y-0 cursor-grab rounded-[inherit] active:cursor-grabbing"
      />
      <TimelinePrimitive.NavigatorHandle
        aria-label="Start of the visible range"
        className="rounded-[min(var(--radius-sm),6px)] border-ring border bg-card transition-[color,box-shadow] hover:ring-2 hover:ring-ring/40 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 active:ring-3 active:ring-ring/50 motion-reduce:transition-none inset-y-1 ms-1 w-2 cursor-ew-resize after:absolute after:-inset-x-1.5 after:inset-y-0"
        edge="start"
      />
      <TimelinePrimitive.NavigatorHandle
        aria-label="End of the visible range"
        className="rounded-[min(var(--radius-sm),6px)] border-ring border bg-card transition-[color,box-shadow] hover:ring-2 hover:ring-ring/40 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 active:ring-3 active:ring-ring/50 motion-reduce:transition-none inset-y-1 w-2 cursor-ew-resize data-[edge=end]:-translate-x-[calc(100%+0.25rem)] after:absolute after:-inset-x-1.5 after:inset-y-0"
        edge="end"
      />
    </TimelinePrimitive.Navigator>
  );
}

const selectText = (element: HTMLInputElement | null) => element?.select();

/** A track's volume, in dB as a mixer's channel has it: at the bottom, silence. */
const TRACK_MIN_DB = -60;
const TRACK_MAX_DB = 6;
const gainOfDb = (db: number) => (db <= TRACK_MIN_DB ? 0 : dbToGain(db));
const formatGainDb = (db: number) =>
  db <= TRACK_MIN_DB ? "-inf dB" : `${db.toFixed(1)} dB`;

/** A track is never shorter than its full header needs: to go smaller, fold it. */
export const MIN_TRACK_HEIGHT = 79;
/** Below this a track is a strip: the full header (name, solo, mute, gain, pan) needs this much room, so a shorter track keeps the name, solo and mute and drops the rest. */
export const COMPACT_TRACK_HEIGHT = 79;
export const MAX_TRACK_HEIGHT = 320;
export const TRACK_HEIGHT_STEP = 8;

/**
 * The colors a track can take: the theme's chart tokens, written out for the
 * stylesheet to find. A project whose theme has none gets the design system's
 * own, so its tracks keep apart.
 */
export const TRACK_COLORS = [
  {
    dot: "bg-[var(--chart-1,oklch(0.87_0_0))]",
    clip: "[--primary:var(--chart-1,oklch(0.87_0_0))]",
    edge: "border-s-[var(--chart-1,oklch(0.87_0_0))]",
    name: "Color 1",
  },
  {
    dot: "bg-[var(--chart-2,oklch(0.556_0_0))]",
    clip: "[--primary:var(--chart-2,oklch(0.556_0_0))]",
    edge: "border-s-[var(--chart-2,oklch(0.556_0_0))]",
    name: "Color 2",
  },
  {
    dot: "bg-[var(--chart-3,oklch(0.439_0_0))]",
    clip: "[--primary:var(--chart-3,oklch(0.439_0_0))]",
    edge: "border-s-[var(--chart-3,oklch(0.439_0_0))]",
    name: "Color 3",
  },
  {
    dot: "bg-[var(--chart-4,oklch(0.371_0_0))]",
    clip: "[--primary:var(--chart-4,oklch(0.371_0_0))]",
    edge: "border-s-[var(--chart-4,oklch(0.371_0_0))]",
    name: "Color 4",
  },
  {
    dot: "bg-[var(--chart-5,oklch(0.269_0_0))]",
    clip: "[--primary:var(--chart-5,oklch(0.269_0_0))]",
    edge: "border-s-[var(--chart-5,oklch(0.269_0_0))]",
    name: "Color 5",
  },
] as const;

const formatPan = (pan: number) => {
  const amount = Math.round(Math.abs(pan) * 100);
  if (amount === 0) {
    return "C";
  }
  return `${pan < 0 ? "L" : "R"}${amount}`;
};

type TrackAction = (trackId: string) => void;

/** An entry of a track's menu, there only when it is given its action. */
function TimelineTrackMenuItem({
  action,
  children,
  trackId,
  variant,
}: {
  action?: TrackAction;
  children: ReactNode;
  trackId: string;
  variant?: "destructive";
}) {
  const handleClick = useCallback(() => action?.(trackId), [action, trackId]);
  return action ? (
    <ContextMenuItem onClick={handleClick} variant={variant}>
      {children}
    </ContextMenuItem>
  ) : null;
}

/** A track's context menu: an entry for each action it is given, then the colors. */
function TimelineTrackMenu({
  folded,
  onColor,
  onDuplicate,
  onFold,
  onGroup,
  onInsert,
  onRemove,
  onRename,
  onUngroup,
  trackId,
}: {
  folded?: boolean;
  onColor: (event: MouseEvent<HTMLElement>) => void;
  onDuplicate?: TrackAction;
  onFold?: TrackAction;
  onGroup?: TrackAction;
  onInsert?: TrackAction;
  onRemove?: TrackAction;
  onRename?: () => void;
  onUngroup?: TrackAction;
  trackId: string;
}) {
  return (
    <ContextMenuContent className="w-auto min-w-36">
      {onRename ? (
        <ContextMenuItem onClick={onRename}>Rename</ContextMenuItem>
      ) : null}
      <TimelineTrackMenuItem action={onDuplicate} trackId={trackId}>
        Duplicate
      </TimelineTrackMenuItem>
      <TimelineTrackMenuItem action={onFold} trackId={trackId}>
        {folded ? "Unfold" : "Fold"}
      </TimelineTrackMenuItem>
      <TimelineTrackMenuItem action={onGroup} trackId={trackId}>
        Group
      </TimelineTrackMenuItem>
      <TimelineTrackMenuItem action={onUngroup} trackId={trackId}>
        Ungroup
      </TimelineTrackMenuItem>
      {onRemove ? <ContextMenuSeparator /> : null}
      <TimelineTrackMenuItem
        action={onRemove}
        trackId={trackId}
        variant="destructive"
      >
        Delete
      </TimelineTrackMenuItem>
      {onInsert ? <ContextMenuSeparator /> : null}
      <TimelineTrackMenuItem action={onInsert} trackId={trackId}>
        Insert track
      </TimelineTrackMenuItem>
      <ContextMenuSeparator />
      {TRACK_COLORS.map((swatch, index) => (
        <ContextMenuItem data-color={index} key={swatch.name} onClick={onColor}>
          <span
            aria-hidden="true"
            className={cn("size-2.5 rounded-full", swatch.dot)}
          />
          {swatch.name}
        </ContextMenuItem>
      ))}
    </ContextMenuContent>
  );
}

/**
 * What a track's header holds: its name, which selects the track (its content
 * is where the cursor goes), solo, mute and gain. The lower edge resizes it.
 */
function TimelineTrackControls({
  armed,
  children,
  compact,
  folded,
  mix,
  name,
  onMix,
  onMixCommit,
  onArm,
  onDuplicate,
  onGroup,
  onInsert,
  onRemove,
  onRename,
  onSelect,
  onToggleFold,
  onUngroup,
  meter,
  selected,
  trackId,
}: {
  /** Whether the track is armed to record. */
  armed?: boolean;
  /** Gives the header an Arm button. `exclusive` is false when Cmd or Ctrl is held: the other tracks stay armed (REC-001). */
  onArm?: (trackId: string, exclusive: boolean) => void;
  /** More rows under the mix, such as the automation's parameter chooser. A short track leaves them out. */
  children?: ReactNode;
  /** A level meter drawn down the header's right edge, such as a vertical `Meter` sized to fill it. */
  meter?: ReactNode;
  /** Whether the track is short: one row, with no gain. */
  compact: boolean;
  /** Whether the track is folded to a strip: the caret opens it. */
  folded?: boolean;
  /** Gives the header a caret that folds the track. */
  onToggleFold?: (trackId: string) => void;
  mix: Mix;
  name: string;
  onMix: (trackId: string, patch: Partial<Mix>) => void;
  /** Called when a drag of the gain or the pan ends, to close it as one undo step. */
  onMixCommit?: (trackId: string) => void;
  /** Gives the menu a "Duplicate" entry. */
  onDuplicate?: (trackId: string) => void;
  /** Gives the menu a "Group" entry: the track, with the tracks picked, into a new group. */
  onGroup?: (trackId: string) => void;
  /** Gives the menu an "Insert track" entry: a new track after this one. */
  onInsert?: (trackId: string) => void;
  /** Gives the menu an "Ungroup" entry, for a group track: its tracks out of it, and the group removed. */
  onUngroup?: (trackId: string) => void;
  /** Lets the name be edited in place: a double-click, or "Rename" in the menu. */
  onRename?: (trackId: string, name: string) => void;
  /** Gives the menu a "Delete track" entry. Leave it out for tracks that cannot be removed. */
  onRemove?: (trackId: string) => void;
  /** `additive` when Shift, Cmd or Ctrl is held: add the track to the tracks picked. */
  onSelect: (trackId: string, additive: boolean) => void;
  selected: boolean;
  trackId: string;
}) {
  const handleMute = useCallback(
    () => onMix(trackId, { muted: !mix.muted }),
    [mix.muted, onMix, trackId]
  );
  const handleSolo = useCallback(
    () => onMix(trackId, { soloed: !mix.soloed }),
    [mix.soloed, onMix, trackId]
  );
  const handleArm = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      onArm?.(trackId, !(event.metaKey || event.ctrlKey)),
    [onArm, trackId]
  );
  const handleGain = useCallback(
    (value: number | readonly number[]) =>
      onMix(trackId, {
        gain: gainOfDb(Array.isArray(value) ? value[0] : value),
      }),
    [onMix, trackId]
  );
  const handlePan = useCallback(
    (value: number | readonly number[]) =>
      onMix(trackId, { pan: Array.isArray(value) ? value[0] : Number(value) }),
    [onMix, trackId]
  );
  const handleMixCommit = useCallback(
    () => onMixCommit?.(trackId),
    [onMixCommit, trackId]
  );
  const handleColor = useCallback(
    (event: MouseEvent<HTMLElement>) =>
      onMix(trackId, { color: Number(event.currentTarget.dataset.color) }),
    [onMix, trackId]
  );
  const [renaming, setRenaming] = useState(false);
  const startRenaming = useCallback(() => setRenaming(true), []);
  // The menu hands focus back as it closes, which would end the edit: open the field after it.
  const renameWhenClosed = useRef(false);
  const handleMenuClosed = useCallback((open: boolean) => {
    if (!open && renameWhenClosed.current) {
      renameWhenClosed.current = false;
      setRenaming(true);
    }
  }, []);
  const handleRenameItem = useCallback(() => {
    renameWhenClosed.current = true;
  }, []);
  const handleNameKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        onRename?.(trackId, event.currentTarget.value);
        setRenaming(false);
      } else if (event.key === "Escape") {
        setRenaming(false);
      }
    },
    [onRename, trackId]
  );
  const handleNameBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      onRename?.(trackId, event.currentTarget.value);
      setRenaming(false);
    },
    [onRename, trackId]
  );
  const handleFold = useCallback(
    () => onToggleFold?.(trackId),
    [onToggleFold, trackId]
  );
  const handleClick = useCallback(
    (event: MouseEvent<HTMLElement>) =>
      onSelect(trackId, event.shiftKey || event.metaKey || event.ctrlKey),
    [onSelect, trackId]
  );
  // The whole header picks the track, but not through a control that has its own job.
  const handleHeaderClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const target = event.target as Element;
      if (
        !target.closest(
          "button, input, [data-slot^=fader], [data-slot=knob], [data-slot=timeline-track-resize-handle]"
        )
      ) {
        handleClick(event);
      }
    },
    [handleClick]
  );
  return (
    <ContextMenu onOpenChangeComplete={handleMenuClosed}>
      <ContextMenuTrigger
        render={
          // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: a larger target for the name button, which carries the keyboard and the accessible name
          <div
            className={cn(
              "@container/header relative flex w-full cursor-default flex-col justify-center border-s-4",
              // A strip is as tall as its buttons plus an equal margin all round, so they sit concentric with its corners.
              compact ? "ps-4 pe-4 py-0" : "gap-1.5 ps-4 pe-5 py-2.5",
              TRACK_COLORS[mix.color]?.edge
            )}
            onClick={handleHeaderClick}
          />
        }
      >
        <div className="flex items-center gap-1">
          {onToggleFold ? (
            <Button
              aria-expanded={!folded}
              aria-label={`${folded ? "Unfold" : "Fold"} ${name}`}
              onClick={handleFold}
              size="icon-xs"
              variant="ghost"
            >
              <CaretRightIcon className={cn(!folded && "rotate-90")} />
            </Button>
          ) : null}
          {renaming ? (
            <input
              aria-label="Track name"
              autoFocus
              className="min-w-0 flex-1 bg-transparent font-medium outline-none"
              defaultValue={name}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              ref={selectText}
            />
          ) : (
            <button
              aria-pressed={selected}
              className={cn(
                "min-w-0 flex-1 truncate text-left font-medium outline-none hover:underline focus-visible:underline",
                compact && "ps-1.5"
              )}
              onClick={handleClick}
              onDoubleClick={onRename ? startRenaming : undefined}
              type="button"
            >
              {name}
            </button>
          )}
          {/* Its switches, one stop of Tab and the arrows between them: each holds its state, pressed or not. */}
          <ToggleGroup
            aria-label={`${name} switches`}
            multiple
            size="sm"
            spacing={1}
            value={switchesOn(mix, armed)}
          >
            <ToggleGroupItem
              aria-label={`Solo ${name}`}
              className={cn(TRACK_SWITCH, SWITCH_TONES.solo)}
              onClick={handleSolo}
              value="solo"
            >
              S
            </ToggleGroupItem>
            <ToggleGroupItem
              aria-label={`Mute ${name}`}
              className={cn(TRACK_SWITCH, SWITCH_TONES.mute)}
              onClick={handleMute}
              value="mute"
            >
              M
            </ToggleGroupItem>
            {onArm ? (
              <ToggleGroupItem
                aria-label={`Arm ${name}`}
                className={TRACK_SWITCH}
                onClick={handleArm}
                value="arm"
              >
                {/* A light, as on a console: lit red while the track is armed, a dim dot when not. */}
                <span aria-hidden="true" className="contents">
                  <Led label="Armed" on={Boolean(armed)} tone="destructive" />
                </span>
              </ToggleGroupItem>
            ) : null}
          </ToggleGroup>
        </div>
        {compact ? null : (
          <div className="flex h-7 items-center gap-6 pe-1">
            <Fader
              aria-label={`${name} gain`}
              className="ms-2.5 min-w-0 flex-1 **:data-[orientation=horizontal]:min-w-0 **:data-[slot=fader-value]:top-full **:data-[slot=fader-value]:bottom-auto **:data-[slot=fader-value]:mt-1 **:data-[slot=fader-value]:mb-0"
              editableValue
              formatValue={formatGainDb}
              max={TRACK_MAX_DB}
              min={TRACK_MIN_DB}
              onValueChange={handleGain}
              onValueCommitted={handleMixCommit}
              orientation="horizontal"
              size="sm"
              step={0.5}
              thumbMarks={false}
              value={Math.max(TRACK_MIN_DB, gainToDb(mix.gain))}
              valueLabel="auto"
            />
            <Knob
              anchor={0}
              aria-label={`${name} pan`}
              className="mb-0 size-7 shrink-0"
              editableValue
              formatValue={formatPan}
              max={1}
              min={-1}
              onValueChange={handlePan}
              onValueCommitted={handleMixCommit}
              size="sm"
              step={0.01}
              value={mix.pan}
            />
          </div>
        )}
        {compact ? null : <div className="contents">{children}</div>}
        {meter ? (
          <div className="pointer-events-none absolute inset-y-1.5 end-1.5 w-2">
            {meter}
          </div>
        ) : null}
        <TimelineTrackResizeHandle aria-label={`${name} height`} />
      </ContextMenuTrigger>
      <TimelineTrackMenu
        folded={folded}
        onColor={handleColor}
        onDuplicate={onDuplicate}
        onFold={onToggleFold}
        onGroup={onGroup}
        onInsert={onInsert}
        onRemove={onRemove}
        onRename={onRename ? handleRenameItem : undefined}
        onUngroup={onUngroup}
        trackId={trackId}
      />
    </ContextMenu>
  );
}

/** The menu items of the grid, for a context menu or a dropdown menu. */
type GridMenuKit = {
  RadioGroup: typeof ContextMenuRadioGroup;
  RadioItem: typeof ContextMenuRadioItem;
  CheckboxItem: typeof ContextMenuCheckboxItem;
  Separator: typeof ContextMenuSeparator;
};

const CONTEXT_GRID_KIT: GridMenuKit = {
  RadioGroup: ContextMenuRadioGroup,
  RadioItem: ContextMenuRadioItem,
  CheckboxItem: ContextMenuCheckboxItem,
  Separator: ContextMenuSeparator,
};

const DROPDOWN_GRID_KIT: GridMenuKit = {
  RadioGroup: DropdownMenuRadioGroup,
  RadioItem: DropdownMenuRadioItem,
  CheckboxItem: DropdownMenuCheckboxItem,
  Separator: DropdownMenuSeparator,
};

/** The grid's divisions and its two flags, as the menu a right-click on a lane or a dropdown opens. */
function TimelineGridMenuItems({
  division,
  divisions,
  onDivisionChange,
  onSnapChange,
  onTripletChange,
  snap,
  triplet,
  variant = "context",
}: {
  division: string;
  divisions: { label: string; value: string }[];
  onDivisionChange: (value: string) => void;
  onSnapChange: (checked: boolean) => void;
  onTripletChange: (checked: boolean) => void;
  snap: boolean;
  triplet: boolean;
  variant?: "context" | "dropdown";
}) {
  const { RadioGroup, RadioItem, CheckboxItem, Separator } =
    variant === "dropdown" ? DROPDOWN_GRID_KIT : CONTEXT_GRID_KIT;
  return (
    <>
      <RadioGroup onValueChange={onDivisionChange} value={division}>
        {divisions.map((item) => (
          <RadioItem key={item.value} value={item.value}>
            {item.label.replace("Grid: ", "")}
          </RadioItem>
        ))}
      </RadioGroup>
      <Separator />
      <CheckboxItem checked={triplet} onCheckedChange={onTripletChange}>
        Triplet grid
      </CheckboxItem>
      <CheckboxItem checked={snap} onCheckedChange={onSnapChange}>
        Snap to grid
      </CheckboxItem>
    </>
  );
}

export {
  Timeline,
  TimelineClip,
  TimelineClipFade,
  TimelineClipFadeHandle,
  TimelineClipHandle,
  TimelineClipHeader,
  TimelineGridMenuItems,
  TimelineLane,
  TimelineMark,
  TimelineNavigator,
  TimelinePlayhead,
  TimelineRange,
  TimelineRangeHandle,
  TimelineRuler,
  TimelineTrack,
  TimelineTrackControls,
  TimelineTrackHeader,
  TimelineTrackResizeHandle,
  TimelineViewport,
};