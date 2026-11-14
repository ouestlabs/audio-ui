import { dbToGain } from "@audio-ui/engine/analysis";
import { hasWebGL2 } from "@audio-ui/gl/lane";
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
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/registry/bases/base/ui/context-menu";
import {
  type ClipSamples,
  ClipWaveform,
} from "@/registry-audio/bases/base/audio/elements/clip-waveform";
import {
  TimelineClip,
  TimelineClipFade,
  TimelineClipFadeHandle,
  TimelineClipHandle,
  TimelineClipHeader,
  trackSwatch,
} from "@/registry-audio/bases/base/audio/elements/timeline";
import { WaveformLane } from "@/registry-audio/bases/base/audio/elements/waveform-lane";
import {
  type Arranged,
  type ClipAction,
  type ClipPeaks,
  clipPeakCount,
  clipReach,
  clipSegments,
  playedNotes,
  type TrackColor,
} from "@/registry-audio/bases/base/lib/arrangement";

/** Where a fade is drawn: over the body, under the title bar, as the waveform is. */
const UNDER_HEAD = { height: "calc(100% - 1.25rem)", top: "1.25rem" };

/** A clip's menu: what is done to it, then what is done away with, each with the key the timeline runs it with. */
function menuEntries(disabled: boolean): {
  action: ClipAction;
  destructive?: boolean;
  label: string;
  separatorBefore?: boolean;
  shortcut?: string;
}[] {
  return [
    { action: "edit", label: "Edit clip" },
    { action: "rename", label: "Rename" },
    { action: "duplicate", label: "Duplicate", shortcut: "⌘D" },
    {
      action: "split",
      label: "Split at the cursor",
      separatorBefore: true,
      shortcut: "⌘E",
    },
    {
      action: "toggle",
      label: disabled ? "Switch clip on" : "Switch clip off",
      shortcut: "0",
    },
    {
      action: "remove",
      destructive: true,
      label: "Delete",
      separatorBefore: true,
      shortcut: "⌫",
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
  /** An audio clip's source as peaks spread evenly over its `sourceLength`, amplitudes from 0 to 1 or the lowest and highest samples of each slice: its waveform is drawn from them. */
  peaks?: ClipPeaks;
  selected: boolean;
  /** An audio clip's recording, to draw its waveform on the GPU where WebGL 2 is: every pixel column its exact lowest and highest sample, a row a channel on a tall track, at any zoom. Leave it out to draw from `peaks`, as a reversed clip is. */
  source?: ArrangedSource;
  /** The clip's color: its track's, an index into `TRACK_COLORS` or a color of the user's own. */
  swatch: TrackColor;
  trackName: string;
}

/** A clip's recording, read by its waveform on the GPU: its samples mixed to one, its channels a reader each, and its rate. */
interface ArrangedSource {
  channels?: readonly ClipSamples[];
  sampleRate: number;
  samples: ClipSamples;
}

/** Whether this browser draws with WebGL 2, asked once. */
let webgl: boolean | null = null;
const drawsOnGpu = () => {
  webgl ??= hasWebGL2();
  return webgl;
};

/** Whether the GPU draws a recording without reading it whole: held in memory, or streamed with its leaves. */
const drawable = (samples: ClipSamples) =>
  Boolean(samples.leaves) || !(samples.read(0, 0) instanceof Promise);

/**
 * An audio clip's waveform, under its title: on the GPU from its recording
 * where it can be, one lane a clip on the page's one WebGL context, read in
 * the stretches the clip plays from where it begins in the recording; else
 * from its peaks, as a reversed clip, which reads backwards, is.
 */
function ArrangedWaveform({
  clip,
  peaks,
  source,
}: {
  clip: Arranged;
  peaks?: ClipPeaks;
  source?: ArrangedSource;
}) {
  const gpu =
    source && !clip.reversed && drawable(source.samples) && drawsOnGpu()
      ? source
      : null;
  const clips = useMemo(() => {
    if (!gpu) {
      return null;
    }
    const { channels, sampleRate, samples } = gpu;
    // Its source begins where it was cropped from in the recording: the stretches read from there.
    const from = (clip.sourceFrom ?? 0) * sampleRate;
    const frames = Math.round(clip.sourceLength * sampleRate);
    return [
      {
        channels,
        gain: dbToGain(clip.gain ?? 0),
        id: clip.id,
        length: clip.value.length,
        sampleRate,
        samples,
        segments: (start: number, end: number) =>
          clipSegments(clip, frames, [start, end]).map((segment) => ({
            ...segment,
            frames: [segment.frames[0] + from, segment.frames[1] + from] as [
              number,
              number,
            ],
          })),
        source: clip.recording ?? clip.id,
        start: 0,
      },
    ];
  }, [clip, gpu]);
  if (clips) {
    return (
      <WaveformLane
        className="top-5 bottom-1 h-[calc(100%-1.5rem)] opacity-70"
        clips={clips}
        shared
      />
    );
  }
  return peaks && clipPeakCount(peaks) > 0 ? (
    <ClipWaveform
      className="top-5 bottom-1 h-[calc(100%-1.5rem)] opacity-70"
      clip={clip}
      peaks={peaks}
    />
  ) : null;
}

const NO_LIFT = () => undefined;

/**
 * A clip of an arrangement, on its track's lane: move it, trim either edge
 * into its source, fade it in and out, and pick a fade's curve; double-click
 * its title to rename it, and right-click it for its menu. A MIDI clip draws
 * its notes across its body and has no fades: they shape a recording's sound,
 * and its notes play whole.
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
  source,
  swatch,
  trackName,
}: ArrangedClipProps) {
  const paint = trackSwatch(swatch);
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
            paint.clip,
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
              ? {
                  ...paint.style,
                  transform: `translateY(${lift}px)`,
                  zIndex: 10,
                }
              : paint.style
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
          {clip.notes ? null : (
            <ArrangedWaveform clip={clip} peaks={peaks} source={source} />
          )}
          {clip.notes ? null : (
            <>
              <TimelineClipFade edge="in" style={UNDER_HEAD} />
              <TimelineClipFade edge="out" style={UNDER_HEAD} />
            </>
          )}
          <TimelineClipHandle aria-label={`${clip.name} start`} edge="start" />
          <TimelineClipHandle aria-label={`${clip.name} end`} edge="end" />
          {clip.notes ? null : (
            <>
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
            </>
          )}
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
              {entry.shortcut ? (
                <ContextMenuShortcut>{entry.shortcut}</ContextMenuShortcut>
              ) : null}
            </ContextMenuItem>
          </Fragment>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
});

export type { ArrangedSource };
export { ArrangedClip, ArrangedClipGhost, ArrangedGroupPreview, ArrangedTake };
