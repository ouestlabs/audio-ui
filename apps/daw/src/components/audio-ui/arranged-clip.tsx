"use client";

import type {
  FadeShape,
  Source,
  Timeline as TimelinePrimitive,
} from "@audio-ui/react";
import {
  type FocusEvent,
  Fragment,
  type KeyboardEvent,
  type MouseEvent,
  memo,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  TimelineClip,
  TimelineClipFade,
  TimelineClipFadeHandle,
  TimelineClipHandle,
  TimelineClipHeader,
  TRACK_COLORS,
} from "@/components/audio-ui/timeline";
import {
  type Arranged,
  type ClipAction,
  clipReach,
  clipWaveform,
  playedNotes,
} from "@/lib/arrangement";

/** A clip's menu: what is done to it, then what is done away with. */
function menuEntries(disabled: boolean): {
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
function RenameField({
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

/** A MIDI clip's notes in miniature across its body: where they play in it, between its lowest and highest pitch. */
function ClipNotes({ clip }: { clip: Arranged }) {
  const notes = useMemo(() => playedNotes(clip), [clip]);
  if (notes.length === 0) {
    return null;
  }
  const pitches = notes.map((note) => note.pitch);
  const high = Math.max(...pitches) + 1;
  const rows = high - Math.min(...pitches) + 2;
  const { length, start } = clip.value;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-5 bottom-1"
      data-slot="timeline-clip-notes"
    >
      {notes.map((note) => (
        <span
          className="absolute min-h-0.5 rounded-[1px] bg-current opacity-70"
          key={note.id}
          style={{
            height: `${100 / rows}%`,
            left: `${((note.start - start) / length) * 100}%`,
            top: `${((high - note.pitch) / rows) * 100}%`,
            width: `${(note.length / length) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * How far past each side of what shows an audio clip's waveform is drawn, in
 * px: a scroll finds it drawn, and draws it again only once past half of this.
 */
const WAVEFORM_OVERSCAN = 512;
const THEME_ATTRIBUTES = ["class", "data-theme", "style"];

/**
 * Paints a clip's waveform on its canvas, a column per pixel of the screen, for
 * the stretch of the clip the view shows: however wide the zoom makes the clip,
 * the canvas stays the size of the view, and a clip out of view paints nothing.
 */
function paintWaveform(
  canvas: HTMLCanvasElement,
  clip: Arranged,
  peaks: ArrayLike<number>,
  view: HTMLElement | null
) {
  const box = canvas.parentElement?.getBoundingClientRect();
  const context = canvas.getContext("2d");
  if (!(box && context)) {
    return;
  }
  const sees =
    view?.getBoundingClientRect() ??
    new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  const from = Math.max(0, sees.left - box.left - WAVEFORM_OVERSCAN);
  const to = Math.min(box.width, sees.right - box.left + WAVEFORM_OVERSCAN);
  if (
    to <= from ||
    box.bottom < sees.top - WAVEFORM_OVERSCAN ||
    box.top > sees.bottom + WAVEFORM_OVERSCAN
  ) {
    canvas.style.display = "none";
    canvas.width = 0;
    return;
  }
  canvas.style.display = "";
  canvas.style.left = `${from}px`;
  canvas.style.width = `${to - from}px`;
  const scale = window.devicePixelRatio || 1;
  const columns = Math.round((to - from) * scale);
  const rows = Math.round(canvas.clientHeight * scale);
  canvas.width = columns;
  canvas.height = rows;
  context.fillStyle = getComputedStyle(canvas).color;
  const { length } = clip.value;
  const middle = rows / 2;
  const levels = clipWaveform(clip, peaks, columns, [
    (from / box.width) * length,
    (to / box.width) * length,
  ]);
  for (const [column, level] of levels.entries()) {
    const half = Math.max(0.5, level * middle);
    context.fillRect(column, middle - half, 1, half * 2);
  }
}

/** An audio clip's recording across its body: what it plays, as `clipWaveform` reads it, as sharp at any zoom. */
function ClipWaveform({
  clip,
  peaks,
}: {
  clip: Arranged;
  peaks: ArrayLike<number>;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    const body = canvas?.parentElement;
    if (!(canvas && body)) {
      return;
    }
    const view = canvas.closest<HTMLElement>('[data-slot="timeline-viewport"]');
    let drawnLeft = 0;
    let drawnTop = 0;
    let frame = 0;
    const draw = () => {
      frame = 0;
      drawnLeft = view?.scrollLeft ?? 0;
      drawnTop = view?.scrollTop ?? 0;
      paintWaveform(canvas, clip, peaks, view);
    };
    const later = () => {
      frame ||= requestAnimationFrame(draw);
    };
    const scrolled = () => {
      if (
        view &&
        Math.max(
          Math.abs(view.scrollLeft - drawnLeft),
          Math.abs(view.scrollTop - drawnTop)
        ) >
          WAVEFORM_OVERSCAN / 2
      ) {
        later();
      }
    };
    draw();
    // Called between the layout and the paint: a zoom shows the clip and its waveform at the same width.
    let first = true;
    const resized = new ResizeObserver(() => {
      if (!first) {
        draw();
      }
      first = false;
    });
    resized.observe(body);
    if (view) {
      resized.observe(view);
    }
    view?.addEventListener("scroll", scrolled, { passive: true });
    const themed = new MutationObserver(later);
    themed.observe(document.documentElement, {
      attributeFilter: THEME_ATTRIBUTES,
    });
    return () => {
      cancelAnimationFrame(frame);
      resized.disconnect();
      themed.disconnect();
      view?.removeEventListener("scroll", scrolled);
    };
  }, [clip, peaks]);
  return (
    <canvas
      className="pointer-events-none absolute top-5 bottom-1 h-[calc(100%-1.5rem)] opacity-70"
      data-slot="timeline-clip-waveform"
      ref={ref}
    />
  );
}

/** The original of a clip being copied, left in its place while the copy is dragged away. */
function ArrangedClipGhost({ clip }: { clip: Arranged }) {
  const { length, start } = clip.value;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-1.5 overflow-hidden rounded-[inherit] border border-primary border-dashed bg-primary/10 px-2 text-primary text-xs"
      data-slot="arranged-clip-ghost"
      style={{
        left: `calc(var(--timeline-unit) * ${start})`,
        width: `calc(var(--timeline-unit) * ${length})`,
      }}
    >
      {clip.name}
    </div>
  );
}

/** The path of a take's levels, a line per level from the middle, `count` wide and 100 tall. */
function levelsPath(levels: readonly number[]) {
  return levels
    .map((level, index) => {
      const half = Math.max(0.5, Math.min(1, level) * 50);
      return `M${index + 0.5} ${50 - half}V${50 + half}`;
    })
    .join("");
}

/**
 * A take as it records, on its track: from where it started to where
 * playback is now, red, with what came in drawn as it comes. It follows
 * `position` and `levels` in the DOM, without rendering React each frame.
 */
function ArrangedTake({
  from,
  levels,
  name,
  position,
}: {
  /** Where the take started, in the timeline's units. */
  from: number;
  /** The loudest of each equal stretch of the take so far, from its start, 0…1: a live list. Leave it out for a take of notes. */
  levels?: Source<readonly number[]>;
  name: string;
  /** Where playback is, in the timeline's units: the take's end, live. */
  position: Source<number>;
}) {
  const body = useRef<HTMLDivElement>(null);
  const path = useRef<SVGPathElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const follow = () => {
      const length = Math.max(0, position.getSnapshot() - from);
      body.current?.style.setProperty(
        "width",
        `calc(var(--timeline-unit) * ${length})`
      );
    };
    follow();
    return position.subscribe(follow);
  }, [from, position]);
  useEffect(() => {
    if (!levels) {
      return;
    }
    const draw = () => {
      const list = levels.getSnapshot();
      svg.current?.setAttribute(
        "viewBox",
        `0 0 ${Math.max(1, list.length)} 100`
      );
      path.current?.setAttribute("d", levelsPath(list));
    };
    draw();
    return levels.subscribe(draw);
  }, [levels]);
  return (
    <div
      aria-label={`Recording on ${name}`}
      className="pointer-events-none absolute inset-y-1.5 overflow-hidden rounded-[inherit] border border-destructive bg-destructive/15 text-destructive"
      data-slot="arranged-take"
      ref={body}
      role="status"
      style={{ left: `calc(var(--timeline-unit) * ${from})`, width: 0 }}
    >
      <span className="absolute inset-x-2 top-0.5 truncate text-xs">
        {name}
      </span>
      {levels ? (
        <svg
          aria-hidden="true"
          className="absolute inset-x-0 top-5 bottom-1 h-[calc(100%-1.5rem)] w-full"
          preserveAspectRatio="none"
          ref={svg}
          viewBox="0 0 1 100"
        >
          <path
            fill="none"
            ref={path}
            stroke="currentColor"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}
    </div>
  );
}

/**
 * What a group's tracks play, drawn on the group's lane as one thin bar per
 * clip: it shows where they play even while the group is folded, and does
 * nothing when pressed.
 */
function ArrangedGroupPreview({ clips }: { clips: readonly Arranged[] }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      data-slot="arranged-group-preview"
    >
      {clips.map((clip) => (
        <div
          className="absolute inset-y-2 rounded-sm bg-foreground/15 data-disabled:bg-foreground/5"
          data-disabled={clip.disabled ? "" : undefined}
          key={clip.id}
          style={{
            left: `calc(var(--timeline-unit) * ${clip.value.start})`,
            width: `calc(var(--timeline-unit) * ${clip.value.length})`,
          }}
        />
      ))}
    </div>
  );
}

interface ArrangedClipProps {
  clip: Arranged;
  /** Whether this clip is being dragged with Alt held: it is the copy, and the original stays behind. */
  copying?: boolean;
  /** A time of the arrangement in words, such as "Bar 3, beat 2", for the clip's value text. */
  describe: (seconds: number) => string;
  /** How far, in px, the clip is held up or down by a group drag that is not its own. */
  lift?: number;
  /** Whether a press adds the clip to the selection, as Shift does: a touch screen has no Shift. */
  multi?: boolean;
  /** Something chosen from the clip's menu (renaming is the clip's own). */
  onAction: (action: ClipAction, id: string) => void;
  onChange: (
    id: string,
    value: TimelinePrimitive.Clip.Value,
    details: TimelinePrimitive.Clip.ChangeEventDetails
  ) => void;
  onCommit: (
    id: string,
    details: TimelinePrimitive.Clip.CommitEventDetails
  ) => void;
  /** A fade's curve was picked from the menu of its handle. */
  onFadeShape: (id: string, edge: "in" | "out", shape: FadeShape) => void;
  /** Tells the arrangement how far this clip is dragged up or down, for the rest of its group to follow. */
  onLift?: (id: string, offset: number) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onSelect: (id: string, additive: boolean) => void;
  /** An audio clip's source as peaks from 0 to 1, spread evenly over its `sourceLength`: its waveform is drawn from them. */
  peaks?: ArrayLike<number>;
  selected: boolean;
  /** The clip's color, an index into `TRACK_COLORS`: its track's. */
  swatch: number;
  trackName: string;
}

const NO_LIFT = () => undefined;

/**
 * A clip of an arrangement, on its track's lane: move it, trim either edge
 * into its source, fade it in and out, and pick a fade's curve; double-click
 * its title to rename it, and right-click it for its menu. A MIDI clip draws
 * its notes across its body.
 */
const ArrangedClip = memo(function ArrangedClipView({
  clip,
  copying = false,
  describe,
  lift = 0,
  multi = false,
  onAction,
  onChange,
  onCommit,
  onFadeShape,
  onLift = NO_LIFT,
  onRemove,
  onRename,
  onSelect,
  peaks,
  selected,
  swatch,
  trackName,
}: ArrangedClipProps) {
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
          // The clip's reach: the timeline reads it as how long the source is.
          sourceLength={clipReach(clip)}
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
              <RenameField
                name={clip.name}
                onCommit={handleRename}
                onDone={stopRenaming}
              />
            ) : (
              <span>{copying ? `+ ${clip.name}` : clip.name}</span>
            )}
          </TimelineClipHeader>
          {clip.notes ? <ClipNotes clip={clip} /> : null}
          {!clip.notes && peaks && peaks.length > 0 ? (
            <ClipWaveform clip={clip} peaks={peaks} />
          ) : null}
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
        {menuEntries(Boolean(clip.disabled)).map((entry) => (
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

export { ArrangedClip, ArrangedClipGhost, ArrangedGroupPreview, ArrangedTake };