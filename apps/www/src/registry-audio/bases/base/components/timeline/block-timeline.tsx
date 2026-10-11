"use client";

import {
  adjacentPoint,
  coverClips,
  createSource,
  duplicateClip,
  splitClip,
  type Timeline as TimelinePrimitive,
} from "@audio-ui/react";
import {
  type KeyboardEvent,
  memo,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { Button } from "@/registry/bases/base/ui/button";
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
import { NumberControl } from "@/registry-audio/bases/base/audio/elements/bpm-control";
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
  TimelineViewport,
} from "@/registry-audio/bases/base/audio/elements/timeline";
import { Transport } from "@/registry-audio/bases/base/audio/elements/transport";
import {
  barLabelInterval,
  DEFAULT_TEMPO,
  describeBarsBeats,
  GRID_DIVISIONS,
  type GridDivision,
  gridInterval,
  secondsPerBar,
  type Tempo,
} from "@/registry-audio/bases/base/lib/musical-time";

const BARS = 32;
/** The arrangement is laid out at the first tempo; a tempo change keeps its musical positions. */
const BAR = secondsPerBar(DEFAULT_TEMPO);
/** The width of a track header, which the lanes start after. */
const LEAD_PX = 112;
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
  { id: "drums", name: "Drums" },
  { id: "bass", name: "Bass" },
  { id: "keys", name: "Keys" },
  { id: "vocals", name: "Vocals" },
] as const;

type Span = readonly [number, number];

interface Arranged {
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
}: {
  children: ReactNode;
  className?: string;
  /** A height set by hand: the row keeps it instead of sharing what is left. */
  height?: number;
  lead?: ReactNode;
}) {
  return (
    <div
      className={`flex min-w-full ${className ?? ""}`}
      style={height === undefined ? undefined : { height }}
    >
      <div className="sticky left-0 z-20 flex w-28 shrink-0 items-stretch border-e bg-background text-sm">
        {lead}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
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

const MIN_TRACK_HEIGHT = 40;
const MAX_TRACK_HEIGHT = 240;
const TRACK_HEIGHT_STEP = 8;

const clampHeight = (value: number) =>
  Math.min(MAX_TRACK_HEIGHT, Math.max(MIN_TRACK_HEIGHT, value));

/**
 * A track's header: pressing it selects the whole track, its content is where
 * the cursor goes. Its lower edge resizes the track, by dragging or with the
 * arrow keys.
 */
function TrackHeader({
  height,
  name,
  onResize,
  onSelect,
  selected,
  trackId,
}: {
  /** The height set by hand, or none while the track shares what is left. */
  height: number | undefined;
  name: string;
  onResize: (trackId: Arranged["track"], height: number) => void;
  onSelect: (trackId: Arranged["track"]) => void;
  selected: boolean;
  trackId: Arranged["track"];
}) {
  const handleClick = useCallback(() => onSelect(trackId), [onSelect, trackId]);
  const resize = useRef<{ height: number; y: number } | null>(null);
  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      // From what the track measures now, which is what it shares out while unset.
      const measured = event.currentTarget.parentElement?.offsetHeight ?? 0;
      resize.current = { height: height ?? measured, y: event.clientY };
    },
    [height]
  );
  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (resize.current) {
        onResize(
          trackId,
          clampHeight(resize.current.height + event.clientY - resize.current.y)
        );
      }
    },
    [onResize, trackId]
  );
  const handlePointerEnd = useCallback(() => {
    resize.current = null;
  }, []);
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const delta =
        { ArrowDown: TRACK_HEIGHT_STEP, ArrowUp: -TRACK_HEIGHT_STEP }[
          event.key
        ] ?? 0;
      if (delta) {
        event.preventDefault();
        event.stopPropagation();
        onResize(
          trackId,
          clampHeight(
            (height ?? event.currentTarget.parentElement?.offsetHeight ?? 0) +
              delta
          )
        );
      }
    },
    [height, onResize, trackId]
  );

  return (
    <div className="relative flex w-full">
      <button
        aria-pressed={selected}
        className="flex w-full items-center px-3 text-left font-medium outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-pressed:bg-muted"
        onClick={handleClick}
        type="button"
      >
        {name}
      </button>
      <div
        aria-label={`${name} height`}
        aria-orientation="horizontal"
        aria-valuemax={MAX_TRACK_HEIGHT}
        aria-valuemin={MIN_TRACK_HEIGHT}
        aria-valuenow={height === undefined ? undefined : Math.round(height)}
        className="absolute inset-x-0 bottom-0 z-10 h-1.5 cursor-row-resize touch-none outline-none hover:bg-primary/40 focus-visible:bg-primary/60"
        onKeyDown={handleKeyDown}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        role="separator"
        tabIndex={0}
      />
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
  trackName,
}: {
  clip: Arranged;
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
  onSelect: (id: string) => void;
  selected: boolean;
  trackName: string;
}) {
  const handleRemove = useCallback(
    () => onRemove(clip.id),
    [clip.id, onRemove]
  );
  const handleSelected = useCallback(
    () => onSelect(clip.id),
    [clip.id, onSelect]
  );
  const handleChange = useCallback(
    (
      value: TimelinePrimitive.Clip.Value,
      details: TimelinePrimitive.Clip.ChangeEventDetails
    ) => onChange(clip.id, value, details),
    [clip.id, onChange]
  );
  const handleCommitted = useCallback(
    (
      _value: TimelinePrimitive.Clip.Value,
      details: TimelinePrimitive.Clip.CommitEventDetails
    ) => onCommit(clip.id, details),
    [clip.id, onCommit]
  );
  return (
    <TimelineClip
      aria-label={`${trackName}, ${clip.name}`}
      className="inset-y-1.5"
      getAriaValueText={describe}
      onRemove={handleRemove}
      onSelectedChange={handleSelected}
      onValueChange={handleChange}
      onValueCommitted={handleCommitted}
      selected={selected}
      sourceLength={clip.sourceLength}
      value={clip.value}
    >
      <TimelineClipHeader>{clip.name}</TimelineClipHeader>
      <TimelineClipFade edge="in" />
      <TimelineClipFade edge="out" />
      <TimelineClipHandle aria-label={`${clip.name} start`} edge="start" />
      <TimelineClipHandle aria-label={`${clip.name} end`} edge="end" />
      <TimelineClipFadeHandle aria-label={`${clip.name} fade in`} edge="in" />
      <TimelineClipFadeHandle aria-label={`${clip.name} fade out`} edge="out" />
    </TimelineClip>
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
  // One thing is selected at a time: a clip, or a whole track by its header.
  const [selection, setSelection] = useState<{
    id: string;
    kind: "clip" | "track";
  } | null>(null);
  const selectedId = selection?.kind === "clip" ? selection.id : null;
  const selectedTrack = selection?.kind === "track" ? selection.id : null;
  const pieces = useRef(0);
  const clipsRef = useRef(clips);
  clipsRef.current = clips;
  // Where a clip dragged with Alt held started: the copy stays there.
  const copyOrigin = useRef<Arranged | null>(null);
  const [division, setDivision] = useState<GridDivision>("adaptive");
  const handleDivision = useCallback(
    (next: GridDivision | null) => setDivision(next ?? "adaptive"),
    []
  );
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
      setLoop(([start, end]) => [start * ratio, end * ratio]);
      setZoom((current) => (current === null ? null : current / ratio));
      clock.set(clock.getSnapshot() * ratio);
      setTempo(next);
    },
    [clock, tempo]
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
      if (!(details.copy && copyOrigin.current)) {
        copyOrigin.current =
          details.copy && details.target === "move"
            ? (clipsRef.current.find((clip) => clip.id === id) ?? null)
            : null;
      }
      setClips((all) =>
        all.map((clip) => (clip.id === id ? { ...clip, value } : clip))
      );
    },
    []
  );
  // A clip dropped on another track moves to it.
  const commitClip = useCallback(
    (id: string, details: TimelinePrimitive.Clip.CommitEventDetails) => {
      const track = details.lane?.dataset.track;
      const origin = details.copy ? copyOrigin.current : null;
      copyOrigin.current = null;
      pieces.current += 1;
      const copyId = `${id}-${pieces.current}`;
      setClips((all) => {
        const current = all.find((clip) => clip.id === id);
        if (!current) {
          return all;
        }
        const placed = track
          ? { ...current, track: track as Arranged["track"] }
          : current;
        const laid = lay(all, placed, duration);
        return origin ? lay(laid, { ...origin, id: copyId }, duration) : laid;
      });
    },
    [duration]
  );
  const selectClip = useCallback(
    (id: string) => setSelection({ id, kind: "clip" }),
    []
  );
  const selectTrack = useCallback(
    (id: string) => setSelection({ id, kind: "track" }),
    []
  );
  // A press on empty lane puts the cursor there (the lane does it) and leaves the selection alone.
  // The shortcuts are caught on the panel, so a press on the lane, which takes no focus, hands it over.
  const panelRef = useRef<HTMLDivElement>(null);
  const focusPanel = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      panelRef.current?.focus({ focusVisible: false, preventScroll: true });
    }
  }, []);
  const removeClip = useCallback((id: string) => {
    setClips((all) => all.filter((clip) => clip.id !== id));
    setSelection((current) => (current?.id === id ? null : current));
  }, []);
  // Cuts at the cursor: the selected clip, or every clip of the selected
  // track that the cursor is over.
  const splitAtCursor = useCallback(() => {
    const at = clock.getSnapshot();
    setClips((all) =>
      all.flatMap((clip) => {
        const targeted = clip.id === selectedId || clip.track === selectedTrack;
        const cut = targeted ? splitClip(clip.value, at, bar / 4) : null;
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
  }, [bar, clock, selectedId, selectedTrack]);
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
      (clip) => clip.id === selectedId || clip.track === selectedTrack
    );
    if (chosen.length === 0) {
      return;
    }
    setLoop([
      Math.min(...chosen.map((clip) => clip.value.start)),
      Math.max(...chosen.map((clip) => clip.value.start + clip.value.length)),
    ]);
    setLooping(true);
  }, [selectedId, selectedTrack]);

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
      const clip = clipsRef.current.find((item) => item.id === selectedId);
      if (key === "d" && (event.metaKey || event.ctrlKey) && clip) {
        event.preventDefault();
        pieces.current += 1;
        const copyId = `${clip.id}-${pieces.current}`;
        setClips((all) =>
          lay(
            all,
            {
              ...clip,
              id: copyId,
              value: duplicateClip(clip.value, {
                duration,
                sourceLength: clip.sourceLength,
              }),
            },
            duration
          )
        );
        setSelection({ id: copyId, kind: "clip" });
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
      duration,
      handleLocatorKey,
      loopSelection,
      selectedId,
      selection,
      splitAtCursor,
    ]
  );

  // The grid the lanes draw is the grid everything snaps to.
  const snapStep = gridInterval(division, zoom, tempo);
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
          onStop={stop}
          onTempoChange={changeTempo}
          playing={playing}
          source={clock}
          tempo={tempo}
        />
        <div className="flex items-center gap-2">
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
            <PopoverContent align="end" className="w-80">
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
          <div className="flex min-h-full w-max min-w-full flex-1 flex-col">
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
                    height={heights[track.id]}
                    name={track.name}
                    onResize={resizeTrack}
                    onSelect={selectTrack}
                    selected={track.id === selectedTrack}
                    trackId={track.id}
                  />
                }
              >
                <TimelineLane
                  className={
                    track.id === selectedTrack
                      ? "h-auto min-h-14 flex-1 bg-muted/40"
                      : "h-auto min-h-14 flex-1"
                  }
                  data-track={track.id}
                  gridStep={snapStep}
                  onPointerDown={focusPanel}
                  seekable
                >
                  {clips
                    .filter((clip) => clip.track === track.id)
                    .map((clip) => (
                      <ClipView
                        clip={clip}
                        describe={describe}
                        key={clip.id}
                        onChange={changeClip}
                        onCommit={commitClip}
                        onRemove={removeClip}
                        onSelect={selectClip}
                        selected={clip.id === selectedId}
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
      </Timeline>
    </div>
  );
}
