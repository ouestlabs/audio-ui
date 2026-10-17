"use client";

import {
  adjacentDivision,
  barLabelInterval,
  barsBeatsWith,
  barsOf,
  DEFAULT_TEMPO,
  divisionAt,
  GRID_DIVISIONS,
  type GridDivision,
  gridInterval,
  gridLabel,
  isSignature,
  type MetronomeRhythm,
  type SignatureChange,
  secondsPerBar,
  type Tempo,
  TRIPLET_FACTOR,
  warpedTime,
} from "@audio-ui/core/time";
import { snapMove } from "@audio-ui/core/timeline";
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
  useMemo,
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
  ClipPanel,
  type ClipSettings,
} from "@/registry-audio/bases/base/audio/panels/clip-panel";
import {
  type ClipAction,
  useArrangement,
} from "@/registry-audio/bases/base/hooks/use-arrangement";
import { useMarquee } from "@/registry-audio/bases/base/hooks/use-marquee-selection";
import { useSimulatedClock } from "@/registry-audio/bases/base/hooks/use-simulated-clock";
import { useSimulatedLevels } from "@/registry-audio/bases/base/hooks/use-simulated-levels";
import type {
  Arranged,
  ArrangementTrack,
  Clipping,
  TimeSelection,
} from "@/registry-audio/bases/base/lib/arrangement";

const BARS = 32;
/** The arrangement is laid out at the first tempo; a tempo change keeps its musical positions. */
const BAR = secondsPerBar(DEFAULT_TEMPO);
/** The width of a track header, which the lanes start after. */
const LEAD_PX = 160;
const MAX_ZOOM = 240;
/** How close an adaptive grid's lines may be, in px: Cmd/Ctrl + 1 and 2 halve and double it. */
const DENSITIES = [6, 12, 24, 48, 96] as const;
/** Cmd/Ctrl + a digit changes the grid, read from the key's place so it works on any keyboard layout. */
const GRID_KEYS: Record<
  string,
  "finer" | "fixed" | "snap" | "triplet" | "wider"
> = {
  Digit1: "finer",
  Digit2: "wider",
  Digit3: "triplet",
  Digit4: "snap",
  Digit5: "fixed",
};

/** The width of the track headers, which the lanes start after. */
function leadWidth(viewport: HTMLElement) {
  return (
    viewport.querySelector<HTMLElement>('[data-slot="timeline-track-header"]')
      ?.offsetWidth ?? LEAD_PX
  );
}

/** Whether a key went to a field you type in, where it is the field's own. */
function typing(target: EventTarget) {
  return (
    (target instanceof HTMLInputElement && target.type !== "range") ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
/** The zoom presets, as shares of the fitted view: Fit shows everything. */
const ZOOM_PRESETS = [1, 2, 4, 8];
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
    { action: "edit", label: "Edit clip" },
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
/** The nearest ancestor that scrolls vertically, or null for the page. */
function verticalScroller(node: HTMLElement): HTMLElement | null {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      parent.scrollHeight > parent.clientHeight
    ) {
      return parent;
    }
  }
  return null;
}

/** How far to scroll so a pointer held near the top or bottom edge of a view keeps it going; 0 away from the edges. */
function edgeScrollStep(y: number, top: number, bottom: number): number {
  if (y < top + 48) {
    return -Math.min(24, Math.ceil((top + 48 - y) / 3));
  }
  if (y > bottom - 48) {
    return Math.min(24, Math.ceil((y - bottom + 48) / 3));
  }
  return 0;
}

/** The line a track would land on: none when it stays where it is or one place below. */
function dropLine(
  gap: number,
  from: number,
  rows: { id: string }[]
): { id: string; edge: "bottom" | "top" } | null {
  if (gap === from || gap === from + 1) {
    return null;
  }
  if (gap < rows.length) {
    return { id: rows[gap].id, edge: "top" };
  }
  return { id: rows.at(-1)?.id ?? "", edge: "bottom" };
}

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

/** A time-signature change, with an id that stays the same as it moves, so its button keeps the focus. */
type Signature = SignatureChange & { id: string };

/** "7/8" as a signature, or null when it is not one a bar can have. */
function parseSignature(text: string) {
  const [beats, unit] = text.split("/").map((part) => Number(part.trim()));
  return beats !== undefined && unit !== undefined && isSignature(beats, unit)
    ? { beatUnit: unit, beatsPerBar: beats }
    : null;
}

/**
 * A time-signature change: press it to put the cursor there, double-click it
 * or press Enter to type a new signature such as 7/8 (Enter keeps it, Escape
 * drops it), Left and Right move it by a grid step, Delete takes it away.
 */
function SignatureButton({
  change,
  editing,
  onEditingChange,
  onJump,
  onMove,
  onRemove,
  onSet,
  step,
}: {
  change: Signature;
  editing: boolean;
  onEditingChange: (id: string | null) => void;
  onJump: (at: number) => void;
  onMove: (id: string, to: number) => void;
  onRemove: (id: string) => void;
  onSet: (id: string, beatsPerBar: number, beatUnit: number) => void;
  step: number;
}) {
  const { at, beatUnit, beatsPerBar, id } = change;
  const label = `${beatsPerBar}/${beatUnit}`;
  const handleClick = useCallback(() => onJump(at), [at, onJump]);
  const startEditing = useCallback(
    () => onEditingChange(id),
    [id, onEditingChange]
  );
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const direction = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (event.key === "Delete" || event.key === "Backspace") {
        onRemove(id);
      } else if (event.key === "Enter") {
        onEditingChange(id);
      } else if (direction && step > 0) {
        onMove(id, at + direction * step);
      } else {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    [at, id, onEditingChange, onMove, onRemove, step]
  );
  const handleEditKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        const parsed = parseSignature(event.currentTarget.value);
        if (parsed) {
          onSet(id, parsed.beatsPerBar, parsed.beatUnit);
        }
        onEditingChange(null);
      } else if (event.key === "Escape") {
        onEditingChange(null);
      }
    },
    [id, onEditingChange, onSet]
  );
  const stopEditing = useCallback(
    () => onEditingChange(null),
    [onEditingChange]
  );
  const handleRemove = useCallback(() => onRemove(id), [id, onRemove]);

  if (editing) {
    return (
      <input
        aria-label="Time signature, such as 7/8"
        autoFocus
        className="h-full w-14 border-primary border-s-2 bg-background px-1 text-primary text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
        defaultValue={label}
        onBlur={stopEditing}
        onKeyDown={handleEditKeyDown}
        onPointerDown={stopPress}
      />
    );
  }
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <button
            aria-label={`Time signature ${label}`}
            className="pointer-events-auto flex h-full items-center whitespace-nowrap border-foreground/60 border-s-2 ps-1 pe-2 text-xs tabular-nums outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            onClick={handleClick}
            onDoubleClick={startEditing}
            onKeyDown={handleKeyDown}
            type="button"
          />
        }
      >
        {label}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-auto min-w-32">
        <ContextMenuItem onClick={startEditing}>Edit</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleRemove} variant="destructive">
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** How far a clip can be stretched on the timeline: forever looped, as its warp stretches its source, or as long as its source. */
function sourceSpan(clip: Arranged) {
  if (clip.loop) {
    return;
  }
  return clip.warp
    ? warpedTime(clip.warp, clip.sourceLength)
    : clip.sourceLength;
}

/** What a piece of a clip adds to its id: the recording is the id before it. */
const LEADING_ID = /-.*$/;

/** How many peaks the clip panel draws of a source. */
const PEAKS = 256;

/**
 * A stand-in for the peaks of a clip's recording, which the block does not
 * have: a shape of its own for each recording (the clip's id before any piece
 * suffix), drawn over the stretch of it the clip's source holds.
 */
function standInPeaks(clip: Arranged): number[] {
  const seed = [...clip.id.replace(LEADING_ID, "")].reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0
  );
  const from = clip.sourceFrom ?? 0;
  return Array.from({ length: PEAKS }, (_, index) => {
    const time = from + (index / (PEAKS - 1)) * clip.sourceLength;
    const swell = 0.55 + 0.3 * Math.sin(time * 0.9 + seed);
    const beat = 0.6 + 0.4 * Math.abs(Math.cos(time * Math.PI));
    const grain = Math.abs(
      (Math.sin((time + seed) * 12.9898) * 43_758.5453) % 1
    );
    return Math.min(1, swell * beat * (0.5 + 0.5 * grain) + 0.05);
  });
}

/** The clip panel under the tracks, for the clip being edited, or a word on how to pick one. */
function ClipDock({
  bar,
  clip,
  format,
  onClose,
  onCrop,
  onValueChange,
  onValueCommitted,
  peaks,
}: {
  bar: number;
  clip: Arranged | undefined;
  format: (seconds: number) => string;
  onClose: () => void;
  onCrop: () => void;
  onValueChange: (next: ClipSettings) => void;
  onValueCommitted: () => void;
  peaks: number[];
}) {
  if (!clip) {
    return null;
  }
  return (
    <ClipPanel
      bar={bar}
      format={format}
      name={clip.name}
      onCrop={onCrop}
      onValueChange={onValueChange}
      onValueCommitted={onValueCommitted}
      value={{
        gain: clip.gain ?? 0,
        length: clip.value.length,
        loop: clip.loop ?? null,
        offset: clip.value.offset,
        reversed: Boolean(clip.reversed),
        sourceLength: clip.sourceLength,
        transpose: clip.transpose ?? 0,
        warp: clip.warp ?? null,
      }}
      values={peaks}
    >
      <Button
        aria-label="Close the clip panel"
        onClick={onClose}
        size="icon-sm"
        variant="ghost"
      >
        <IconPlaceholder
          aria-hidden="true"
          className="size-4"
          hugeicons="Cancel01Icon"
          lucide="XIcon"
          phosphor="XIcon"
          remixicon="RiCloseLine"
          tabler="IconX"
        />
      </Button>
    </ClipPanel>
  );
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
          // A looped clip repeats its loop, as far as it is stretched; a warped one lasts as its warp stretches its source.
          sourceLength={sourceSpan(clip)}
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
  // Time-signature changes along the song, in seconds; the bars, the ruler and the position follow them.
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [editingSignature, setEditingSignature] = useState<string | null>(null);
  const signatureCount = useRef(0);
  const describe = useCallback(
    (seconds: number) => {
      const { bar: number, beat } = barsBeatsWith(seconds, tempo, signatures);
      return `Bar ${number}, beat ${beat}`;
    },
    [signatures, tempo]
  );
  const [loop, setLoop] = useState<Span>([bars(8), bars(16)]);
  const [looping, setLooping] = useState(true);
  // A stretch of time on some tracks, drawn by dragging across bare lanes, and what was last copied.
  const [timeSelection, setTimeSelection] = useState<TimeSelection | null>(
    null
  );
  const clipboard = useRef<Clipping | null>(null);
  // The track a press on bare lane began on: a time selection spans from it to the track under the pointer.
  const pressTrackRef = useRef<string | null>(null);
  // Locators: named points to jump to, kept in seconds at the tempo they were set.
  const [locators, setLocators] = useState<Locator[]>([
    { at: bars(4), name: "Verse" },
    { at: bars(20), name: "Chorus" },
  ]);
  const [metronome, setMetronome] = useState(false);
  const [rhythm, setRhythm] = useState<MetronomeRhythm>("auto");
  const { clock, playing, setPlaying } = useSimulatedClock({
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
  // Below the bar's room, the tempo and the undo and redo move into the more-controls menu.
  const narrowProbeRef = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
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
      if (narrowProbeRef.current) {
        setNarrow(getComputedStyle(narrowProbeRef.current).display !== "none");
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
    clearTimeSelection,
    clipAction,
    clips,
    commitClip,
    consolidateTime,
    copying,
    copyOf,
    crop,
    editClip,
    fadeTimeSelection,
    duplicateSelection,
    duplicateTrack,
    folded,
    heights,
    insertTimeSpan,
    paste,
    toggleFold,
    toggleSelected,
    mixOf,
    redo,
    moveTrack,
    removeClip,
    removeTimeSpan,
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
    settleClipEdit,
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
  const [density, setDensity] = useState<number>(24);
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
      setSignatures((all) =>
        all.map((change) => ({ ...change, at: change.at * ratio }))
      );
      setZoom((current) => (current === null ? null : current / ratio));
      clock.set(clock.getSnapshot() * ratio);
      setTempo(next);
    },
    [clock, rescale, tempo]
  );
  // The zoom as a share of the fitted view: 100% shows everything.
  const zoomRatio = fitPx > 0 ? zoom / fitPx : 1;
  const maxRatio = fitPx > 0 ? MAX_ZOOM / fitPx : 1;
  const zoomPreset = ZOOM_PRESETS.find(
    (ratio) => Math.abs(ratio - zoomRatio) < 0.01
  );
  const changeZoom = useCallback(
    (ratio: number) => setZoom(ratio <= 1 ? null : ratio * fitPx),
    [fitPx]
  );
  // The track being dragged by its grip, and the gap it would land in: above or below the track under the pointer.
  // The drag runs on pointer events, not the browser's drag and drop. The copy follows the pointer through a transform
  // written straight onto its element, and the rows are measured once, so a move costs no render: React only hears
  // about the drop gap when it changes.
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{
    id: string;
    edge: "bottom" | "top";
  } | null>(null);
  const [copy, setCopy] = useState<{
    edge: string;
    name: string;
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const startTrackDrag = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      const id = event.currentTarget.dataset.trackId ?? "";
      const row = event.currentTarget.closest<HTMLElement>(
        '[data-slot="timeline-track"]'
      );
      const panel = event.currentTarget.closest<HTMLElement>(".cn-audio-panel");
      if (!(row && panel)) {
        return;
      }
      // Each grip spans its row's height, so its box gives the row's top and bottom.
      const rows = Array.from(
        panel.querySelectorAll<HTMLElement>("button[data-track-id]")
      ).map((grip) => {
        const box = grip.getBoundingClientRect();
        return {
          id: grip.dataset.trackId ?? "",
          top: box.top,
          bottom: box.bottom,
        };
      });
      const from = rows.findIndex((item) => item.id === id);
      const box = row.getBoundingClientRect();
      // The copy is the track's header, the column the name and the controls sit in.
      const header = (
        row.querySelector<HTMLElement>('[data-slot="timeline-track-header"]') ??
        row
      ).getBoundingClientRect();
      const scroller = verticalScroller(row);
      const scrollTop = () => (scroller ? scroller.scrollTop : window.scrollY);
      const startScroll = scrollTop();
      const startY = event.clientY;
      let gap = from;
      let lastY = startY;
      let frame = 0;

      // Once a frame while the track is dragged, whether or not the pointer moved: near an edge of the scroller, it
      // scrolls; the rows are where they were at the press, moved by how far the scroller has gone since.
      const tick = () => {
        const view = scroller
          ? scroller.getBoundingClientRect()
          : { top: 0, bottom: window.innerHeight };
        const step = edgeScrollStep(lastY, view.top, view.bottom);
        if (scroller) {
          scroller.scrollTop += step;
        } else {
          window.scrollBy(0, step);
        }
        if (copyRef.current) {
          copyRef.current.style.transform = `translateY(${lastY - startY}px)`;
        }
        const shift = scrollTop() - startScroll;
        const index = rows.findIndex(
          (item) => lastY < (item.top + item.bottom) / 2 - shift
        );
        const next = index === -1 ? rows.length : index;
        if (next !== gap) {
          gap = next;
          setDrop(dropLine(gap, from, rows));
        }
        frame = requestAnimationFrame(tick);
      };
      const move = (moveEvent: globalThis.PointerEvent) => {
        lastY = moveEvent.clientY;
      };
      const finish = (commit: boolean) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", release);
        window.removeEventListener("pointercancel", cancel);
        cancelAnimationFrame(frame);
        // The gap the track lands in; one less once the track has left a place above it.
        const landed = gap > from ? gap - 1 : gap;
        if (commit && from !== -1 && landed !== from) {
          moveTrack(id, landed);
        }
        setCopy(null);
        setDragId(null);
        setDrop(null);
      };
      const release = () => finish(true);
      const cancel = () => finish(false);

      const dragged = tracks.find((track) => track.id === id);
      setCopy({
        edge:
          TRACK_COLORS[mixOf(dragged ?? tracks[from] ?? tracks[0]).color]
            ?.edge ?? "",
        name: dragged?.name ?? "",
        top: box.top,
        left: header.left,
        width: header.width,
        height: box.height,
      });
      setDragId(id);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", release);
      window.addEventListener("pointercancel", cancel);
      frame = requestAnimationFrame(tick);
    },
    [mixOf, moveTrack, tracks]
  );
  const nudgeTrack = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.dataset.trackId ?? "";
      const from = tracks.findIndex((track) => track.id === id);
      if (from === -1) {
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveTrack(id, from - 1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        moveTrack(id, from + 1);
      }
    },
    [moveTrack, tracks]
  );
  const changeZoomPreset = useCallback(
    (value: string) => changeZoom(Number(value)),
    [changeZoom]
  );
  const handleDivisionValue = useCallback(
    (value: string) => setDivision(value as GridDivision),
    []
  );
  const seek = useCallback((seconds: number) => clock.set(seconds), [clock]);
  // A press on a track's empty lane puts the cursor there (the lane does it) and picks the track, letting go of the clips; on the surface under the last track it lets go of everything, as nothing is there.
  // The shortcuts are caught on the panel, so a press on the lane, which takes no focus, hands it over.
  const panelRef = useRef<HTMLDivElement>(null);
  const focusPanel = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget && !event.shiftKey && !multi) {
        const { track } = event.currentTarget.dataset;
        pressTrackRef.current = track ?? null;
        setTimeSelection(null);
        if (track) {
          selectTrack(track);
        } else {
          clearSelection();
        }
        // `focusVisible` is missing from older DOM typings.
        panelRef.current?.focus({
          focusVisible: false,
          preventScroll: true,
        } as FocusOptions);
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

  /** M adds a locator, Alt + arrows jump to the next locator or clip edge; returns whether the key was one of these. */
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
      // The locators, and the edges of the clips on the picked tracks (on every track when none is picked).
      const edges = clips
        .filter(
          (clip) =>
            selectedTracks.length === 0 || selectedTracks.includes(clip.track)
        )
        .flatMap((clip) => [
          clip.value.start,
          clip.value.start + clip.value.length,
        ]);
      const target = adjacentPoint(
        [...locators.map((locator) => locator.at), ...edges],
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
    [addLocator, clips, clock, locators, selectedTracks]
  );
  // The copies are there to be seen: bring them into view once they are drawn.
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
  /** A drag across bare lanes selects time: from the track it began on to the track under the pointer. */
  const selectTime = useCallback(
    (
      range: readonly [number, number],
      details: TimelinePrimitive.Lane.SelectionChangeEventDetails
    ) => {
      const order = tracks.map((track) => track.id);
      const first = order.indexOf(pressTrackRef.current ?? "");
      if (first === -1) {
        return;
      }
      const under = document
        .elementFromPoint(details.event.clientX, details.event.clientY)
        ?.closest<HTMLElement>("[data-track]")?.dataset.track;
      const last = under ? order.indexOf(under) : -1;
      const [top, bottom] =
        last === -1
          ? [first, first]
          : [Math.min(first, last), Math.max(first, last)];
      setTimeSelection({ range, tracks: order.slice(top, bottom + 1) });
    },
    [tracks]
  );
  /** Picking a clip lets go of the time selection. */
  // Picking a clip shows it in the clip panel, as a DAW's detail view follows the selection.
  const [clipViewOpen, setClipViewOpen] = useState(true);
  const pickClip = useCallback(
    (id: string, additive: boolean) => {
      setTimeSelection(null);
      setClipViewOpen(true);
      selectClip(id, additive);
    },
    [selectClip]
  );
  // The clip panel, under the tracks: it edits the first selected clip.
  const editedClip = clips.find((clip) => clip.id === selectedIds[0]);
  const editedPeaks = useMemo(
    () => (editedClip ? standInPeaks(editedClip) : []),
    [editedClip]
  );
  const handleClipAction = useCallback(
    (action: ClipAction, id: string) => {
      if (action === "edit") {
        pickClip(id, false);
        setClipViewOpen(true);
      } else {
        clipAction(action, id);
      }
    },
    [clipAction, pickClip]
  );
  const changeClipSettings = useCallback(
    (next: ClipSettings) => {
      if (!editedClip) {
        return;
      }
      editClip(editedClip.id, (clip) => {
        // The clip keeps its place: what it plays changes, so it ends as early as the timeline needs.
        const length = Math.min(next.length, duration - clip.value.start);
        const fadeIn = Math.min(clip.value.fadeIn, length);
        return {
          ...clip,
          gain: next.gain,
          loop: next.loop ?? undefined,
          reversed: next.reversed,
          transpose: next.transpose,
          warp: next.warp ?? undefined,
          value: {
            ...clip.value,
            fadeIn,
            fadeOut: Math.min(clip.value.fadeOut, length - fadeIn),
            length,
            offset: next.offset,
          },
        };
      });
    },
    [duration, editClip, editedClip]
  );
  const cropEdited = useCallback(() => {
    if (editedClip) {
      crop(editedClip.id);
    }
  }, [crop, editedClip]);
  const closeClipView = useCallback(() => setClipViewOpen(false), []);
  /** Where a paste lands: the picked track, the top of the time selection, the track of a picked clip, or the first track. */
  const pasteTrack = () =>
    selectedTracks[0] ??
    timeSelection?.tracks[0] ??
    clips.find((clip) => selectedIds.includes(clip.id))?.track ??
    tracks[0]?.id;
  /** Cmd/Ctrl + D: the time selection again right after itself, which the selection moves onto; with Shift, time is opened for it first. */
  const duplicateTime = (time: TimeSelection, opening: boolean) => {
    const copied = copyOf(time);
    const [from, to] = time.range;
    if (opening) {
      insertTimeSpan(to, to - from);
    }
    paste(copied, to, time.tracks[0] ?? "");
    setTimeSelection({ ...time, range: [to, to + (to - from)] });
  };
  /** Cmd/Ctrl + V: the last copy at the cursor; with Shift, time is opened for it first. */
  const pasteClipboard = (opening: boolean) => {
    const copied = clipboard.current;
    if (!copied) {
      return;
    }
    const at = clock.getSnapshot();
    if (opening) {
      insertTimeSpan(at, copied.length);
    }
    paste(copied, at, pasteTrack() ?? "");
  };
  /** Cmd/Ctrl + X: copies, then empties the time selection (takes the time out, with Shift), or removes the selected clips. */
  const cutSelection = (removing: boolean) => {
    clipboard.current = copyOf(timeSelection);
    if (timeSelection && removing) {
      removeTimeSpan(...timeSelection.range);
      setTimeSelection(null);
    } else if (timeSelection) {
      clearTimeSelection(timeSelection);
    } else if (selectedIds[0]) {
      removeClip(selectedIds[0]);
    }
  };
  /** What Cmd/Ctrl + a letter does to the time selection, the clipboard or the cursor, or undefined when it does nothing here. */
  const timeCommand = (key: string, shift: boolean) => {
    const length = timeSelection
      ? timeSelection.range[1] - timeSelection.range[0]
      : bar;
    const time = timeSelection;
    const commands: Record<string, (() => void) | undefined> = {
      c: () => {
        clipboard.current = copyOf(time);
      },
      d: time ? () => duplicateTime(time, shift) : undefined,
      i: () => insertTimeSpan(clock.getSnapshot(), length),
      j: time ? () => consolidateTime(time) : undefined,
      l: time
        ? () => {
            setLoop([...time.range]);
            setLooping(true);
          }
        : undefined,
      v: clipboard.current ? () => pasteClipboard(shift) : undefined,
      x: () => cutSelection(shift),
    };
    return commands[key];
  };
  /** What Delete does: empties the time selection, or with Cmd/Ctrl + Shift takes the time out of every track. */
  const deleteCommand = (event: KeyboardEvent<HTMLDivElement>) => {
    const time = timeSelection;
    if (!time) {
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      return event.shiftKey
        ? () => {
            removeTimeSpan(...time.range);
            setTimeSelection(null);
          }
        : undefined;
    }
    return () => clearTimeSelection(time);
  };
  /**
   * Cmd/Ctrl + Alt + 3 shows or hides the clip panel, and Cmd/Ctrl + Alt + F
   * makes fades from the time selection. Read from the key's place: Alt
   * changes the letter on a Mac. Returns whether the key was one of these.
   */
  const handleAltCommand = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!((event.metaKey || event.ctrlKey) && event.altKey)) {
      return false;
    }
    if (event.code === "Digit3") {
      setClipViewOpen((open) => !open);
    } else if (event.code === "KeyF" && timeSelection) {
      fadeTimeSelection(timeSelection);
    } else {
      return false;
    }
    event.preventDefault();
    return true;
  };
  /**
   * Cmd/Ctrl + C and X copy and cut the time selection (the selected clips
   * when there is none), V pastes at the cursor, I opens a stretch of silence
   * there; with a time selection, D duplicates it after itself, J makes one
   * clip per track of it and L loops it. With Shift too, X, V, D and Delete
   * work on the time itself, on every track. Delete empties the time
   * selection, and 0 switches the selected clips off or on. Cmd/Ctrl + Alt + F
   * fades the clips whose edges the time selection covers, crossfading two that
   * meet. Returns whether the key was one of these.
   */
  const handleTimeKey = (event: KeyboardEvent<HTMLDivElement>) => {
    // In a field, copying and deleting are the field's own.
    if (typing(event.target)) {
      return false;
    }
    if (handleAltCommand(event)) {
      return true;
    }
    if (event.altKey) {
      return false;
    }
    const key = event.key.toLowerCase();
    let command: (() => void) | undefined;
    if (event.key === "Delete" || event.key === "Backspace") {
      command = deleteCommand(event);
    } else if (event.metaKey || event.ctrlKey) {
      command = timeCommand(key, event.shiftKey);
    } else if (
      (key === "0" || event.code === "Digit0") &&
      selectedIds.length > 0
    ) {
      command = toggleSelected;
    }
    if (!command) {
      return false;
    }
    event.preventDefault();
    command();
    return true;
  };
  // S, or Cmd/Ctrl + E, splits at the cursor, Cmd/Ctrl + D duplicates the clip; Escape drops the selection.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      clearSelection();
      setTimeSelection(null);
      return;
    }
    const key = event.key.toLowerCase();
    if (
      handleTimeKey(event) ||
      handleTrackKey(event) ||
      handleLocatorKey(event)
    ) {
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
  };

  // The grid the lanes draw is the grid everything snaps to.
  // Snap off draws no lines and snaps nothing: a step of 0 is no grid.
  const gridSeconds = gridInterval(division, zoom, tempo, {
    minSpacing: density,
    triplet,
  });
  const snapStep = snap ? gridSeconds : 0;
  const labelEvery = barLabelInterval(zoom, tempo);
  // Whole bars, counted rather than divided, so no tempo leaves a label like 6.9999.
  const labelBars = Math.max(1, Math.round(labelEvery / bar));
  // The bars through the signature changes: the ruler numbers every few, and hatches the ones a change cuts short.
  const songBars = useMemo(
    () => barsOf(tempo, signatures, duration),
    [duration, signatures, tempo]
  );
  const labels = songBars.filter((_, index) => index % labelBars === 0);

  /** Adds a signature change at the cursor, in the signature already in force there, and opens it to be typed. */
  const addSignature = useCallback(() => {
    const at = clock.getSnapshot();
    const [held] = signatures
      .filter((change) => change.at <= at)
      .sort((a, b) => b.at - a.at);
    signatureCount.current += 1;
    const id = `signature-${signatureCount.current}`;
    setSignatures((all) => [
      ...all.filter((change) => change.at !== at),
      {
        at,
        beatUnit: held?.beatUnit ?? tempo.beatUnit,
        beatsPerBar: held?.beatsPerBar ?? tempo.beatsPerBar,
        id,
      },
    ]);
    setEditingSignature(id);
  }, [clock, signatures, tempo]);
  const setSignature = useCallback(
    (id: string, beatsPerBar: number, beatUnit: number) =>
      setSignatures((all) =>
        all.map((change) =>
          change.id === id ? { ...change, beatUnit, beatsPerBar } : change
        )
      ),
    []
  );
  const moveSignature = useCallback(
    (id: string, to: number) =>
      setSignatures((all) =>
        all.map((change) =>
          change.id === id
            ? { ...change, at: Math.min(duration, Math.max(0, to)) }
            : change
        )
      ),
    [duration]
  );
  const removeSignature = useCallback(
    (id: string) =>
      setSignatures((all) => all.filter((change) => change.id !== id)),
    []
  );

  // A dragged clip or loop is pulled onto the edges of the other clips, the locators and the loop.
  const snapPoints = useMemo(() => {
    if (!snap) {
      return;
    }
    const points = new Set<number>(loop);
    for (const clip of clips) {
      points.add(clip.value.start);
      points.add(clip.value.start + clip.value.length);
    }
    for (const locator of locators) {
      points.add(locator.at);
    }
    return [...points];
  }, [clips, locators, loop, snap]);

  /** A finer or wider grid: a denser or sparser adaptive grid, or the next fixed division. */
  const stepGrid = useCallback(
    (finer: boolean) => {
      if (division !== "adaptive") {
        setDivision(adjacentDivision(division, finer ? 1 : -1));
        return;
      }
      // Denser lines are closer together: finer halves how close they may be.
      const index = DENSITIES.indexOf(density as (typeof DENSITIES)[number]);
      const next = DENSITIES[index + (finer ? -1 : 1)];
      if (next !== undefined) {
        setDensity(next);
      }
    },
    [density, division]
  );
  /** Cmd/Ctrl + 1 to 5: a finer or wider grid, triplets, snapping, and a grid fixed where it is or following the zoom again. */
  const changeGrid = useCallback(
    (change: (typeof GRID_KEYS)[string]) => {
      if (change === "triplet") {
        setTriplet((on) => !on);
      } else if (change === "snap") {
        setSnap((on) => !on);
      } else if (change === "fixed") {
        setDivision(
          division === "adaptive"
            ? divisionAt(gridSeconds / (triplet ? TRIPLET_FACTOR : 1), tempo)
            : "adaptive"
        );
      } else {
        stepGrid(change === "finer");
      }
    },
    [division, gridSeconds, stepGrid, tempo, triplet]
  );

  // Z zooms onto the selection, + and - zoom around the cursor, X steps back through the zooms they left behind.
  const zoomHistory = useRef<{ scroll: number; zoom: number | null }[]>([]);
  /** Zooms to `next` px per second, with `value` seconds `offset` px from the viewport's left edge. */
  const zoomOnto = useCallback(
    (next: number, value: number, offset: number) => {
      const element = viewportRef.current;
      if (!element) {
        return;
      }
      zoomHistory.current.push({ scroll: element.scrollLeft, zoom: zoomed });
      const clamped = Math.min(MAX_ZOOM, Math.max(fitPx, next));
      setZoom(clamped <= fitPx ? null : clamped);
      // After the timeline has drawn the new zoom, which keeps its middle still.
      requestAnimationFrame(() => {
        element.scrollLeft = leadWidth(element) + value * clamped - offset;
      });
    },
    [fitPx, zoomed]
  );
  const zoomAroundCursor = useCallback(
    (factor: number) => {
      const element = viewportRef.current;
      if (!element) {
        return;
      }
      const lead = leadWidth(element);
      const at = clock.getSnapshot();
      const x = lead + at * zoom - element.scrollLeft;
      // A cursor out of view gives way to the middle of the view.
      const offset =
        x >= lead && x <= element.clientWidth
          ? x
          : (lead + element.clientWidth) / 2;
      const value =
        x >= lead && x <= element.clientWidth
          ? at
          : (element.scrollLeft + offset - lead) / zoom;
      zoomOnto(zoom * factor, value, offset);
    },
    [clock, zoom, zoomOnto]
  );
  const zoomToSelection = useCallback(() => {
    const element = viewportRef.current;
    const chosen = clips.filter(
      (clip) =>
        selectedIds.includes(clip.id) || selectedTracks.includes(clip.track)
    );
    const [start, end] =
      chosen.length > 0
        ? [
            Math.min(...chosen.map((clip) => clip.value.start)),
            Math.max(
              ...chosen.map((clip) => clip.value.start + clip.value.length)
            ),
          ]
        : loop;
    if (!element || end <= start) {
      return;
    }
    const lead = leadWidth(element);
    zoomOnto((element.clientWidth - lead) / (end - start), start, lead);
  }, [clips, loop, selectedIds, selectedTracks, zoomOnto]);
  const zoomBack = useCallback(() => {
    const element = viewportRef.current;
    const previous = zoomHistory.current.pop();
    if (!(element && previous)) {
      return;
    }
    setZoom(previous.zoom);
    requestAnimationFrame(() => {
      element.scrollLeft = previous.scroll;
    });
  }, []);

  /** Up and Down pick the track above or below the one picked, or the first or last. */
  const pickNextTrack = useCallback(
    (direction: 1 | -1) => {
      const current =
        selectedTracks[0] ??
        clips.find((clip) => selectedIds.includes(clip.id))?.track;
      const index = tracks.findIndex((track) => track.id === current);
      const next =
        index === -1
          ? tracks.at(direction === 1 ? 0 : -1)
          : tracks[Math.min(tracks.length - 1, Math.max(0, index + direction))];
      if (next) {
        selectTrack(next.id);
      }
    },
    [clips, selectTrack, selectedIds, selectedTracks, tracks]
  );

  /** On the panel itself: arrows move the cursor on the grid, Home and End go to the ends of the arrangement. */
  const handleCursorKey = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) {
        return false;
      }
      const at = clock.getSnapshot();
      const lastEnd = Math.max(
        0,
        ...clips.map((clip) => clip.value.start + clip.value.length)
      );
      const step = gridSeconds;
      const targets: Record<string, number> = {
        ArrowLeft: snapMove(at - step, at, { offset: 0, step }),
        ArrowRight: snapMove(at + step, at, { offset: 0, step }),
        End: lastEnd,
        Home: 0,
      };
      const target = targets[event.key];
      if (target !== undefined) {
        event.preventDefault();
        clock.set(Math.min(duration, Math.max(0, target)));
        return true;
      }
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        pickNextTrack(event.key === "ArrowDown" ? 1 : -1);
        return true;
      }
      return false;
    },
    [clips, clock, duration, gridSeconds, pickNextTrack]
  );

  /** The navigation keys: the grid with Cmd/Ctrl + 1 to 5, the zoom with +, -, Z and X, and the cursor from the panel. */
  const handleNavigationKey = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.metaKey || event.ctrlKey) {
        const change = GRID_KEYS[event.code];
        if (!(change && !event.altKey && !event.shiftKey)) {
          return false;
        }
        event.preventDefault();
        changeGrid(change);
        return true;
      }
      if (typing(event.target) || event.altKey) {
        return false;
      }
      const key = event.key.toLowerCase();
      const zoomKeys: Record<string, () => void> = {
        "+": () => zoomAroundCursor(2),
        "-": () => zoomAroundCursor(0.5),
        "=": () => zoomAroundCursor(2),
        x: zoomBack,
        z: zoomToSelection,
      };
      const zoomKey = event.shiftKey && key !== "+" ? undefined : zoomKeys[key];
      if (zoomKey) {
        event.preventDefault();
        zoomKey();
        return true;
      }
      // Anywhere else in the panel, a clip's or the loop's own input takes its arrows.
      return event.target === event.currentTarget && handleCursorKey(event);
    },
    [changeGrid, handleCursorKey, zoomAroundCursor, zoomBack, zoomToSelection]
  );
  const handlePanelKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!handleNavigationKey(event)) {
      handleKeyDown(event);
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the editor's shortcuts, caught from the controls inside it
    <div
      className="cn-audio-panel @container/panel flex w-full min-w-0 flex-col gap-4 border bg-card p-4 outline-none"
      onKeyDown={handlePanelKey}
      ref={panelRef}
      tabIndex={-1}
    >
      <div className="flex items-center justify-between gap-2 p-1">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="@3xl/panel:hidden" ref={narrowProbeRef} />
          <Transport
            className="min-w-0 flex-1 flex-nowrap"
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
            signatures={signatures}
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
        <div className="flex min-w-0 items-center gap-2">
          <ButtonGroup className="hidden @3xl/panel:flex">
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
              {narrow ? (
                <>
                  <DropdownMenuItem disabled={!canUndo} onClick={undo}>
                    Undo
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!canRedo} onClick={redo}>
                    Redo
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuCheckboxItem
                checked={multi}
                onCheckedChange={setMulti}
              >
                Multi-select
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
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Zoom</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-auto">
                      <div className="p-2">
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
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup
                        onValueChange={changeZoomPreset}
                        value={
                          zoomPreset === undefined ? "" : String(zoomPreset)
                        }
                      >
                        {ZOOM_PRESETS.map((ratio) => (
                          <DropdownMenuRadioItem
                            disabled={ratio > maxRatio}
                            key={ratio}
                            value={String(ratio)}
                          >
                            {ratio === 1 ? "Fit" : `${ratio * 100} %`}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
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
        snapPoints={snapPoints}
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
              <Row
                className="shrink-0 border-foreground/25 border-b"
                lead={
                  <span className="flex h-full items-center px-3 text-xs text-muted-foreground">
                    Loop
                  </span>
                }
              >
                <TimelineLane className="h-6 cursor-cell border-b-0">
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
              <Row
                className="shrink-0 border-foreground/25 border-b bg-background"
                lead={
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          aria-label="Grid"
                          className="h-full w-full justify-start rounded-none border-0 tabular-nums"
                          variant="ghost"
                        />
                      }
                    >
                      {snap ? gridLabel(gridSeconds, tempo) : "Snap off"}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-auto min-w-48"
                    >
                      <TimelineGridMenuItems
                        division={division}
                        divisions={DIVISIONS}
                        onDivisionChange={handleDivisionValue}
                        onSnapChange={setSnap}
                        onTripletChange={setTriplet}
                        snap={snap}
                        triplet={triplet}
                        variant="dropdown"
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
              >
                <TimelineRuler
                  aria-label="Playhead"
                  className="border-b-0"
                  getAriaValueText={describe}
                >
                  {songBars
                    .filter((item) => item.partial)
                    .map((item) => (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 bg-[repeating-linear-gradient(135deg,var(--muted-foreground)_0_1px,transparent_1px_6px)] opacity-30"
                        data-slot="timeline-partial-bar"
                        key={item.start}
                        style={{
                          left: `calc(var(--timeline-unit) * ${item.start})`,
                          width: `calc(var(--timeline-unit) * ${item.length})`,
                        }}
                      />
                    ))}
                  {labels.map((item) => (
                    <TimelineMark key={item.start} value={item.start}>
                      {item.number}
                    </TimelineMark>
                  ))}
                  <TimelinePlayhead />
                </TimelineRuler>
              </Row>
              <Row
                className="shrink-0 border-foreground/25 border-b bg-background"
                lead={
                  <span className="flex h-full items-center px-3 text-xs text-muted-foreground">
                    Markers
                  </span>
                }
              >
                <TimelineLane className="h-6 border-b-0">
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
                className="shrink-0 border-foreground/25 border-b bg-background"
                lead={
                  <div className="flex h-full items-center justify-between ps-3 pe-1 text-muted-foreground text-xs">
                    Signature
                    <Button
                      aria-label="Add a time signature at the cursor"
                      className="size-5"
                      onClick={addSignature}
                      size="icon"
                      title="Add a time signature at the cursor"
                      variant="ghost"
                    >
                      <IconPlaceholder
                        aria-hidden="true"
                        className="size-3"
                        hugeicons="PlusSignIcon"
                        lucide="PlusIcon"
                        phosphor="PlusIcon"
                        remixicon="RiAddLine"
                        tabler="IconPlus"
                      />
                    </Button>
                  </div>
                }
              >
                <TimelineLane className="h-6 border-b-0">
                  {signatures.map((change) => (
                    <TimelineMark key={change.id} value={change.at}>
                      <SignatureButton
                        change={change}
                        editing={editingSignature === change.id}
                        onEditingChange={setEditingSignature}
                        onJump={jumpToLocator}
                        onMove={moveSignature}
                        onRemove={removeSignature}
                        onSet={setSignature}
                        step={snapStep}
                      />
                    </TimelineMark>
                  ))}
                </TimelineLane>
              </Row>
            </div>
            {tracks.map((track) => (
              <div
                aria-label={track.name}
                className="contents"
                data-track-id={track.id}
                key={track.id}
                role="group"
              >
                <Row
                  className={cn(
                    "border-foreground/25 border-b",
                    heights[track.id] === undefined && "flex-1",
                    // The track being moved stays in place, faded; the line marks the gap it would land in.
                    dragId === track.id && "opacity-50",
                    drop?.id === track.id &&
                      drop.edge === "top" &&
                      "shadow-[inset_0_2px_0_0_var(--primary)]",
                    drop?.id === track.id &&
                      drop.edge === "bottom" &&
                      "shadow-[inset_0_-2px_0_0_var(--primary)]"
                  )}
                  height={heights[track.id]}
                  lead={
                    <div className="flex min-w-0 flex-1">
                      <button
                        aria-label={`Move ${track.name}`}
                        className={cn(
                          "absolute inset-y-0 inset-s-1 z-10 flex w-3 cursor-grab items-center justify-center text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing",
                          dragId === track.id &&
                            "cursor-grabbing bg-muted text-foreground"
                        )}
                        data-track-id={track.id}
                        onKeyDown={nudgeTrack}
                        onPointerDown={startTrackDrag}
                        type="button"
                      >
                        <svg
                          aria-hidden="true"
                          className="size-3.5"
                          fill="currentColor"
                          focusable="false"
                          viewBox="0 0 16 16"
                        >
                          <circle cx="5.5" cy="3.5" r="1.25" />
                          <circle cx="10.5" cy="3.5" r="1.25" />
                          <circle cx="5.5" cy="8" r="1.25" />
                          <circle cx="10.5" cy="8" r="1.25" />
                          <circle cx="5.5" cy="12.5" r="1.25" />
                          <circle cx="10.5" cy="12.5" r="1.25" />
                        </svg>
                      </button>
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
                    </div>
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
                        onSelectionChange={selectTime}
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
                              onAction={handleClipAction}
                              onChange={changeClip}
                              onCommit={commitClip}
                              onFadeShape={setFadeShape}
                              onLift={lift}
                              onRemove={removeClip}
                              onRename={renameClip}
                              onSelect={pickClip}
                              selected={selectedIds.includes(clip.id)}
                              swatch={mixOf(track).color}
                              trackName={track.name}
                            />
                          ))}
                        {timeSelection?.tracks.includes(track.id) ? (
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-y-0 z-10 bg-primary/15 ring-1 ring-primary/40 ring-inset"
                            data-slot="timeline-time-selection"
                            style={{
                              left: `calc(var(--timeline-unit) * ${timeSelection.range[0]})`,
                              width: `calc(var(--timeline-unit) * ${timeSelection.range[1] - timeSelection.range[0]})`,
                            }}
                          />
                        ) : null}
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
              </div>
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
      {clipViewOpen ? (
        <ClipDock
          bar={bar}
          clip={editedClip}
          format={describe}
          onClose={closeClipView}
          onCrop={cropEdited}
          onValueChange={changeClipSettings}
          onValueCommitted={settleClipEdit}
          peaks={editedPeaks}
        />
      ) : null}
      {copy
        ? createPortal(
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none fixed z-50 flex items-center border border-s-4 bg-card px-3 text-sm shadow-lg",
                copy.edge
              )}
              ref={copyRef}
              style={{
                height: copy.height,
                left: copy.left,
                top: copy.top,
                width: copy.width,
              }}
            >
              {copy.name}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
