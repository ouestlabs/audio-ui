"use client";

import {
  adjacentPoint,
  coverClips,
  createSource,
  duplicateClip,
  moveClip,
  splitClip,
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
  useEffect,
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
import { Kbd, KbdGroup } from "@/registry/bases/base/ui/kbd";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/registry/bases/base/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/bases/base/ui/select";
import { Toggle } from "@/registry/bases/base/ui/toggle";
import { NumberControl } from "@/registry-audio/bases/base/audio/elements/bpm-control";
import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";
import {
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
  TimelineTrackHeader,
  TimelineTrackResizeHandle,
  TimelineViewport,
} from "@/registry-audio/bases/base/audio/elements/timeline";
import { Transport } from "@/registry-audio/bases/base/audio/elements/transport";
import {
  beginChange,
  canRedo,
  canUndo,
  emptyHistory,
  type History,
  recordChange,
  redo,
  settleChange,
  undo,
} from "@/registry-audio/bases/base/lib/history";
import {
  barLabelInterval,
  DEFAULT_TEMPO,
  describeBarsBeats,
  GRID_DIVISIONS,
  type GridDivision,
  gridInterval,
  gridLabel,
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

const TRACKS = [
  { id: "drums", name: "Drums", swatch: "border-s-chart-1" },
  { id: "bass", name: "Bass", swatch: "border-s-chart-2" },
  { id: "keys", name: "Keys", swatch: "border-s-chart-3" },
  { id: "vocals", name: "Vocals", swatch: "border-s-chart-4" },
] as const;

type ClipAction = "duplicate" | "remove" | "rename" | "split" | "toggle";

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

/** What a track's header sets: how loud it is, and whether it is silenced or soloed. */
interface Mix {
  gain: number;
  muted: boolean;
  soloed: boolean;
}

const UNITY: Mix = { gain: 1, muted: false, soloed: false };

type Span = readonly [number, number];

interface Arranged {
  /** A clip switched off stays on the page, drained, and is not heard. */
  disabled?: boolean;
  id: string;
  name: string;
  /** How long the recording behind the clip is: trimming stops where it runs out. */
  sourceLength: number;
  track: (typeof TRACKS)[number]["id"];
  /** Where the clip sits, how much of its source it plays, and its fades. */
  value: TimelinePrimitive.Clip.Value;
}

const arranged = (
  id: string,
  name: string,
  track: Arranged["track"],
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

/** A transport clock as a source: the playhead follows it without re-rendering React. */
function usePlaybackClock(limits: {
  duration: number;
  loop: Span;
  looping: boolean;
}) {
  const [clock] = useState(() => createSource(0));
  const [playing, setPlaying] = useState(false);
  // Read each frame, so a tempo or a loop edit does not restart the clock.
  const limitsRef = useRef(limits);
  limitsRef.current = limits;

  useEffect(() => {
    if (!playing) {
      return;
    }
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const { duration, loop, looping } = limitsRef.current;
      const before = clock.getSnapshot();
      let next = before + (now - last) / 1000;
      if (looping && before < loop[1] && next >= loop[1]) {
        next = loop[0] + (next - loop[1]);
      }
      clock.set(next % duration);
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [clock, playing]);

  return { clock, playing, setPlaying };
}

let pieceCount = 0;

/**
 * Lays `placed` on its track: it covers what was under it, as a DAW's does,
 * rather than stacking on it. Pieces cut from a clip it lies inside get ids of
 * their own.
 */
function lay(all: Arranged[], placed: Arranged, duration: number): Arranged[] {
  const others = all.filter((clip) => clip.id !== placed.id);
  const onTrack = others.filter((clip) => clip.track === placed.track);
  const elsewhere = others.filter((clip) => clip.track !== placed.track);
  const covered = coverClips(
    onTrack,
    placed.value,
    { duration, sourceLength: placed.sourceLength },
    (item, value) => {
      pieceCount += 1;
      return { ...item, id: `${item.id}-c${pieceCount}`, value };
    }
  );
  return [...elsewhere, ...covered, placed];
}

const trackIndex = (track: Arranged["track"]) =>
  TRACKS.findIndex((item) => item.id === track);

/** The track `shift` tracks away, kept on the arrangement. */
function shiftTrack(
  track: Arranged["track"],
  shift: number
): Arranged["track"] {
  const target = Math.min(
    TRACKS.length - 1,
    Math.max(0, trackIndex(track) + shift)
  );
  return TRACKS[target]?.id ?? track;
}

/** The rest of a selection that holds `id`: what a drop with no sideways move has no change event to have noted. */
function otherSelected(selected: string[], id: string): string[] {
  return selected.length > 1 && selected.includes(id)
    ? selected.filter((other) => other !== id)
    : [];
}

interface Landing {
  /** The ids the copies of the originals take. */
  copyIds: string[];
  duration: number;
  /** The other clips of a dragged group. */
  group: string[];
  /** The clip that was dragged. */
  id: string;
  /** The originals of a copy drag, which stay where they were. */
  origins: Arranged[];
  /** The track the clip was dropped on, if it left its own. */
  track: Arranged["track"] | undefined;
}

/**
 * Lays down what a drag moved: the dragged clip and its group land where they
 * were put, covering what they lie over; in a copy drag the originals stay
 * where they were, as copies of their own, under what was moved.
 */
function land(all: Arranged[], landing: Landing): Arranged[] {
  const { copyIds, duration, group, id, origins, track } = landing;
  const current = all.find((clip) => clip.id === id);
  if (!current) {
    return all;
  }
  const placed = track ? { ...current, track } : current;
  const movedIds = new Set([id, ...group]);
  // A group dropped on another track moves by as many tracks as the dragged clip did.
  const shift = track ? trackIndex(track) - trackIndex(current.track) : 0;
  const moved = all
    .filter((clip) => movedIds.has(clip.id))
    .map((clip) =>
      clip.id === id ? clip : { ...clip, track: shiftTrack(clip.track, shift) }
    );
  let laid = origins.length
    ? all.filter((clip) => !movedIds.has(clip.id))
    : all;
  laid = origins.reduce(
    (kept, origin, index) =>
      lay(kept, { ...origin, id: copyIds[index] ?? origin.id }, duration),
    laid
  );
  for (const clip of origins.length ? moved : [placed]) {
    laid = lay(laid, clip.id === id ? placed : clip, duration);
  }
  // The rest of a dragged group lands too, covering what it lies over.
  if (!origins.length) {
    for (const other of group) {
      const grouped = moved.find((clip) => clip.id === other);
      if (grouped) {
        laid = lay(laid, grouped, duration);
      }
    }
  }
  return laid;
}

/** A clip's positions and lengths, all in seconds, scaled when the tempo changes. */
function scaleValue(
  value: TimelinePrimitive.Clip.Value,
  ratio: number
): TimelinePrimitive.Clip.Value {
  return {
    ...value,
    fadeIn: value.fadeIn * ratio,
    fadeOut: value.fadeOut * ratio,
    length: value.length * ratio,
    offset: value.offset * ratio,
    start: value.start * ratio,
  };
}

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
  onResize?: (trackId: string, height: number) => void;
  selected?: boolean;
  trackId?: string;
}) {
  const handleHeight = useCallback(
    (next: number) => {
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
  { action: "Remove the clip", keys: ["Delete"] },
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
    <button
      aria-label={`Locator ${name}`}
      className="pointer-events-auto flex h-full items-center whitespace-nowrap border-primary border-s-2 ps-1 pe-2 text-primary text-xs outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
      onClick={handleClick}
      onDoubleClick={startEditing}
      onKeyDown={handleKeyDown}
      type="button"
    >
      {name}
    </button>
  );
}

/** Keeps a press inside a field from reaching the lane under it. */
function stopPress(event: PointerEvent<HTMLElement>) {
  event.stopPropagation();
}

const NONE: string[] = [];

interface Marquee {
  height: number;
  left: number;
  top: number;
  width: number;
}

/** Whether two rectangles overlap. */
const overlaps = (a: DOMRect, b: Marquee) =>
  a.left < b.left + b.width &&
  a.right > b.left &&
  a.top < b.top + b.height &&
  a.bottom > b.top;

/**
 * A marquee for the clips: Shift and drag across bare lane draws a rectangle,
 * and the clips it touches join the selection. It is told of the selection
 * when the drag began, to add to it, and of the clips it touches as it grows.
 */
function useMarquee(initial: string[], onSelect: (clips: string[]) => void) {
  const [rect, setRect] = useState<Marquee | null>(null);
  const start = useRef<{ x: number; y: number; chosen: string[] } | null>(null);

  const onPointerDownCapture = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const bare =
        event.target instanceof Element &&
        event.target.hasAttribute("data-timeline-lane");
      if (!(event.shiftKey && event.button === 0 && bare)) {
        return;
      }
      // The lane would take this press for the cursor: it is a marquee instead.
      event.stopPropagation();
      // And no text should be selected as it is dragged over.
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      start.current = { chosen: initial, x: event.clientX, y: event.clientY };
    },
    [initial]
  );
  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const origin = start.current;
      if (!origin) {
        return;
      }
      const next = {
        height: Math.abs(event.clientY - origin.y),
        left: Math.min(event.clientX, origin.x),
        top: Math.min(event.clientY, origin.y),
        width: Math.abs(event.clientX - origin.x),
      };
      setRect(next);
      const touched = [
        ...event.currentTarget.querySelectorAll<HTMLElement>("[data-clip-id]"),
      ]
        .filter((clip) => overlaps(clip.getBoundingClientRect(), next))
        .map((clip) => clip.getAttribute("data-clip-id") ?? "");
      onSelect([...new Set([...origin.chosen, ...touched])]);
    },
    [onSelect]
  );
  const onPointerEnd = useCallback(() => {
    start.current = null;
    setRect(null);
  }, []);

  return {
    handlers: {
      onLostPointerCapture: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onPointerDownCapture,
      onPointerMove,
      onPointerUp: onPointerEnd,
    },
    rect,
  };
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

const MIN_TRACK_HEIGHT = 40;
const MAX_TRACK_HEIGHT = 240;
const TRACK_HEIGHT_STEP = 8;

/**
 * What a track's header holds: its name, which selects the track (its content
 * is where the cursor goes), solo, mute and gain. The lower edge resizes it.
 */
function TrackHeader({
  mix,
  name,
  onMix,
  onSelect,
  selected,
  swatch,
  trackId,
}: {
  mix: Mix;
  name: string;
  onMix: (trackId: Arranged["track"], patch: Partial<Mix>) => void;
  onSelect: (trackId: Arranged["track"]) => void;
  selected: boolean;
  /** The border class that colors the track's leading edge. */
  swatch: string;
  trackId: Arranged["track"];
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
  const handleClick = useCallback(() => onSelect(trackId), [onSelect, trackId]);
  return (
    <div
      className={cn(
        "relative flex w-full flex-col justify-center gap-1 border-s-4 px-2 py-1",
        swatch
      )}
    >
      <div className="flex items-center gap-1">
        <button
          aria-pressed={selected}
          className="min-w-0 flex-1 truncate text-left font-medium outline-none hover:underline focus-visible:underline"
          onClick={handleClick}
          type="button"
        >
          {name}
        </button>
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
      <Fader
        aria-label={`${name} gain`}
        className="min-w-0 pe-2"
        max={1}
        min={0}
        onValueChange={handleGain}
        orientation="horizontal"
        size="sm"
        step={0.01}
        thumbMarks={false}
        value={mix.gain}
        valueLabel="hidden"
      />
      <TimelineTrackResizeHandle aria-label={`${name} height`} />
    </div>
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
  onAction,
  onRename,
  trackName,
}: {
  clip: Arranged;
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
      onSelect(clip.id, event.shiftKey || event.metaKey || event.ctrlKey);
    },
    [clip.id, onSelect]
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
          aria-label={`${trackName}, ${clip.name}`}
          className={cn(
            "inset-y-1.5",
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
          />
          <TimelineClipFadeHandle
            aria-label={`${clip.name} fade out`}
            edge="out"
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
  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }
    const measure = () =>
      setFitPx(Math.max(0, (element.clientWidth - LEAD_PX) / duration));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [duration]);
  const [zoomed, setZoom] = useState<number | null>(null);
  const zoom = Math.max(zoomed ?? fitPx, fitPx) || 8;
  const [clips, setClips] = useState(CLIPS);
  // The selection: some clips, added to with Shift or Cmd/Ctrl, or one whole track by its header.
  const [selection, setSelection] = useState<{
    clips: string[];
    track: string | null;
  } | null>(null);
  const selectedIds = selection?.clips ?? NONE;
  const selectClips = useCallback(
    (chosen: string[]) => setSelection({ clips: chosen, track: null }),
    []
  );
  const marquee = useMarquee(selectedIds, selectClips);
  const selectedTrack = selection?.track ?? null;
  // Where the selected clips were when a group drag began, so each moves by the same distance.
  const groupOrigin = useRef<Map<string, Arranged> | null>(null);
  const pieces = useRef(0);
  const clipsRef = useRef(clips);
  clipsRef.current = clips;
  // The history lives in a ref, so two undos in one tick see each other; the flags are what the buttons read.
  const historyRef = useRef<History<Arranged[]>>(emptyHistory());
  const [historyFlags, setHistoryFlags] = useState({
    redo: false,
    undo: false,
  });
  const setHistory = useCallback((next: History<Arranged[]>) => {
    historyRef.current = next;
    setHistoryFlags({ redo: canRedo(next), undo: canUndo(next) });
  }, []);
  // A change made in one go (delete, split, duplicate): call before it.
  const recordEdit = useCallback(
    () => setHistory(recordChange(historyRef.current, clipsRef.current)),
    [setHistory]
  );
  const undoEdit = useCallback(() => {
    const step = undo(historyRef.current, clipsRef.current);
    if (!step) {
      return;
    }
    setHistory(step.history);
    clipsRef.current = step.present;
    setClips(step.present);
    setSelection(null);
  }, [setHistory]);
  const redoEdit = useCallback(() => {
    const step = redo(historyRef.current, clipsRef.current);
    if (!step) {
      return;
    }
    setHistory(step.history);
    clipsRef.current = step.present;
    setClips(step.present);
    setSelection(null);
  }, [setHistory]);
  // Where a clip dragged with Alt held started: the copy stays there.
  const copyOrigins = useRef<Arranged[] | null>(null);
  // The clip being dragged as a copy, shown while it is: its original stays behind as a ghost.
  const [copying, setCopying] = useState<Arranged[]>([]);
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
  const handleDivision = useCallback(
    (next: GridDivision | null) => setDivision(next ?? "adaptive"),
    []
  );
  const [mixes, setMixes] = useState<Record<string, Mix>>({});
  const mixOf = (trackId: string) => mixes[trackId] ?? UNITY;
  const changeMix = useCallback(
    (trackId: string, patch: Partial<Mix>) =>
      setMixes((all) => ({
        ...all,
        [trackId]: { ...(all[trackId] ?? UNITY), ...patch },
      })),
    []
  );
  // What is heard: a muted track is silent, and while any track is soloed so is every other.
  const anySolo = TRACKS.some((track) => mixOf(track.id).soloed);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const resizeTrack = useCallback(
    (trackId: string, height: number) =>
      setHeights((all) => ({ ...all, [trackId]: height })),
    []
  );

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
      setClips((all) =>
        all.map((clip) => ({
          ...clip,
          sourceLength: clip.sourceLength * ratio,
          value: scaleValue(clip.value, ratio),
        }))
      );
      // The tempo is not in the history, so what came before it no longer fits.
      setHistory(emptyHistory());
      setLoop(([start, end]) => [start * ratio, end * ratio]);
      setZoom((current) => (current === null ? null : current / ratio));
      clock.set(clock.getSnapshot() * ratio);
      setTempo(next);
    },
    [clock, setHistory, tempo]
  );
  // The zoom as a share of the fitted view: 100% shows everything.
  const zoomRatio = fitPx > 0 ? zoom / fitPx : 1;
  const maxRatio = fitPx > 0 ? MAX_ZOOM / fitPx : 1;
  const changeZoom = useCallback(
    (ratio: number) => setZoom(ratio <= 1 ? null : ratio * fitPx),
    [fitPx]
  );
  const seek = useCallback((seconds: number) => clock.set(seconds), [clock]);
  const changeClip = useCallback(
    (
      id: string,
      value: TimelinePrimitive.Clip.Value,
      details: TimelinePrimitive.Clip.ChangeEventDetails
    ) => {
      if (!(details.copy && copyOrigins.current)) {
        // A copy of a clip in a selection copies the whole selection.
        const dragged = clipsRef.current.filter((clip) =>
          selectedIds.length > 1 && selectedIds.includes(id)
            ? selectedIds.includes(clip.id)
            : clip.id === id
        );
        copyOrigins.current =
          details.copy && details.target === "move" ? dragged : null;
        setCopying(copyOrigins.current ?? []);
      }
      const grouped =
        details.target === "move" &&
        details.delta !== undefined &&
        selectedIds.length > 1 &&
        selectedIds.includes(id);
      if (grouped && !groupOrigin.current) {
        groupOrigin.current = new Map(
          clipsRef.current
            .filter((clip) => selectedIds.includes(clip.id))
            .map((clip) => [clip.id, clip])
        );
      }
      const origins = grouped ? groupOrigin.current : null;
      // The first tick of a gesture keeps what it started from; the commit closes it.
      setHistory(beginChange(historyRef.current, clipsRef.current));
      setClips((all) =>
        all.map((clip) => {
          if (clip.id === id) {
            return { ...clip, value };
          }
          const origin = origins?.get(clip.id);
          return origin && details.delta !== undefined
            ? {
                ...clip,
                value: moveClip(
                  origin.value,
                  origin.value.start + details.delta,
                  { duration }
                ),
              }
            : clip;
        })
      );
    },
    [duration, selectedIds, setHistory]
  );
  // A clip dropped on another track moves to it.
  const commitClip = useCallback(
    (id: string, details: TimelinePrimitive.Clip.CommitEventDetails) => {
      const track = details.lane?.dataset.track;
      const origins = details.copy ? (copyOrigins.current ?? []) : [];
      copyOrigins.current = null;
      setCopying([]);
      const group = groupOrigin.current;
      groupOrigin.current = null;
      setHistory(settleChange(historyRef.current));
      const copyIds = origins.map((origin) => {
        pieces.current += 1;
        return `${origin.id}-${pieces.current}`;
      });
      setClips((all) =>
        land(all, {
          copyIds,
          duration,
          group: group ? [...group.keys()] : otherSelected(selectedIds, id),
          id,
          origins,
          track: track as Arranged["track"] | undefined,
        })
      );
    },
    [duration, selectedIds, setHistory]
  );
  // A press selects the clip; with Shift or Cmd/Ctrl it is added to the selection, or taken from it.
  // A press on a clip that is already in a selection keeps the selection, so the group can be dragged.
  const selectClip = useCallback((id: string, additive: boolean) => {
    setSelection((current) => {
      const chosen = current?.clips ?? [];
      if (additive) {
        return {
          clips: chosen.includes(id)
            ? chosen.filter((other) => other !== id)
            : [...chosen, id],
          track: null,
        };
      }
      return chosen.includes(id) ? current : { clips: [id], track: null };
    });
  }, []);
  const selectTrack = useCallback(
    (id: string) => setSelection({ clips: [], track: id }),
    []
  );
  // A press on empty lane puts the cursor there (the lane does it) and lets go of the clips; a track picked by its header stays picked, to split at the cursor just put.
  // The shortcuts are caught on the panel, so a press on the lane, which takes no focus, hands it over.
  const panelRef = useRef<HTMLDivElement>(null);
  const focusPanel = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !event.shiftKey) {
      setSelection((current) => (current?.track ? current : null));
      panelRef.current?.focus({ focusVisible: false, preventScroll: true });
    }
  }, []);
  // Delete takes away the whole selection when the clip is in it.
  const removeClip = useCallback(
    (id: string) => {
      const gone = selectedIds.includes(id) ? selectedIds : [id];
      recordEdit();
      setClips((all) => all.filter((clip) => !gone.includes(clip.id)));
      setSelection(null);
    },
    [recordEdit, selectedIds]
  );
  // Cuts at the cursor: the selected clip, or every clip of the selected
  // track that the cursor is over.
  const splitWhere = useCallback(
    (targets: (clip: Arranged) => boolean) => {
      const at = clock.getSnapshot();
      recordEdit();
      setClips((all) =>
        all.flatMap((clip) => {
          const cut = targets(clip) ? splitClip(clip.value, at, bar / 4) : null;
          if (!cut) {
            return [clip];
          }
          pieces.current += 1;
          return [
            { ...clip, value: cut[0] },
            { ...clip, id: `${clip.id}-${pieces.current}`, value: cut[1] },
          ];
        })
      );
    },
    [bar, clock, recordEdit]
  );
  const splitAtCursor = useCallback(
    () =>
      splitWhere(
        (clip) => selectedIds.includes(clip.id) || clip.track === selectedTrack
      ),
    [selectedIds, selectedTrack, splitWhere]
  );
  const renameClip = useCallback(
    (id: string, name: string) => {
      const next = name.trim();
      if (!next || next === clipsRef.current.find((c) => c.id === id)?.name) {
        return;
      }
      recordEdit();
      setClips((all) =>
        all.map((clip) => (clip.id === id ? { ...clip, name: next } : clip))
      );
    },
    [recordEdit]
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
    const chosen = clipsRef.current.filter(
      (clip) => selectedIds.includes(clip.id) || clip.track === selectedTrack
    );
    if (chosen.length === 0) {
      return;
    }
    setLoop([
      Math.min(...chosen.map((clip) => clip.value.start)),
      Math.max(...chosen.map((clip) => clip.value.start + clip.value.length)),
    ]);
    setLooping(true);
  }, [selectedIds, selectedTrack]);

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
  // Copies each clip of the selection right after itself, and selects the copies.
  const duplicateSelection = useCallback(
    (chosen: Arranged[]) => {
      const copies = chosen.map((clip) => {
        pieces.current += 1;
        return {
          ...clip,
          id: `${clip.id}-${pieces.current}`,
          value: duplicateClip(clip.value, {
            duration,
            sourceLength: clip.sourceLength,
          }),
        };
      });
      recordEdit();
      setClips((all) =>
        copies.reduce((laid, copy) => lay(laid, copy, duration), all)
      );
      setSelection({ clips: copies.map((copy) => copy.id), track: null });
      // The copies are what the user asked to see: bring them into view once they are drawn.
      requestAnimationFrame(() => {
        document
          .querySelector(`[data-clip-id="${copies[0]?.id}"]`)
          ?.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
    },
    [duration, recordEdit]
  );
  // What the clip's menu does: to the whole selection when the clip is in it, else to the clip alone.
  const clipAction = useCallback(
    (action: ClipAction, id: string) => {
      const ids = selectedIds.includes(id) ? selectedIds : [id];
      if (action === "remove") {
        removeClip(id);
      } else if (action === "duplicate") {
        duplicateSelection(clipsRef.current.filter((c) => ids.includes(c.id)));
      } else if (action === "split") {
        splitWhere((clip) => ids.includes(clip.id));
      } else if (action === "toggle") {
        const off = !clipsRef.current.find((c) => c.id === id)?.disabled;
        recordEdit();
        setClips((all) =>
          all.map((clip) =>
            ids.includes(clip.id) ? { ...clip, disabled: off } : clip
          )
        );
      }
    },
    [duplicateSelection, recordEdit, removeClip, selectedIds, splitWhere]
  );
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
          redoEdit();
        } else {
          undoEdit();
        }
        return true;
      }
      if (key === "a") {
        event.preventDefault();
        setSelection({
          clips: clipsRef.current.map((clip) => clip.id),
          track: null,
        });
        return true;
      }
      const chosen = clipsRef.current.filter((item) =>
        selectedIds.includes(item.id)
      );
      if (key === "d" && chosen.length > 0) {
        event.preventDefault();
        duplicateSelection(chosen);
        return true;
      }
      return false;
    },
    [duplicateSelection, redoEdit, selectedIds, undoEdit]
  );
  // S, or Cmd/Ctrl + E, splits at the cursor, Cmd/Ctrl + D duplicates the clip; Escape drops the selection.
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        setSelection(null);
        return;
      }
      const key = event.key.toLowerCase();
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
      className="cn-audio-panel flex w-full min-w-0 flex-col gap-4 border bg-card p-4 outline-none"
      onKeyDown={handleKeyDown}
      ref={panelRef}
      tabIndex={-1}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 p-1">
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
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ButtonGroup>
            <Button
              aria-label="Undo"
              disabled={!historyFlags.undo}
              onClick={undoEdit}
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
              disabled={!historyFlags.redo}
              onClick={redoEdit}
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
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  aria-label="Keyboard shortcuts"
                  size="icon"
                  variant="outline"
                />
              }
            >
              <IconPlaceholder
                hugeicons="KeyboardIcon"
                lucide="KeyboardIcon"
                phosphor="KeyboardIcon"
                remixicon="RiKeyboardLine"
                tabler="IconKeyboard"
              />
            </PopoverTrigger>
            <PopoverContent
              align="center"
              className="max-h-(--available-height) w-80 overflow-y-auto"
            >
              <PopoverHeader>
                <PopoverTitle>Keyboard shortcuts</PopoverTitle>
                <PopoverDescription>
                  Select a clip or a track first.
                </PopoverDescription>
              </PopoverHeader>
              <dl className="flex flex-col gap-2 text-sm">
                {SHORTCUTS.map((shortcut) => (
                  <div
                    className="flex items-center justify-between gap-3"
                    key={`${shortcut.action}-${shortcut.keys.join("+")}`}
                  >
                    <dt>{shortcut.action}</dt>
                    <dd>
                      <KbdGroup>
                        {shortcut.keys.map((key) => (
                          <Kbd key={key}>{key}</Kbd>
                        ))}
                      </KbdGroup>
                    </dd>
                  </div>
                ))}
              </dl>
            </PopoverContent>
          </Popover>
          <Select
            items={DIVISIONS}
            onValueChange={handleDivision}
            value={division}
          >
            <SelectTrigger aria-label="Grid" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {DIVISIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Toggle aria-label="Triplet grid" onPressedChange={setTriplet}>
            Triplet
          </Toggle>
          <Toggle
            aria-label="Snap to grid"
            onPressedChange={setSnap}
            variant="outline"
          >
            Snap {snap ? gridLabel(gridSeconds, tempo) : "off"}
          </Toggle>
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
        <TimelineViewport
          className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-lg border"
          ref={viewportRef}
          scrollbar="hidden"
        >
          {/* As wide as the lanes, so the stuck headers stay put however far it scrolls. */}
          <div
            className={cn(
              "flex min-h-full w-max min-w-full flex-1 flex-col",
              marquee.rect && "select-none"
            )}
            {...marquee.handlers}
          >
            <Row className="sticky top-0 z-30 bg-background">
              <TimelineRuler aria-label="Playhead" getAriaValueText={describe}>
                {labels.map((count) => (
                  <TimelineMark key={count} value={count * bar}>
                    {count + 1}
                  </TimelineMark>
                ))}
                <TimelinePlayhead />
              </TimelineRuler>
            </Row>
            <Row
              lead={
                <span className="flex items-center px-3 text-muted-foreground text-xs">
                  Locators
                </span>
              }
            >
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
            <Row
              lead={
                <span className="flex items-center px-3 text-muted-foreground text-xs">
                  Loop
                </span>
              }
            >
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
            {TRACKS.map((track) => (
              <Row
                className={heights[track.id] === undefined ? "flex-1" : ""}
                height={heights[track.id]}
                key={track.id}
                lead={
                  <TrackHeader
                    mix={mixOf(track.id)}
                    name={track.name}
                    onMix={changeMix}
                    onSelect={selectTrack}
                    selected={track.id === selectedTrack}
                    swatch={track.swatch}
                    trackId={track.id}
                  />
                }
                onResize={resizeTrack}
                selected={track.id === selectedTrack}
                trackId={track.id}
              >
                <TimelineLane
                  className={cn(
                    "h-auto min-h-14 flex-1",
                    track.id === selectedTrack && "bg-muted/40",
                    // A silent track keeps its clips on the page, drained.
                    (mixOf(track.id).muted ||
                      (anySolo && !mixOf(track.id).soloed)) &&
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
                        onAction={clipAction}
                        onChange={changeClip}
                        onCommit={commitClip}
                        onLift={lift}
                        onRemove={removeClip}
                        onRename={renameClip}
                        onSelect={selectClip}
                        selected={selectedIds.includes(clip.id)}
                        trackName={track.name}
                      />
                    ))}
                  <TimelinePlayhead />
                </TimelineLane>
              </Row>
            ))}
          </div>
        </TimelineViewport>
        <TimelineNavigator getAriaValueText={describe} />
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
