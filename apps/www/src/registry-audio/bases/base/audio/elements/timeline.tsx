"use client";

import { Timeline as TimelinePrimitive } from "@audio-ui/react";
import {
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/registry/bases/base/ui/context-menu";
import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";
import type { Mix } from "@/registry-audio/bases/base/lib/arrangement";

function Timeline({ className, ...props }: TimelinePrimitive.Root.Props) {
  return (
    <TimelinePrimitive.Root
      className={cn(
        "cn-timeline flex w-full min-w-0 flex-col data-disabled:opacity-50",
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
        "cn-timeline-viewport relative min-h-0 min-w-0 overscroll-x-contain",
        scrollbar === "hidden" &&
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
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
        "cn-timeline-ruler shrink-0 cursor-pointer touch-none select-none",
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
      className={cn("cn-timeline-lane", className)}
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
        "cn-timeline-track-header hover:[--timeline-track-header-z:30] focus-within:[--timeline-track-header-z:30]",
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
        "cn-timeline-track-resize-handle absolute touch-none outline-none before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
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
        "cn-timeline-mark pointer-events-none inset-y-0 flex items-center",
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
        "cn-timeline-playhead pointer-events-none inset-y-0 w-px",
        className
      )}
      data-slot="timeline-playhead"
      {...props}
    />
  );
}

function TimelineRange({ className, ...props }: TimelinePrimitive.Range.Props) {
  return (
    <TimelinePrimitive.Range
      className={cn(
        "cn-timeline-range inset-y-0 cursor-grab touch-none data-dragging:cursor-grabbing data-disabled:cursor-not-allowed",
        className
      )}
      data-slot="timeline-range"
      {...props}
    />
  );
}

function TimelineRangeHandle({
  className,
  ...props
}: TimelinePrimitive.RangeHandle.Props) {
  return (
    <TimelinePrimitive.RangeHandle
      className={cn(
        "cn-timeline-range-handle absolute inset-y-0 w-1.5 cursor-ew-resize data-[edge=end]:right-0 data-[edge=start]:left-0",
        "after:absolute after:-inset-x-1.5 after:inset-y-0 pointer-coarse:after:-inset-x-3",
        className
      )}
      data-slot="timeline-range-handle"
      {...props}
    />
  );
}

function TimelineClip({ className, ...props }: TimelinePrimitive.Clip.Props) {
  return (
    <TimelinePrimitive.Clip
      className={cn(
        "cn-timeline-clip group/clip isolate inset-y-0 touch-none data-dragging:z-10 data-disabled:cursor-not-allowed",
        className
      )}
      data-slot="timeline-clip"
      {...props}
    />
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
        "cn-timeline-clip-header flex h-5 cursor-grab items-center truncate px-2 text-xs data-dragging:cursor-grabbing data-disabled:cursor-not-allowed",
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
        "cn-timeline-clip-handle absolute inset-y-0 z-10 w-1.5 cursor-ew-resize data-[edge=end]:right-0 data-[edge=start]:left-0",
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
      className={cn("cn-timeline-clip-fade", className)}
      data-slot="timeline-clip-fade"
      {...props}
    />
  );
}

function TimelineClipFadeHandle({
  className,
  ...props
}: TimelinePrimitive.ClipFadeHandle.Props) {
  return (
    <TimelinePrimitive.ClipFadeHandle
      className={cn(
        "cn-timeline-clip-fade-handle top-0 z-20 size-2.5 cursor-ew-resize opacity-0 transition-opacity",
        "group-hover/clip:opacity-100 group-data-[selected]/clip:opacity-100 data-dragging:opacity-100 has-focus-visible:opacity-100",
        "after:absolute after:-inset-1 pointer-coarse:opacity-100 pointer-coarse:after:-inset-2",
        className
      )}
      data-slot="timeline-clip-fade-handle"
      {...props}
    />
  );
}

/** The whole timeline as one bar: drag the window to scroll, an edge to zoom, double-click to show everything. */
function TimelineNavigator({
  className,
  ...props
}: TimelinePrimitive.Navigator.Props) {
  return (
    <TimelinePrimitive.Navigator
      className={cn("cn-timeline-navigator shrink-0 select-none", className)}
      data-slot="timeline-navigator"
      {...props}
    >
      <TimelinePrimitive.NavigatorWindow
        aria-label="Visible range"
        className="cn-timeline-navigator-window inset-y-0 cursor-grab active:cursor-grabbing"
      />
      <TimelinePrimitive.NavigatorHandle
        aria-label="Start of the visible range"
        className="cn-timeline-navigator-handle inset-y-0 w-2 cursor-ew-resize data-[edge=end]:-translate-x-full after:absolute after:-inset-x-1.5 after:inset-y-0"
        edge="start"
      />
      <TimelinePrimitive.NavigatorHandle
        aria-label="End of the visible range"
        className="cn-timeline-navigator-handle inset-y-0 w-2 cursor-ew-resize data-[edge=end]:-translate-x-full after:absolute after:-inset-x-1.5 after:inset-y-0"
        edge="end"
      />
    </TimelinePrimitive.Navigator>
  );
}

const selectText = (element: HTMLInputElement | null) => element?.select();

export const MIN_TRACK_HEIGHT = 28;
/** Below this a track is a strip: the full header (name, solo, mute, gain, pan) needs this much room, so a shorter track keeps the name, solo and mute and drops the rest. */
export const COMPACT_TRACK_HEIGHT = 79;
export const MAX_TRACK_HEIGHT = 240;
export const TRACK_HEIGHT_STEP = 8;

/** The colors a track can take: the theme's chart tokens, written out for the stylesheet to find. */
export const TRACK_COLORS = [
  {
    dot: "bg-chart-1",
    clip: "[--primary:var(--chart-1)]",
    edge: "border-s-chart-1",
    name: "Color 1",
  },
  {
    dot: "bg-chart-2",
    clip: "[--primary:var(--chart-2)]",
    edge: "border-s-chart-2",
    name: "Color 2",
  },
  {
    dot: "bg-chart-3",
    clip: "[--primary:var(--chart-3)]",
    edge: "border-s-chart-3",
    name: "Color 3",
  },
  {
    dot: "bg-chart-4",
    clip: "[--primary:var(--chart-4)]",
    edge: "border-s-chart-4",
    name: "Color 4",
  },
  {
    dot: "bg-chart-5",
    clip: "[--primary:var(--chart-5)]",
    edge: "border-s-chart-5",
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

/**
 * What a track's header holds: its name, which selects the track (its content
 * is where the cursor goes), solo, mute and gain. The lower edge resizes it.
 */
function TimelineTrackControls({
  compact,
  folded,
  mix,
  name,
  onMix,
  onDuplicate,
  onInsert,
  onRemove,
  onRename,
  onSelect,
  onToggleFold,
  selected,
  trackId,
}: {
  /** Whether the track is short: one row, with no gain. */
  compact: boolean;
  /** Whether the track is folded to a strip: the caret opens it. */
  folded?: boolean;
  /** Gives the header a caret that folds the track. */
  onToggleFold?: (trackId: string) => void;
  mix: Mix;
  name: string;
  onMix: (trackId: string, patch: Partial<Mix>) => void;
  /** Gives the menu a "Duplicate" entry. */
  onDuplicate?: (trackId: string) => void;
  /** Gives the menu an "Insert track" entry: a new track after this one. */
  onInsert?: (trackId: string) => void;
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
  const handleGain = useCallback(
    (value: number | readonly number[]) =>
      onMix(trackId, { gain: Array.isArray(value) ? value[0] : Number(value) }),
    [onMix, trackId]
  );
  const handlePan = useCallback(
    (value: number | readonly number[]) =>
      onMix(trackId, { pan: Array.isArray(value) ? value[0] : Number(value) }),
    [onMix, trackId]
  );
  const handleColor = useCallback(
    (event: MouseEvent<HTMLElement>) =>
      onMix(trackId, { color: Number(event.currentTarget.dataset.color) }),
    [onMix, trackId]
  );
  const handleRemove = useCallback(
    () => onRemove?.(trackId),
    [onRemove, trackId]
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
  const handleDuplicate = useCallback(
    () => onDuplicate?.(trackId),
    [onDuplicate, trackId]
  );
  const handleInsert = useCallback(
    () => onInsert?.(trackId),
    [onInsert, trackId]
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
              compact ? "px-[1.5px] py-0" : "gap-1.5 px-2 py-2.5",
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
              className="@max-[10rem]/header:hidden"
              onClick={handleFold}
              size="icon-xs"
              variant="ghost"
            >
              <IconPlaceholder
                className={cn(!folded && "rotate-90")}
                hugeicons="ArrowRight01Icon"
                lucide="ChevronRightIcon"
                phosphor="CaretRightIcon"
                remixicon="RiArrowRightSLine"
                tabler="IconChevronRight"
              />
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
          <Button
            aria-label={`Solo ${name}`}
            aria-pressed={mix.soloed}
            onClick={handleSolo}
            size="icon-xs"
            variant={mix.soloed ? "default" : "ghost"}
          >
            <IconPlaceholder
              hugeicons="HeadphonesIcon"
              lucide="HeadphonesIcon"
              phosphor="HeadphonesIcon"
              remixicon="RiHeadphoneLine"
              tabler="IconHeadphones"
            />
          </Button>
          <Button
            aria-label={`Mute ${name}`}
            aria-pressed={mix.muted}
            onClick={handleMute}
            size="icon-xs"
            variant={mix.muted ? "default" : "ghost"}
          >
            {mix.muted ? (
              <IconPlaceholder
                hugeicons="VolumeMute01Icon"
                lucide="VolumeXIcon"
                phosphor="SpeakerSimpleSlashIcon"
                remixicon="RiVolumeMuteLine"
                tabler="IconVolumeOff"
              />
            ) : (
              <IconPlaceholder
                hugeicons="VolumeHighIcon"
                lucide="Volume2Icon"
                phosphor="SpeakerSimpleHighIcon"
                remixicon="RiVolumeUpLine"
                tabler="IconVolume"
              />
            )}
          </Button>
        </div>
        {compact ? null : (
          <div className="flex h-7 items-center gap-5 pe-1">
            <Fader
              aria-label={`${name} gain`}
              className="ms-2.5 min-w-0 flex-1 **:data-[orientation=horizontal]:min-w-0 **:data-[slot=fader-value]:top-full **:data-[slot=fader-value]:bottom-auto **:data-[slot=fader-value]:mt-1 **:data-[slot=fader-value]:mb-0"
              editableValue
              max={1}
              min={0}
              onValueChange={handleGain}
              orientation="horizontal"
              size="sm"
              step={0.01}
              thumbMarks={false}
              value={mix.gain}
              valueLabel="auto"
            />
            <Knob
              anchor={0}
              aria-label={`${name} pan`}
              className="mb-0 size-7 shrink-0 @max-[10rem]/header:hidden"
              editableValue
              formatValue={formatPan}
              max={1}
              min={-1}
              onValueChange={handlePan}
              size="sm"
              step={0.01}
              value={mix.pan}
            />
          </div>
        )}
        <TimelineTrackResizeHandle aria-label={`${name} height`} />
      </ContextMenuTrigger>
      <ContextMenuContent className="w-auto min-w-36">
        {onRename ? (
          <ContextMenuItem onClick={handleRenameItem}>Rename</ContextMenuItem>
        ) : null}
        {onDuplicate ? (
          <ContextMenuItem onClick={handleDuplicate}>Duplicate</ContextMenuItem>
        ) : null}
        {onToggleFold ? (
          <ContextMenuItem onClick={handleFold}>
            {folded ? "Unfold" : "Fold"}
          </ContextMenuItem>
        ) : null}
        {onRemove ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleRemove} variant="destructive">
              Delete
            </ContextMenuItem>
          </>
        ) : null}
        {onInsert ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleInsert}>
              Insert track
            </ContextMenuItem>
          </>
        ) : null}
        <ContextMenuSeparator />
        {TRACK_COLORS.map((swatch, index) => (
          <ContextMenuItem
            data-color={index}
            key={swatch.name}
            onClick={handleColor}
          >
            <span
              aria-hidden="true"
              className={cn("size-2.5 rounded-full", swatch.dot)}
            />
            {swatch.name}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export {
  Timeline,
  TimelineClip,
  TimelineClipFade,
  TimelineClipFadeHandle,
  TimelineClipHandle,
  TimelineClipHeader,
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
