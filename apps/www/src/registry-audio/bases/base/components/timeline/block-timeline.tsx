"use client";

import {
  adjacentPoint,
  type FadeShape,
  type Timeline as TimelinePrimitive,
} from "@audio-ui/react";
import {
  type FocusEvent,
  Fragment,
  type KeyboardEvent,
  type MouseEvent,
  memo,
  type PointerEvent,
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import { ButtonGroup } from "@/registry/bases/base/ui/button-group";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/registry/bases/base/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/registry/bases/base/ui/dropdown-menu";
import { Kbd, KbdGroup } from "@/registry/bases/base/ui/kbd";
import { NumberControl } from "@/registry-audio/bases/base/audio/elements/bpm-control";
import { Meter } from "@/registry-audio/bases/base/audio/elements/meter";
import {
  COMPACT_TRACK_HEIGHT,
  MAX_TRACK_HEIGHT,
  MIN_TRACK_HEIGHT,
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
  TimelineViewport,
  TRACK_COLORS,
  TRACK_HEIGHT_STEP,
} from "@/registry-audio/bases/base/audio/elements/timeline";
import { Transport } from "@/registry-audio/bases/base/audio/elements/transport";
import {
  type ClipAction,
  useArrangement,
} from "@/registry-audio/bases/base/hooks/use-arrangement";
import { useMarquee } from "@/registry-audio/bases/base/hooks/use-marquee-selection";
import { usePlaybackClock } from "@/registry-audio/bases/base/hooks/use-playback-clock";
import { useSimulatedLevels } from "@/registry-audio/bases/base/hooks/use-simulated-levels";
import type {
  Arranged,
  ArrangementTrack,
} from "@/registry-audio/bases/base/lib/arrangement";
import {
  barLabelInterval,
  DEFAULT_TEMPO,
  describeBarsBeats,
  GRID_DIVISIONS,
  type GridDivision,
  gridInterval,
  type MetronomeRhythm,
  secondsPerBar,
  type Tempo,
} from "@/registry-audio/bases/base/lib/musical-time";

const BARS = 32;
/** The arrangement is laid out at the first tempo; a tempo change keeps its musical positions. */
const BAR = secondsPerBar(DEFAULT_TEMPO);
/** The width of a track header, which the lanes start after. */
const LEAD_PX = 160;
const MAX_ZOOM = 240;
/** The zoom's steps are loupes, not a minus and a plus. */
const ZOOM_STEPPERS = {
  decrement: "Zoom out",
  icons: {
    decrement: (
      <IconPlaceholder
        hugeicons="ZoomOutAreaIcon"
        lucide="ZoomOutIcon"
        phosphor="MagnifyingGlassMinusIcon"
        remixicon="RiZoomOutLine"
        tabler="IconZoomOut"
      />
    ),
    increment: (
      <IconPlaceholder
        hugeicons="ZoomInAreaIcon"
        lucide="ZoomInIcon"
        phosphor="MagnifyingGlassPlusIcon"
        remixicon="RiZoomInLine"
        tabler="IconZoomIn"
      />
    ),
  },
  increment: "Zoom in",
};

/** How the zoom is shown: as a share of the fitted view. */
const PERCENT: Intl.NumberFormatOptions = {
  maximumFractionDigits: 0,
  style: "percent",
};

const bars = (count: number) => count * BAR;

const TRACKS: ArrangementTrack[] = [
  { color: 0, id: "drums", name: "Drums" },
  { color: 1, id: "bass", name: "Bass" },
  { color: 2, id: "keys", name: "Keys" },
  { color: 3, id: "vocals", name: "Vocals" },
] as const;

/** A clip's menu: what is done to it, then what is done away with. */
function clipMenuEntries(disabled: boolean): {
  action: ClipAction;
  destructive?: boolean;
  label: string;
  separatorBefore?: boolean;
}[] {
  return [
    { action: "rename", label: "Rename" },
    { action: "duplicate", label: "Duplicate" },
    { action: "split", label: "Split at the cursor", separatorBefore: true },
    {
      action: "toggle",
      label: disabled ? "Switch clip on" : "Switch clip off",
    },
    {
      action: "remove",
      destructive: true,
      label: "Delete",
      separatorBefore: true,
    },
  ];
}

const selectText = (element: HTMLInputElement | null) => element?.select();

/** A clip's name edited where it is written: Enter keeps it, Escape gives it back. */
function ClipNameField({
  name,
  onCommit,
  onDone,
}: {
  name: string;
  onCommit: (name: string) => void;
  onDone: () => void;
}) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      // The clip drags, deletes and splits on its own keys, and so does the panel: a name must not.
      event.stopPropagation();
      if (event.key === "Enter") {
        onCommit(event.currentTarget.value);
        onDone();
      } else if (event.key === "Escape") {
        onDone();
      }
    },
    [onCommit, onDone]
  );
  const handleBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      onCommit(event.currentTarget.value);
      onDone();
    },
    [onCommit, onDone]
  );
  const stop = useCallback(
    (event: SyntheticEvent) => event.stopPropagation(),
    []
  );
  return (
    <input
      aria-label="Clip name"
      className="min-w-0 flex-1 bg-transparent outline-none"
      defaultValue={name}
      onBlur={handleBlur}
      onClick={stop}
      onDoubleClick={stop}
      onKeyDown={handleKeyDown}
      onPointerDown={stop}
      ref={selectText}
    />
  );
}

/** What a track meter shows while nothing plays: one channel. */
const SILENCE_MONO = {
  getSnapshot: () => ({ levels: [-60], peaks: [-60] }),
  subscribe: () => () => undefined,
};

/** What the master meter shows while nothing plays. */
const SILENCE = {
  getSnapshot: () => ({ levels: [-60, -60], peaks: [-60, -60] }),
  subscribe: () => () => undefined,
};

type Span = readonly [number, number];

const arranged = (
  id: string,
  name: string,
  track: string,
  from: number,
  to: number
): Arranged => ({
  id,
  name,
  sourceLength: bars(to - from + 2),
  track,
  value: {
    fadeIn: 0,
    fadeOut: 0,
    length: bars(to - from),
    offset: 0,
    start: bars(from),
  },
});

const CLIPS: Arranged[] = [
  arranged("d1", "Intro", "drums", 0, 4),
  arranged("d2", "Groove", "drums", 4, 16),
  arranged("d3", "Groove", "drums", 16, 28),
  arranged("d4", "Fill", "drums", 28, 32),
  arranged("b1", "Sub", "bass", 4, 12),
  arranged("b2", "Sub", "bass", 16, 28),
  arranged("k1", "Pad", "keys", 0, 8),
  arranged("k2", "Chords", "keys", 8, 16),
  arranged("k3", "Pad", "keys", 20, 32),
  arranged("v1", "Verse", "vocals", 8, 16),
  arranged("v2", "Hook", "vocals", 16, 24),
];

/** A row of the arrangement: the track's header stuck to the left edge as it scrolls, its lane beside it. */
function Row({
  children,
  className,
  height,
  lead,
  onResize,
  selected,
  trackId,
}: {
  children: ReactNode;
  className?: string;
  /** A height set by hand: the row keeps it instead of sharing what is left. */
  height?: number;
  lead?: ReactNode;
  onResize?: (trackId: string, height: number | undefined) => void;
  selected?: boolean;
  trackId?: string;
}) {
  const handleHeight = useCallback(
    (next: number | undefined) => {
      if (trackId !== undefined) {
        onResize?.(trackId, next);
      }
    },
    [onResize, trackId]
  );
  return (
    <TimelineTrack
      className={className}
      height={height}
      maxHeight={MAX_TRACK_HEIGHT}
      minHeight={MIN_TRACK_HEIGHT}
      onHeightChange={handleHeight}
      selected={selected}
      step={TRACK_HEIGHT_STEP}
    >
      <TimelineTrackHeader className="relative flex items-stretch">
        {lead}
      </TimelineTrackHeader>
      <div className="flex flex-1 flex-col">{children}</div>
    </TimelineTrack>
  );
}

/** Adaptive follows the zoom; the others stay put however far you zoom. */
const DIVISIONS: { label: string; value: GridDivision }[] = [
  { label: "Grid: Adaptive", value: "adaptive" },
  ...GRID_DIVISIONS.map((entry) => ({
    label:
      "bars" in entry
        ? `Grid: ${entry.bars} ${entry.bars === 1 ? "bar" : "bars"}`
        : `Grid: ${entry.id}`,
    value: entry.id as GridDivision,
  })),
];

/** What the keyboard does, for the shortcuts popover: the keys, then what they do. */
const SHORTCUTS: { action: string; keys: string[] }[] = [
  { action: "Split at the cursor", keys: ["S"] },
  { action: "Split at the cursor", keys: ["Cmd/Ctrl", "E"] },
  { action: "Duplicate the clip", keys: ["Cmd/Ctrl", "D"] },
  { action: "Remove the clip, or the tracks picked", keys: ["Delete"] },
  { action: "Add a track to the tracks picked", keys: ["Shift", "Click"] },
  { action: "Duplicate the tracks picked", keys: ["Cmd/Ctrl", "D"] },
  { action: "Add a locator at the cursor", keys: ["M"] },
  { action: "Loop the selection", keys: ["Cmd/Ctrl", "L"] },
  { action: "Rename a locator", keys: ["Enter"] },
  {
    action: "Jump to the previous or next locator",
    keys: ["Alt", "Left", "Right"],
  },
  { action: "Nudge a clip or an edge", keys: ["Left", "Right"] },
  { action: "Nudge further", keys: ["Shift", "Left", "Right"] },
  { action: "Copy a clip while dragging", keys: ["Alt", "Drag"] },
  { action: "Move or trim off the grid", keys: ["Cmd/Ctrl", "Drag"] },
  { action: "Zoom around the pointer", keys: ["Cmd/Ctrl", "Scroll"] },
  { action: "Resize a track", keys: ["Up", "Down"] },
  { action: "Add a clip to the selection", keys: ["Shift", "Click"] },
  { action: "Undo", keys: ["Cmd/Ctrl", "Z"] },
  { action: "Redo", keys: ["Cmd/Ctrl", "Shift", "Z"] },
  { action: "Select every clip", keys: ["Cmd/Ctrl", "A"] },
  { action: "Select by dragging a rectangle", keys: ["Shift", "Drag"] },
  { action: "Clear the selection", keys: ["Esc"] },
];

interface Locator {
  at: number;
  name: string;
}

/**
 * A locator: press it to put the cursor there, double-click it or press
 * Enter to rename it (Enter keeps the name, Escape drops the change), Delete
 * takes it away.
 */
function LocatorButton({
  locator,
  onJump,
  onRemove,
  onRename,
}: {
  locator: Locator;
  onJump: (at: number) => void;
  onRemove: (at: number) => void;
  onRename: (at: number, name: string) => void;
}) {
  const { at, name } = locator;
  const [editing, setEditing] = useState(false);
  const handleClick = useCallback(() => onJump(at), [at, onJump]);
  const startEditing = useCallback(() => setEditing(true), []);
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        event.stopPropagation();
        onRemove(at);
      } else if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        setEditing(true);
      }
    },
    [at, onRemove]
  );
  const handleEditKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        const next = event.currentTarget.value.trim();
        if (next) {
          onRename(at, next);
        }
        setEditing(false);
      } else if (event.key === "Escape") {
        setEditing(false);
      }
    },
    [at, onRename]
  );
  const handleBlur = useCallback(() => setEditing(false), []);
  const handleRemove = useCallback(() => onRemove(at), [at, onRemove]);
  // The menu hands focus back as it closes, which would end the edit: open the field after it.
  const renameLater = useRef(false);
  const renameWhenClosed = useCallback(() => {
    renameLater.current = true;
  }, []);
  const handleMenuClosed = useCallback((open: boolean) => {
    if (!open && renameLater.current) {
      renameLater.current = false;
      setEditing(true);
    }
  }, []);

  if (editing) {
    return (
      <input
        aria-label="Locator name"
        autoFocus
        className="h-full w-24 border-primary border-s-2 bg-background px-1 text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
        defaultValue={name}
        onBlur={handleBlur}
        onKeyDown={handleEditKeyDown}
        onPointerDown={stopPress}
      />
    );
  }
  return (
    <ContextMenu onOpenChangeComplete={handleMenuClosed}>
      <ContextMenuTrigger
        render={
          <button
            aria-label={`Locator ${name}`}
            className="pointer-events-auto flex h-full items-center whitespace-nowrap border-primary border-s-2 ps-1 pe-2 text-primary text-xs outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
            onClick={handleClick}
            onDoubleClick={startEditing}
            onKeyDown={handleKeyDown}
            type="button"
          />
        }
      >
        {name}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-auto min-w-32">
        <ContextMenuItem onClick={renameWhenClosed}>Rename</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleRemove} variant="destructive">
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** Keeps a press inside a field from reaching the lane under it. */
function stopPress(event: PointerEvent<HTMLElement>) {
  event.stopPropagation();
}

/** The original of a clip being copied, left in its place while the copy is dragged away. */
function CopyGhost({ clip }: { clip: Arranged }) {
  const { length, start } = clip.value;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-1.5 overflow-hidden rounded-[inherit] border border-primary border-dashed bg-primary/10 px-2 text-primary text-xs"
      style={{
        left: `calc(var(--timeline-unit) * ${start})`,
        width: `calc(var(--timeline-unit) * ${length})`,
      }}
    >
      {clip.name}
    </div>
  );
}

/** A track's level, from a stand-in source: the block plays nothing, so it moves while the track would be heard. */
function TrackLevel({ active, name }: { active: boolean; name: string }) {
  const simulated = useSimulatedLevels(1);
  return (
    <Meter
      aria-label={`${name} level`}
      className="data-[orientation=vertical]:h-full [--meter-thickness:--spacing(2)]"
      orientation="vertical"
      peakMarks="hidden"
      size="sm"
      source={active ? simulated : SILENCE_MONO}
      warnThreshold={-12}
    />
  );
}

/** One clip: move it, trim either edge into its recording, fade it in and out. */
const ClipView = memo(function ArrangedClip({
  clip,
  onChange,
  describe,
  onCommit,
  onRemove,
  onSelect,
  selected,
  copying,
  lift,
  onLift,
  multi,
  onAction,
  onFadeShape,
  onRename,
  swatch,
  trackName,
}: {
  clip: Arranged;
  /** Whether a press adds the clip to the selection, as Shift does: a touch screen has no Shift. */
  multi: boolean;
  /** A fade's curve was picked from the menu of its handle. */
  onFadeShape: (id: string, edge: "in" | "out", shape: FadeShape) => void;
  /** The clip's color, an index into `TRACK_COLORS`: the track's. */
  swatch: number;
  /** Something chosen from the clip's menu (renaming is the clip's own). */
  onAction: (action: ClipAction, id: string) => void;
  onRename: (id: string, name: string) => void;
  /** How far, in px, the clip is held up or down by a group drag that is not its own. */
  lift: number;
  /** Tells the arrangement how far this clip is dragged up or down, for the rest of its group to follow. */
  onLift: (id: string, offset: number) => void;
  /** Whether this clip is being dragged with Alt held: it is the copy, and the original stays behind. */
  copying: boolean;
  describe: (seconds: number) => string;
  onChange: (
    id: string,
    value: TimelinePrimitive.Clip.Value,
    details: TimelinePrimitive.Clip.ChangeEventDetails
  ) => void;
  onCommit: (
    id: string,
    details: TimelinePrimitive.Clip.CommitEventDetails
  ) => void;
  onRemove: (id: string) => void;
  onSelect: (id: string, additive: boolean) => void;
  selected: boolean;
  trackName: string;
}) {
  const handleRemove = useCallback(
    () => onRemove(clip.id),
    [clip.id, onRemove]
  );
  const handleFadeInShape = useCallback(
    (shape: FadeShape) => onFadeShape(clip.id, "in", shape),
    [clip.id, onFadeShape]
  );
  const handleFadeOutShape = useCallback(
    (shape: FadeShape) => onFadeShape(clip.id, "out", shape),
    [clip.id, onFadeShape]
  );
  const [renaming, setRenaming] = useState(false);
  const stopRenaming = useCallback(() => setRenaming(false), []);
  const startRenaming = useCallback(() => setRenaming(true), []);
  // The name field takes focus once the menu has closed: closing hands focus back to the clip, which would end the edit.
  const renameWhenClosed = useRef(false);
  const handleMenuClosed = useCallback(
    (open: boolean) => {
      if (!open && renameWhenClosed.current) {
        renameWhenClosed.current = false;
        startRenaming();
      }
    },
    [startRenaming]
  );
  const handleMenuItem = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const action = event.currentTarget.dataset.action as ClipAction;
      if (action === "rename") {
        renameWhenClosed.current = true;
      } else {
        onAction(action, clip.id);
      }
    },
    [clip.id, onAction]
  );
  const handleRename = useCallback(
    (name: string) => onRename(clip.id, name),
    [clip.id, onRename]
  );
  // Right-clicking a clip selects it first, so the menu acts on what was pressed.
  const handleMenuOpen = useCallback(
    (open: boolean) => {
      if (open) {
        onSelect(clip.id, false);
      }
    },
    [clip.id, onSelect]
  );
  const handleSelected = useCallback(
    (
      _selected: boolean,
      details: TimelinePrimitive.Clip.SelectEventDetails
    ) => {
      const { event } = details;
      onSelect(
        clip.id,
        multi || event.shiftKey || event.metaKey || event.ctrlKey
      );
    },
    [clip.id, multi, onSelect]
  );
  const handleChange = useCallback(
    (
      value: TimelinePrimitive.Clip.Value,
      details: TimelinePrimitive.Clip.ChangeEventDetails
    ) => onChange(clip.id, value, details),
    [clip.id, onChange]
  );
  const handleDragOffset = useCallback(
    (offset: number) => onLift(clip.id, offset),
    [clip.id, onLift]
  );
  const handleCommitted = useCallback(
    (
      _value: TimelinePrimitive.Clip.Value,
      details: TimelinePrimitive.Clip.CommitEventDetails
    ) => onCommit(clip.id, details),
    [clip.id, onCommit]
  );
  return (
    <ContextMenu
      onOpenChange={handleMenuOpen}
      onOpenChangeComplete={handleMenuClosed}
    >
      <ContextMenuTrigger render={<div className="contents" />}>
        <TimelineClip
          additive={multi}
          aria-label={`${trackName}, ${clip.name}`}
          className={cn(
            "inset-y-1.5",
            TRACK_COLORS[swatch]?.clip,
            copying && "opacity-90 shadow-lg ring-2 ring-primary",
            clip.disabled && "opacity-40"
          )}
          data-clip-id={clip.id}
          getAriaValueText={describe}
          onDragOffsetChange={handleDragOffset}
          onRemove={handleRemove}
          onSelectedChange={handleSelected}
          onValueChange={handleChange}
          onValueCommitted={handleCommitted}
          selected={selected}
          sourceLength={clip.sourceLength}
          style={
            lift
              ? { transform: `translateY(${lift}px)`, zIndex: 10 }
              : undefined
          }
          value={clip.value}
        >
          <TimelineClipHeader
            className={copying ? "cursor-copy" : undefined}
            onDoubleClick={startRenaming}
          >
            {renaming ? (
              <ClipNameField
                name={clip.name}
                onCommit={handleRename}
                onDone={stopRenaming}
              />
            ) : (
              <span>{copying ? `+ ${clip.name}` : clip.name}</span>
            )}
          </TimelineClipHeader>
          <TimelineClipFade edge="in" />
          <TimelineClipFade edge="out" />
          <TimelineClipHandle aria-label={`${clip.name} start`} edge="start" />
          <TimelineClipHandle aria-label={`${clip.name} end`} edge="end" />
          <TimelineClipFadeHandle
            aria-label={`${clip.name} fade in`}
            edge="in"
            onShapeChange={handleFadeInShape}
            shape={clip.value.fadeInShape}
          />
          <TimelineClipFadeHandle
            aria-label={`${clip.name} fade out`}
            edge="out"
            onShapeChange={handleFadeOutShape}
            shape={clip.value.fadeOutShape}
          />
        </TimelineClip>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-auto min-w-44">
        {clipMenuEntries(Boolean(clip.disabled)).map((entry) => (
          <Fragment key={entry.action}>
            {entry.separatorBefore ? <ContextMenuSeparator /> : null}
            <ContextMenuItem
              data-action={entry.action}
              onClick={handleMenuItem}
              variant={entry.destructive ? "destructive" : "default"}
            >
              {entry.label}
            </ContextMenuItem>
          </Fragment>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
});

/**
 * An arrangement: a bar ruler that seeks on the grid, a loop strip, a lane per
 * track with clips to move between tracks, trim and fade, a cursor to put
 * anywhere on a track and split at, and a playhead following a transport
 * clock. Cmd/Ctrl + scroll zooms around the pointer, and the bar below scrolls
 * and zooms. Made to be opened at full size, where the tracks take the screen.
 */
export default function BlockTimeline() {
  const [tempo, setTempo] = useState<Tempo>(DEFAULT_TEMPO);
  const bar = secondsPerBar(tempo);
  const duration = BARS * bar;
  const describe = useCallback(
    (seconds: number) => describeBarsBeats(seconds, tempo),
    [tempo]
  );
  const [loop, setLoop] = useState<Span>([bars(8), bars(16)]);
  const [looping, setLooping] = useState(true);
  // Locators: named points to jump to, kept in seconds at the tempo they were set.
  const [locators, setLocators] = useState<Locator[]>([
    { at: bars(4), name: "Verse" },
    { at: bars(20), name: "Chorus" },
  ]);
  const [metronome, setMetronome] = useState(false);
  const [rhythm, setRhythm] = useState<MetronomeRhythm>("auto");
  const { clock, playing, setPlaying } = usePlaybackClock({
    duration,
    loop,
    looping,
  });
  // The timeline fits the width it is given until it is zoomed.
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fitPx, setFitPx] = useState(0);
  // Whether the bar has room for the zoom control; the menu lists the zoom steps only when it does not.
  const zoomSlotRef = useRef<HTMLDivElement>(null);
  const [zoomInBar, setZoomInBar] = useState(true);
  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }
    // The header column is narrower in a narrow panel: fit what is left beside it.
    const measure = () => {
      const lead =
        element.querySelector<HTMLElement>(
          '[data-slot="timeline-track-header"]'
        )?.offsetWidth ?? LEAD_PX;
      setFitPx(Math.max(0, (element.clientWidth - lead) / duration));
      if (zoomSlotRef.current) {
        setZoomInBar(getComputedStyle(zoomSlotRef.current).display !== "none");
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [duration]);
  const [zoomed, setZoom] = useState<number | null>(null);
  const zoom = Math.max(zoomed ?? fitPx, fitPx) || 8;
  const getPosition = useCallback(() => clock.getSnapshot(), [clock]);
  const {
    addTrack,
    canRedo,
    canUndo,
    changeClip,
    changeMix,
    clearSelection,
    clipAction,
    clips,
    commitClip,
    copying,
    duplicateSelection,
    duplicateTrack,
    folded,
    heights,
    toggleFold,
    mixOf,
    redo,
    removeClip,
    removeTrack,
    renameClip,
    renameTrack,
    setFadeShape,
    rescale,
    resizeTrack,
    selectAll,
    selectClip,
    selectClips,
    selectedIds,
    selectedTracks,
    selection,
    selectTrack,
    splitAtCursor,
    tracks,
    undo,
  } = useArrangement({
    colors: TRACK_COLORS.length,
    duration,
    getPosition,
    initialClips: CLIPS,
    initialTracks: TRACKS,
    splitStep: bar / 4,
  });
  const handleAddTrack = useCallback(() => addTrack(), [addTrack]);
  // Multi-select: a press on a clip adds it to the selection, and a drag on bare lane draws a rectangle. For touch, which has no Shift.
  const [multi, setMulti] = useState(false);
  // A touch screen has no Shift: in multi-select mode every press on a header adds to the tracks picked.
  const pickTrack = useCallback(
    (id: string, additive: boolean) => selectTrack(id, additive || multi),
    [multi, selectTrack]
  );
  const marquee = useMarquee(selectedIds, selectClips, multi);
  // A clip of a selection being dragged up or down, and how far: the rest of the selection follows it.
  const [lifting, setLifting] = useState<{ id: string; offset: number } | null>(
    null
  );
  const lift = useCallback(
    (id: string, offset: number) =>
      setLifting(offset === 0 ? null : { id, offset }),
    []
  );
  const [division, setDivision] = useState<GridDivision>("adaptive");
  const [triplet, setTriplet] = useState(false);
  const [snap, setSnap] = useState(true);
  // A stand-in for the mix's levels: the block plays nothing, so they move while it runs.
  const simulated = useSimulatedLevels(2);
  // What is heard: a muted track is silent, and while any track is soloed so is every other.
  const anySolo = tracks.some((track) => mixOf(track).soloed);

  const playPause = useCallback(() => setPlaying((on) => !on), [setPlaying]);
  // Stop goes back to the top, as a DAW's does.
  const stop = useCallback(() => {
    setPlaying(false);
    clock.set(0);
  }, [clock, setPlaying]);
  // A tempo change keeps the musical positions: everything is rescaled to the new bar.
  const changeTempo = useCallback(
    (next: Tempo) => {
      // New bar over old: a clip three bars long stays three bars long.
      const ratio = secondsPerBar(next) / secondsPerBar(tempo);
      rescale(ratio);
      setLoop(([start, end]) => [start * ratio, end * ratio]);
      setZoom((current) => (current === null ? null : current / ratio));
      clock.set(clock.getSnapshot() * ratio);
      setTempo(next);
    },
    [clock, rescale, tempo]
  );
  // The zoom as a share of the fitted view: 100% shows everything.
  const zoomRatio = fitPx > 0 ? zoom / fitPx : 1;
  const maxRatio = fitPx > 0 ? MAX_ZOOM / fitPx : 1;
  const changeZoom = useCallback(
    (ratio: number) => setZoom(ratio <= 1 ? null : ratio * fitPx),
    [fitPx]
  );
  const handleDivisionValue = useCallback(
    (value: string) => setDivision(value as GridDivision),
    []
  );
  const zoomIn = useCallback(
    () => changeZoom(zoomRatio + 0.25),
    [changeZoom, zoomRatio]
  );
  const zoomOut = useCallback(
    () => changeZoom(Math.max(1, zoomRatio - 0.25)),
    [changeZoom, zoomRatio]
  );
  const seek = useCallback((seconds: number) => clock.set(seconds), [clock]);
  // A press on a track's empty lane puts the cursor there (the lane does it) and picks the track, letting go of the clips; on the surface under the last track it lets go of everything, as nothing is there.
  // The shortcuts are caught on the panel, so a press on the lane, which takes no focus, hands it over.
  const panelRef = useRef<HTMLDivElement>(null);
  const focusPanel = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget && !event.shiftKey && !multi) {
        const { track } = event.currentTarget.dataset;
        if (track) {
          selectTrack(track);
        } else {
          clearSelection();
        }
        panelRef.current?.focus({ focusVisible: false, preventScroll: true });
      }
    },
    [clearSelection, multi, selectTrack]
  );
  const addLocator = useCallback(() => {
    const at = clock.getSnapshot();
    setLocators((all) =>
      all.some((locator) => locator.at === at)
        ? all
        : [...all, { at, name: `Locator ${all.length + 1}` }]
    );
  }, [clock]);
  const jumpToLocator = useCallback((at: number) => clock.set(at), [clock]);
  const removeLocator = useCallback(
    (at: number) =>
      setLocators((all) => all.filter((locator) => locator.at !== at)),
    []
  );
  const renameLocator = useCallback(
    (at: number, name: string) =>
      setLocators((all) =>
        all.map((locator) =>
          locator.at === at ? { ...locator, name } : locator
        )
      ),
    []
  );

  /** Puts the loop around the selected clip, or around the clips of the selected track. */
  const loopSelection = useCallback(() => {
    const chosen = clips.filter(
      (clip) =>
        selectedIds.includes(clip.id) || selectedTracks.includes(clip.track)
    );
    if (chosen.length === 0) {
      return;
    }
    setLoop([
      Math.min(...chosen.map((clip) => clip.value.start)),
      Math.max(...chosen.map((clip) => clip.value.start + clip.value.length)),
    ]);
    setLooping(true);
  }, [clips, selectedIds, selectedTracks]);

  /** M adds a locator, Alt + arrows jump between them; returns whether the key was one of these. */
  const handleLocatorKey = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (
        event.key.toLowerCase() === "m" &&
        !(event.metaKey || event.ctrlKey || event.altKey)
      ) {
        event.preventDefault();
        addLocator();
        return true;
      }
      const direction = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (!(event.altKey && direction)) {
        return false;
      }
      const target = adjacentPoint(
        locators.map((locator) => locator.at),
        clock.getSnapshot(),
        direction === 1 ? 1 : -1
      );
      if (target === null) {
        return false;
      }
      event.preventDefault();
      event.stopPropagation();
      clock.set(target);
      return true;
    },
    [addLocator, clock, locators]
  );
  // The copies are what the user asked to see: bring them into view once they are drawn.
  const duplicateAndShow = useCallback(() => {
    const copies = duplicateSelection();
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-clip-id="${copies[0]?.id}"]`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }, [duplicateSelection]);
  /** Cmd/Ctrl + A selects every clip, Cmd/Ctrl + D duplicates the selection; returns whether the key was one of these. */
  const handleSelectionKey = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const key = event.key.toLowerCase();
      if (!(event.metaKey || event.ctrlKey)) {
        return false;
      }
      if (key === "z" || key === "y") {
        event.preventDefault();
        if (key === "y" || event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return true;
      }
      if (key === "a") {
        event.preventDefault();
        selectAll();
        return true;
      }
      if (key === "d" && selectedIds.length > 0) {
        event.preventDefault();
        duplicateAndShow();
        return true;
      }
      if (key === "d" && selectedTracks.length > 0) {
        event.preventDefault();
        for (const id of selectedTracks) {
          duplicateTrack(id);
        }
        return true;
      }
      return false;
    },
    [
      duplicateAndShow,
      duplicateTrack,
      redo,
      selectAll,
      selectedIds,
      selectedTracks,
      undo,
    ]
  );
  /** Delete takes away the tracks picked by their headers (a clip handles its own Delete); returns whether the key was it. */
  const handleTrackKey = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const del = event.key === "Delete" || event.key === "Backspace";
      if (!(del && selectedTracks.length > 0 && selectedIds.length === 0)) {
        return false;
      }
      event.preventDefault();
      removeTrack(selectedTracks[0] ?? "");
      return true;
    },
    [removeTrack, selectedIds.length, selectedTracks]
  );
  // S, or Cmd/Ctrl + E, splits at the cursor, Cmd/Ctrl + D duplicates the clip; Escape drops the selection.
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        clearSelection();
        return;
      }
      const key = event.key.toLowerCase();
      if (handleTrackKey(event)) {
        return;
      }
      if (handleLocatorKey(event)) {
        return;
      }
      if (key === "l" && (event.metaKey || event.ctrlKey) && selection) {
        event.preventDefault();
        loopSelection();
        return;
      }
      if (handleSelectionKey(event)) {
        return;
      }
      const split =
        (key === "s" && !(event.metaKey || event.ctrlKey || event.altKey)) ||
        (key === "e" && (event.metaKey || event.ctrlKey));
      if (split && selection) {
        event.preventDefault();
        splitAtCursor();
      }
    },
    [
      clearSelection,
      handleTrackKey,
      handleLocatorKey,
      handleSelectionKey,
      loopSelection,
      selection,
      splitAtCursor,
    ]
  );

  // The grid the lanes draw is the grid everything snaps to.
  // Snap off draws no lines and snaps nothing: a step of 0 is no grid.
  const gridSeconds = gridInterval(division, zoom, tempo, { triplet });
  const snapStep = snap ? gridSeconds : 0;
  const labelEvery = barLabelInterval(zoom, tempo);
  // Whole bars, counted rather than divided, so no tempo leaves a label like 6.9999.
  const labelBars = Math.max(1, Math.round(labelEvery / bar));
  const labels = Array.from(
    { length: Math.ceil(BARS / labelBars) },
    (_, index) => index * labelBars
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the editor's shortcuts, caught from the controls inside it
    <div
      className="cn-audio-panel @container/panel flex w-full min-w-0 flex-col gap-4 border bg-card p-4 outline-none"
      onKeyDown={handleKeyDown}
      ref={panelRef}
      tabIndex={-1}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 p-1 @3xl/panel:flex-nowrap">
        <div className="flex flex-wrap items-center gap-2 @3xl/panel:flex-nowrap">
          <Transport
            className="w-auto"
            looping={looping}
            metronome={metronome}
            onLoopingChange={setLooping}
            onMetronomeChange={setMetronome}
            onPlayPause={playPause}
            onRhythmChange={setRhythm}
            onStop={stop}
            onTempoChange={changeTempo}
            playing={playing}
            rhythm={rhythm}
            source={clock}
            tempo={tempo}
          />
          <div className="hidden h-7 w-10 shrink-0 items-center @3xl/panel:flex">
            <Meter
              aria-label="Master output level"
              className="data-[orientation=horizontal]:[--meter-thickness:--spacing(3)]"
              orientation="horizontal"
              peakMarks="hidden"
              size="sm"
              source={playing ? simulated : SILENCE}
              warnThreshold={-12}
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 @3xl/panel:flex-nowrap">
          <ButtonGroup>
            <Button
              aria-label="Undo"
              disabled={!canUndo}
              onClick={undo}
              size="icon"
              variant="outline"
            >
              <IconPlaceholder
                hugeicons="Undo02Icon"
                lucide="Undo2Icon"
                phosphor="ArrowUUpLeftIcon"
                remixicon="RiArrowGoBackLine"
                tabler="IconArrowBackUp"
              />
            </Button>
            <Button
              aria-label="Redo"
              disabled={!canRedo}
              onClick={redo}
              size="icon"
              variant="outline"
            >
              <IconPlaceholder
                hugeicons="Redo02Icon"
                lucide="Redo2Icon"
                phosphor="ArrowUUpRightIcon"
                remixicon="RiArrowGoForwardLine"
                tabler="IconArrowForwardUp"
              />
            </Button>
          </ButtonGroup>
          <div
            className="hidden items-center gap-2 @7xl/panel:flex"
            ref={zoomSlotRef}
          >
            <NumberControl
              format={PERCENT}
              label="Zoom"
              largeStep={1}
              max={maxRatio}
              min={1}
              onValueChange={changeZoom}
              step={0.25}
              steppers={ZOOM_STEPPERS}
              unit="Zoom"
              value={zoomRatio}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label="More controls"
                  size="icon"
                  variant="outline"
                />
              }
            >
              <IconPlaceholder
                hugeicons="MoreHorizontalIcon"
                lucide="EllipsisIcon"
                phosphor="DotsThreeIcon"
                remixicon="RiMoreLine"
                tabler="IconDots"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-48">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Grid</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    onValueChange={handleDivisionValue}
                    value={division}
                  >
                    {DIVISIONS.map((item) => (
                      <DropdownMenuRadioItem
                        key={item.value}
                        value={item.value}
                      >
                        {item.label.replace("Grid: ", "")}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={multi}
                onCheckedChange={setMulti}
              >
                Multi-select
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={triplet}
                onCheckedChange={setTriplet}
              >
                Triplet grid
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={snap}
                onCheckedChange={setSnap}
              >
                Snap to grid
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  Keyboard shortcuts
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="flex max-h-(--available-height) w-auto flex-col">
                  <div className="scrollbar flex min-h-0 flex-col gap-2 overflow-y-auto p-2 text-sm whitespace-nowrap">
                    {SHORTCUTS.map((shortcut) => (
                      <div
                        className="flex items-center justify-between gap-3"
                        key={`${shortcut.action}-${shortcut.keys.join("+")}`}
                      >
                        <span>{shortcut.action}</span>
                        <KbdGroup>
                          {shortcut.keys.map((key) => (
                            <Kbd key={key}>{key}</Kbd>
                          ))}
                        </KbdGroup>
                      </div>
                    ))}
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {zoomInBar ? null : (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={zoomIn}>Zoom in</DropdownMenuItem>
                  <DropdownMenuItem onClick={zoomOut}>
                    Zoom out
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Timeline
        className="min-h-0 flex-1 gap-2"
        duration={duration}
        maxZoom={MAX_ZOOM}
        minZoom={fitPx || undefined}
        onPositionChange={seek}
        onZoomChange={setZoom}
        snapStep={snapStep}
        source={clock}
        zoom={zoomed === null ? undefined : zoom}
      >
        <TimelineNavigator getAriaValueText={describe} />
        <TimelineViewport
          className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-muted/40"
          ref={viewportRef}
          scrollbar="hidden"
        >
          {/* As wide as the lanes, so the stuck headers stay put however far it scrolls. */}
          <div
            className={cn(
              "flex min-h-full w-max min-w-full shrink-0 flex-col",
              marquee.rect && "select-none"
            )}
            {...marquee.handlers}
          >
            {/* One sticky block, so what is stuck stays stacked whatever each row measures. */}
            <div className="sticky top-0 z-40 flex min-w-full shrink-0 flex-col bg-background">
              <Row className="shrink-0">
                <TimelineLane className="h-6 cursor-cell">
                  <TimelineRange
                    aria-label="Loop"
                    drawable
                    getAriaValueText={describe}
                    onValueChange={setLoop}
                    value={loop}
                  >
                    <TimelineRangeHandle aria-label="Loop start" edge="start" />
                    <TimelineRangeHandle aria-label="Loop end" edge="end" />
                  </TimelineRange>
                  <TimelinePlayhead />
                </TimelineLane>
              </Row>
              <Row className="shrink-0 bg-background">
                <TimelineRuler
                  aria-label="Playhead"
                  getAriaValueText={describe}
                >
                  {labels.map((count) => (
                    <TimelineMark key={count} value={count * bar}>
                      {count + 1}
                    </TimelineMark>
                  ))}
                  <TimelinePlayhead />
                </TimelineRuler>
              </Row>
              <Row className="shrink-0 bg-background">
                <TimelineLane className="h-6">
                  {locators.map((locator) => (
                    <TimelineMark key={locator.at} value={locator.at}>
                      <LocatorButton
                        locator={locator}
                        onJump={jumpToLocator}
                        onRemove={removeLocator}
                        onRename={renameLocator}
                      />
                    </TimelineMark>
                  ))}
                </TimelineLane>
              </Row>
            </div>
            {tracks.map((track) => (
              <Row
                className={cn(
                  "border-foreground/25 border-b",
                  heights[track.id] === undefined && "flex-1"
                )}
                height={heights[track.id]}
                key={track.id}
                lead={
                  <TimelineTrackControls
                    compact={
                      heights[track.id] !== undefined &&
                      heights[track.id] < COMPACT_TRACK_HEIGHT
                    }
                    folded={folded[track.id]}
                    meter={
                      <TrackLevel
                        active={
                          playing &&
                          !mixOf(track).muted &&
                          (!anySolo || mixOf(track).soloed)
                        }
                        name={track.name}
                      />
                    }
                    mix={mixOf(track)}
                    name={track.name}
                    onDuplicate={duplicateTrack}
                    onInsert={addTrack}
                    onMix={changeMix}
                    onRemove={removeTrack}
                    onRename={renameTrack}
                    onSelect={pickTrack}
                    onToggleFold={toggleFold}
                    selected={selectedTracks.includes(track.id)}
                    trackId={track.id}
                  />
                }
                onResize={resizeTrack}
                selected={selectedTracks.includes(track.id)}
                trackId={track.id}
              >
                <ContextMenu>
                  <ContextMenuTrigger render={<div className="contents" />}>
                    <TimelineLane
                      className={cn(
                        "h-auto flex-1 border-b-0",
                        heights[track.id] === undefined
                          ? "min-h-14"
                          : "min-h-0",
                        // A short track keeps its clips thin, so they fit.
                        heights[track.id] !== undefined &&
                          heights[track.id] < COMPACT_TRACK_HEIGHT &&
                          "**:data-clip-id:inset-y-0.5",
                        selectedTracks.includes(track.id) && "bg-muted/40",
                        // A silent track keeps its clips on the page, drained.
                        (mixOf(track).muted ||
                          (anySolo && !mixOf(track).soloed)) &&
                          "**:data-clip-id:opacity-40"
                      )}
                      data-track={track.id}
                      gridStep={snapStep}
                      onPointerDown={focusPanel}
                      seekable
                    >
                      {copying
                        .filter((original) => original.track === track.id)
                        .map((original) => (
                          <CopyGhost clip={original} key={original.id} />
                        ))}
                      {clips
                        .filter((clip) => clip.track === track.id)
                        .map((clip) => (
                          <ClipView
                            clip={clip}
                            copying={copying.some(
                              (original) => original.id === clip.id
                            )}
                            describe={describe}
                            key={clip.id}
                            lift={
                              lifting &&
                              lifting.id !== clip.id &&
                              selectedIds.includes(clip.id) &&
                              selectedIds.includes(lifting.id)
                                ? lifting.offset
                                : 0
                            }
                            multi={multi}
                            onAction={clipAction}
                            onChange={changeClip}
                            onCommit={commitClip}
                            onFadeShape={setFadeShape}
                            onLift={lift}
                            onRemove={removeClip}
                            onRename={renameClip}
                            onSelect={selectClip}
                            selected={selectedIds.includes(clip.id)}
                            swatch={mixOf(track).color}
                            trackName={track.name}
                          />
                        ))}
                      <TimelinePlayhead />
                    </TimelineLane>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-auto min-w-48">
                    <TimelineGridMenuItems
                      division={division}
                      divisions={DIVISIONS}
                      onDivisionChange={handleDivisionValue}
                      onSnapChange={setSnap}
                      onTripletChange={setTriplet}
                      snap={snap}
                      triplet={triplet}
                    />
                  </ContextMenuContent>
                </ContextMenu>
              </Row>
            ))}
            <Row
              className="sticky bottom-0 z-30 border-foreground/25 border-b bg-background"
              lead={
                <Button
                  className="m-1 min-w-0 flex-1 justify-start gap-1.5"
                  onClick={handleAddTrack}
                  size="sm"
                  variant="ghost"
                >
                  <IconPlaceholder
                    hugeicons="PlusSignIcon"
                    lucide="PlusIcon"
                    phosphor="PlusIcon"
                    remixicon="RiAddLine"
                    tabler="IconPlus"
                  />
                  Add track
                </Button>
              }
            >
              <TimelineLane
                className="h-10 border-b-0 bg-background"
                gridStep={snapStep}
              />
            </Row>
            {/* The surface carries on to the bottom of the view, so the arrangement does not stop at the last track. */}
            <Row className="flex-1" lead={<div className="h-full" />}>
              <TimelineLane
                className="h-auto flex-1 border-b-0 bg-background"
                gridStep={snapStep}
                onPointerDown={focusPanel}
                seekable
              >
                <TimelinePlayhead />
              </TimelineLane>
            </Row>
          </div>
        </TimelineViewport>
        {marquee.rect
          ? // In the page's body: a dialog is transformed, which would make a fixed rectangle its own.
            createPortal(
              <div
                aria-hidden="true"
                className="pointer-events-none fixed z-50 border border-primary bg-primary/10"
                style={marquee.rect}
              />,
              document.body
            )
          : null}
      </Timeline>
    </div>
  );
}
