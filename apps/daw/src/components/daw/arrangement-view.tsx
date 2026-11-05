import {
  barsBeatsWith,
  secondsPerBar,
  secondsPerBeat,
} from "@audio-ui/core/time";
import type { Timeline as TimelinePrimitive } from "@audio-ui/react";
import {
  MapPinPlusIcon,
  MusicNotesPlusIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import {
  type ComponentProps,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrangedClip,
  ArrangedClipGhost,
  ArrangedGroupPreview,
  ArrangedTake,
} from "@/components/audio-ui/arranged-clip";
import { DEVICE_DRAG_TYPE } from "@/components/audio-ui/device-chain";
import { TimelineTimeSelection } from "@/components/audio-ui/time-selection";
import {
  COMPACT_TRACK_HEIGHT,
  MAX_TRACK_HEIGHT,
  MIN_TRACK_HEIGHT,
  Timeline,
  TimelineGridMenuItems,
  TimelineLane,
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
} from "@/components/audio-ui/timeline";
import {
  TimelineBarMarks,
  TimelineLocator,
  TimelineSignature,
} from "@/components/audio-ui/timeline-markers";
import {
  deviceTargets,
  TrackAutomation,
  TrackAutomationChooser,
} from "@/components/audio-ui/track-automation";
import { TrackGrip, TrackReorderGhost } from "@/components/audio-ui/track-grip";
import { TrackLevel } from "@/components/audio-ui/track-level";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useArrangedClips } from "@/hooks/use-arranged-clips";
import type { useArrangement } from "@/hooks/use-arrangement";
import type { useArrangementEngine } from "@/hooks/use-arrangement-engine";
import { useMarquee } from "@/hooks/use-marquee-selection";
import type { useTimeSelection } from "@/hooks/use-time-selection";
import {
  GRID_DIVISION_OPTIONS,
  type useTimelineGrid,
} from "@/hooks/use-timeline-grid";
import type { useTimelineMarkers } from "@/hooks/use-timeline-markers";
import type { useTimelineZoom } from "@/hooks/use-timeline-zoom";
import type { useTrackAutomation } from "@/hooks/use-track-automation";
import {
  type AutomationFollowing,
  useAutomatedMix,
} from "@/hooks/use-track-automation";
import { useTrackReorder } from "@/hooks/use-track-reorder";
import {
  type Arranged,
  type ArrangementTrack,
  DRUM_RACK_DEVICE,
  INSTRUMENT_RACK_DEVICE,
  mixOf,
  type TrackDevice,
} from "@/lib/arrangement";
import { trackBlock, trackDepth } from "@/lib/arrangement-state";
import { NEW_TRACK } from "@/lib/daw/drop";
import { type Recording, sourcePeaks } from "@/lib/daw/recordings";
import { libraryDevice } from "@/lib/device-library";
import { cn } from "@/lib/utils";

type Arrangement = ReturnType<typeof useArrangement>;
type Engine = ReturnType<typeof useArrangementEngine>;

import type { LiveTake } from "./use-take";

/** How wide the column of track headers is, in px. */
const LEAD_PX = 220;

function carriesFiles(event: DragEvent) {
  return Array.from(event.dataTransfer.types).includes("Files");
}

/** Whether a track set by hand is short enough for one row of controls. */
function isShort(height: number | undefined) {
  return height !== undefined && height < COMPACT_TRACK_HEIGHT;
}

/** The add-track button says what a drop on it does, and that it is at it. */
function addTrackLabel(dropping: boolean, reading: ReadingFiles | undefined) {
  if (dropping) {
    return "A track for each";
  }
  return reading ? "Reading…" : "Add track";
}

/** Where a file carried over a lane would land, with the time it would land at. */
function DropLine({
  active,
  ref,
}: {
  active: boolean;
  ref: Ref<HTMLDivElement>;
}) {
  if (!active) {
    return null;
  }
  return (
    <div
      className="pointer-events-none absolute inset-y-0 start-[calc(var(--timeline-unit)*var(--drop-at,0))] z-30 border-primary border-s-2 ps-1 text-primary text-xs tabular-nums"
      data-slot="arrangement-drop-line"
      hidden
      ref={ref}
    />
  );
}

/** A lane fills its row: with a height of its own, however short, and a short track keeps its clips thin, so they fit. */
function laneFit(height: number | undefined) {
  return cn(
    "h-auto flex-1 border-b-0",
    height === undefined ? "min-h-14" : "min-h-0",
    isShort(height) && "**:data-clip-id:inset-y-0.5"
  );
}

/** A track's header, its gain and pan showing where their envelopes stand as the arrangement plays (AUT-006). */
function FollowingControls({
  following,
  track,
  ...props
}: Omit<ComponentProps<typeof TimelineTrackControls>, "mix"> & {
  following: AutomationFollowing;
  track: ArrangementTrack;
}) {
  const mix = useAutomatedMix(track, following);
  return <TimelineTrackControls mix={mix} {...props} />;
}

/** The take recording on a track, if it records one: its sound drawn as it comes, a MIDI track's take bare (REC-011). */
function TrackTake({
  position,
  take,
  track,
}: {
  position: ComponentProps<typeof ArrangedTake>["position"];
  take: LiveTake | null;
  track: ArrangementTrack;
}) {
  if (!take?.tracks.has(track.id)) {
    return null;
  }
  return (
    <ArrangedTake
      from={take.from}
      levels={track.kind === "midi" ? undefined : take.levels}
      name={track.name}
      position={position}
    />
  );
}

/** What a rack is called in the automation chooser, by its kind. */
function rackName(device: TrackDevice) {
  if (device.device === INSTRUMENT_RACK_DEVICE) {
    return "Instrument rack";
  }
  return device.device === DRUM_RACK_DEVICE ? "Drum rack" : "Rack";
}

/** Whether a drag carries a device from the library. */
function carriesDevice(event: DragEvent) {
  return Array.from(event.dataTransfer.types).includes(DEVICE_DRAG_TYPE);
}

/**
 * The markers row's one button: a menu that adds a locator or a time
 * signature at the cursor. It hands the focus back to nothing as it closes,
 * so a new signature keeps it to be typed.
 */
function MarkerMenu({
  onLocator,
  onSignature,
}: {
  onLocator: () => void;
  onSignature: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Add a marker"
            className="size-5"
            size="icon"
            title="Add a marker"
            variant="ghost"
          />
        }
      >
        <PlusIcon aria-hidden="true" className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto" finalFocus={false}>
        <DropdownMenuItem onClick={onLocator}>
          <MapPinPlusIcon aria-hidden="true" />
          Locator
          <DropdownMenuShortcut>M</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSignature}>
          <MusicNotesPlusIcon aria-hidden="true" />
          Time signature
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A row of the arrangement: its header in the sticky column, its lane beside it. */
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
  /** A height set by hand: the row keeps it instead of sharing the room left. */
  height?: number;
  lead: ReactNode;
  onResize?: (trackId: string, height: number | undefined) => void;
  selected?: boolean;
  trackId?: string;
}) {
  const resize = useCallback(
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
      onHeightChange={onResize ? resize : undefined}
      selected={selected}
      step={TRACK_HEIGHT_STEP}
    >
      <TimelineTrackHeader
        className="relative flex items-stretch"
        style={{ width: LEAD_PX }}
      >
        {lead}
      </TimelineTrackHeader>
      <div className="flex flex-1 flex-col">{children}</div>
    </TimelineTrack>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-full items-center px-3 text-muted-foreground text-xs">
      {children}
    </span>
  );
}

/** Files dropped and still being read: where they go, and what to call them. */
export interface ReadingFiles {
  at: number;
  key: number;
  name: string;
  /** The track they land on, or `NEW_TRACK`. */
  track: string;
}

/** What is being read for a track, where it will land: its length is not known yet. */
function ReadingClips({
  reading,
  track,
}: {
  reading: readonly ReadingFiles[];
  track: string;
}) {
  return reading
    .filter((files) => files.track === track)
    .map(({ at, key, name }) => (
      <div
        className="pointer-events-none absolute inset-y-1.5 w-40 truncate rounded-sm border border-primary border-dashed bg-primary/10 px-2 text-primary text-xs motion-safe:animate-pulse"
        data-slot="arrangement-reading"
        key={key}
        role="status"
        style={{ left: `calc(var(--timeline-unit) * ${at})` }}
      >
        Reading {name}…
      </div>
    ));
}

export interface ArrangementViewProps {
  /** The tracks armed to record (REC-001). */
  armed: ReadonlySet<string>;
  arrangement: Arrangement;
  /** Automation mode, and the gains and pans moved by hand. */
  automation: ReturnType<typeof useTrackAutomation>;
  /** Where playback starts: the start marker, in seconds. */
  cursor: number;
  engine: Engine;
  /** The take recording now, drawn on its tracks as it grows (REC-011). */
  liveTake: LiveTake | null;
  /** The locators and the time signatures, with the commands behind them. */
  markers: ReturnType<typeof useTimelineMarkers>;
  /** A double-click on a MIDI lane: an empty clip a bar long, from the bar under the pointer. */
  onAddMidiClip: (track: string, at: number) => void;
  /** An audio or MIDI track's Arm button: `exclusive` disarms the others. */
  onArm: (track: string, exclusive: boolean) => void;
  /** A device of the library dropped on a track (its id), or on the add-track button (`NEW_TRACK`). */
  onDevice: (device: string, track: string) => void;
  /** "Edit" chosen from a clip's menu: the clip is selected, to show it. */
  onEditClip: () => void;
  /** Files dropped on a track (its id), or on the add-track button (`NEW_TRACK`), at a time of the arrangement. */
  onFiles: (files: File[], track: string, at: number) => void;
  /** A click in the ruler or a lane: where to start, and whether to play from there. */
  onSeek: (seconds: number) => void;
  onSelectTrack: (id: string) => void;
  /** Files dropped and still being read. */
  reading: readonly ReadingFiles[];
  recordings: ReadonlyMap<string, Recording>;
  /** The track whose devices the detail view shows. */
  selectedTrack: string | null;
  /** The grid the lanes draw and the clips snap to. */
  timelineGrid: ReturnType<typeof useTimelineGrid>;
  /** The zoom, fitted to the view until it is zoomed. */
  timelineZoom: ReturnType<typeof useTimelineZoom>;
  /** The stretch of time dragged across bare lanes. */
  timeSelection: ReturnType<typeof useTimeSelection>;
  /** The viewport the zoom fits: the one the tracks scroll in. */
  viewportRef: RefObject<HTMLDivElement | null>;
}

/**
 * The arrangement: the loop and the ruler on top, a row per track with its
 * header and its clips, the return tracks, and the row that adds a track,
 * where dropped files each make a track of their own and a dropped device a
 * track for it. Everything here is the registry's timeline, driven by the
 * arrangement's commands.
 */

/** What a row needs of its track: what it is, whether it sounds, whether it takes files, how deep it sits and, a group, the tracks in it. */
function rowOf(
  track: ArrangementTrack,
  tracks: readonly ArrangementTrack[],
  returns: readonly ArrangementTrack[],
  anySolo: boolean
) {
  const mix = mixOf(track);
  const isReturn = returns.includes(track);
  const isGroup = track.kind === "group";
  return {
    depth: trackDepth(tracks, track.id),
    // A group's lane shows what the tracks in it play.
    inside: isGroup ? trackBlock(tracks, track.id).slice(1) : [],
    isGroup,
    isReturn,
    mix,
    silent: mix.muted || (anySolo && !mix.soloed && !isReturn),
    // Files go on audio tracks; a device goes on any track that takes it.
    takesFiles: !isReturn && (track.kind ?? "audio") === "audio",
  };
}

export function ArrangementView({
  armed,
  arrangement,
  automation,
  cursor,
  engine,
  liveTake,
  markers,
  onAddMidiClip,
  onArm,
  onDevice,
  onEditClip,
  onFiles,
  reading,
  onSeek,
  onSelectTrack,
  recordings,
  selectedTrack,
  timelineGrid: grid,
  timelineZoom: view,
  timeSelection,
  viewportRef,
}: ArrangementViewProps) {
  const { dispatch, doc, selectedIds, selectedTracks } = arrangement;
  const {
    clips,
    duration,
    locators,
    loop,
    returns,
    signatures,
    tempo,
    tracks,
  } = doc;
  const { zoom } = view;
  const [dropOn, setDropOn] = useState<string | null>(null);
  const dropLine = useRef<HTMLDivElement>(null);
  const beat = secondsPerBeat(tempo);
  const bar = secondsPerBar(tempo);
  const describe = useCallback(
    (seconds: number) => {
      const { bar: number, beat: at } = barsBeatsWith(
        seconds,
        tempo,
        signatures
      );
      return `Bar ${number}, beat ${at}`;
    },
    [signatures, tempo]
  );

  // Clips snap to the other clips' edges and to the locators, besides the grid.
  const snapPoints = useMemo(
    () => [
      ...clips.flatMap((clip) => [
        clip.value.start,
        clip.value.start + clip.value.length,
      ]),
      ...doc.locators.map((locator) => locator.at),
    ],
    [clips, doc.locators]
  );

  const peaksOf = useCallback(
    (clip: Arranged) => {
      const recording = clip.recording
        ? recordings.get(clip.recording)
        : undefined;
      return recording ? sourcePeaks(clip, recording) : undefined;
    },
    [recordings]
  );
  /** A double-click on bare MIDI lane: an empty clip a bar long there. */
  const doubleClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const { track } = event.currentTarget.dataset;
      if (
        !track ||
        (event.target as HTMLElement).closest(
          "[data-clip-id], [data-slot=automation-envelope]"
        )
      ) {
        return;
      }
      const lane = event.currentTarget.getBoundingClientRect();
      const at = Math.max(0, (event.clientX - lane.left) / zoom);
      onAddMidiClip(
        track,
        Math.min(Math.floor(at / bar) * bar, Math.max(0, duration - bar))
      );
    },
    [bar, duration, onAddMidiClip, zoom]
  );

  // Picking a clip lets go of the time selected, and its menu's Edit shows it in the panel.
  const { clear: letGoOfTime, pressLane, time: selectedTime } = timeSelection;
  const getCursor = useCallback(() => cursor, [cursor]);
  const arrangedClips = useArrangedClips({
    clips,
    copying: arrangement.copying,
    dispatch,
    getPosition: getCursor,
    onEdit: onEditClip,
    onPress: letGoOfTime,
    selectedIds,
    splitStep: beat / 4,
    tracks,
    viewportRef,
  });
  // Shift and a drag across bare lane draws a rectangle: the clips it touches join the selection.
  const selectClips = useCallback(
    (ids: string[]) => dispatch({ ids, type: "select-clips" }),
    [dispatch]
  );
  const marquee = useMarquee(selectedIds as string[], selectClips, false);
  // A track moves by its grip, dragged or with Up and Down on it; a new one goes after the one it is asked from, of its kind.
  const trackOrder = useMemo(() => tracks.map((track) => track.id), [tracks]);
  const moveTrack = useCallback(
    (id: string, index: number) => dispatch({ id, index, type: "move-track" }),
    [dispatch]
  );
  const blockOf = useCallback((id: string) => trackBlock(tracks, id), [tracks]);
  const reorder = useTrackReorder({
    blockOf,
    onMove: moveTrack,
    order: trackOrder,
  });
  const dragged = tracks.find((track) => track.id === reorder.ghost?.id);
  const insertTrack = useCallback(
    (id: string) =>
      dispatch({
        afterId: id,
        kind: tracks.find((track) => track.id === id)?.kind,
        type: "add-track",
      }),
    [dispatch, tracks]
  );
  const settle = useCallback(
    () => dispatch({ type: "settle-clip-edit" }),
    [dispatch]
  );
  const pickTrack = useCallback(
    (id: string, additive: boolean) => {
      dispatch({ additive, id, type: "select-track" });
      onSelectTrack(id);
    },
    [dispatch, onSelectTrack]
  );
  /** A press on a track's bare lane picks the track and lets go of what was selected; the lane puts the cursor there, and a drag from it selects time. */
  const pressBareLane = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const { track } = event.currentTarget.dataset;
      if (track && event.target === event.currentTarget && !event.shiftKey) {
        pressLane(track);
        dispatch({ type: "clear-selection" });
        onSelectTrack(track);
        // The keys now go to the arrangement, not to the control that had them.
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    },
    [dispatch, onSelectTrack, pressLane]
  );
  const renameTrack = useCallback(
    (id: string, name: string) => dispatch({ id, name, type: "rename-track" }),
    [dispatch]
  );
  const removeTrack = useCallback(
    (id: string) => dispatch({ id, type: "remove-track" }),
    [dispatch]
  );
  const duplicateTrack = useCallback(
    (id: string) => dispatch({ id, type: "duplicate-track" }),
    [dispatch]
  );
  // The track, with the tracks picked when it is one of them, into a new group (MIX-020).
  const groupTrack = useCallback(
    (id: string) =>
      dispatch({
        ids: selectedTracks.includes(id) ? selectedTracks : [id],
        type: "group-tracks",
      }),
    [dispatch, selectedTracks]
  );
  const ungroupTrack = useCallback(
    (id: string) => dispatch({ id, type: "ungroup" }),
    [dispatch]
  );
  // What a track's menu has.
  const trackMenu = useMemo(
    () => ({
      onDuplicate: duplicateTrack,
      onGroup: groupTrack,
      onInsert: insertTrack,
    }),
    [duplicateTrack, groupTrack, insertTrack]
  );
  // A group's menu lets its tracks go, too; a return's has none of these.
  const menuOf = useCallback(
    (isReturn: boolean, isGroup: boolean) => {
      if (isReturn) {
        return;
      }
      return isGroup ? { ...trackMenu, onUngroup: ungroupTrack } : trackMenu;
    },
    [trackMenu, ungroupTrack]
  );
  const changeLoop = useCallback(
    (range: TimelinePrimitive.Range.Value) =>
      dispatch({ range, type: "change-loop" }),
    [dispatch]
  );

  /** The time under the pointer in a lane, on the grid when it snaps. */
  const timeAt = useCallback(
    (event: DragEvent<HTMLElement>) => {
      const lane = event.currentTarget.getBoundingClientRect();
      const at = Math.max(0, (event.clientX - lane.left) / zoom);
      return grid.snapStep > 0
        ? Math.round(at / grid.snapStep) * grid.snapStep
        : at;
    },
    [grid.snapStep, zoom]
  );
  // A lane takes a device of the library, and files when `files` (an audio track, or the add-track button).
  const dragOver = useCallback(
    (track: string, files: boolean) => (event: DragEvent<HTMLElement>) => {
      if (carriesDevice(event) || (files && carriesFiles(event))) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDropOn(track);
        // Straight on the line: it moves with the pointer, and nothing else has to draw again.
        const line = dropLine.current;
        if (line && track !== NEW_TRACK && carriesFiles(event)) {
          const time = timeAt(event);
          line.hidden = false;
          line.style.setProperty("--drop-at", String(time));
          line.textContent = describe(time);
        }
      }
    },
    [describe, timeAt]
  );
  const drop = useCallback(
    (track: string, files: boolean) => (event: DragEvent<HTMLElement>) => {
      const device = event.dataTransfer.getData(DEVICE_DRAG_TYPE);
      if (device) {
        event.preventDefault();
        setDropOn(null);
        onDevice(device, track);
      } else if (files && carriesFiles(event)) {
        event.preventDefault();
        setDropOn(null);
        // A track of their own starts at the start: that cell has no time under the pointer.
        onFiles(
          Array.from(event.dataTransfer.files),
          track,
          track === NEW_TRACK ? 0 : timeAt(event)
        );
      }
    },
    [onDevice, onFiles, timeAt]
  );
  const fileLeave = useCallback(() => setDropOn(null), []);
  const addAudio = useCallback(
    () => dispatch({ kind: "audio", type: "add-track" }),
    [dispatch]
  );
  const addMidi = useCallback(
    () => dispatch({ kind: "midi", type: "add-track" }),
    [dispatch]
  );
  const addReturn = useCallback(
    () => dispatch({ kind: "return", type: "add-track" }),
    [dispatch]
  );
  const anySolo = tracks.some((track) => mixOf(track).soloed);
  const readingOwn = reading.find(({ track }) => track === NEW_TRACK);
  const roomLeft = [...arrangement.unfoldedTracks, ...returns].every(
    (track) => arrangement.heights[track.id] !== undefined
  );
  // What each track's envelope can move besides its volume and pan: its devices' parameters (AUT-001).
  const targets = useMemo(
    () =>
      new Map(
        [...tracks, ...returns].map((track) => [
          track.id,
          deviceTargets(track.devices ?? [], libraryDevice, rackName),
        ])
      ),
    [returns, tracks]
  );

  return (
    <Timeline
      className="min-h-0 flex-1"
      duration={duration}
      onPositionChange={onSeek}
      snapPoints={snapPoints}
      snapStep={grid.snapStep}
      source={engine.position}
      {...view.timeline}
    >
      {/* The overview of the whole arrangement, on top as a DAW has it, over the lanes alone. */}
      <div className="flex shrink-0 border-b">
        {/* Takes a device or files dropped on it, a track for each. */}
        <div
          aria-label="New tracks"
          className={cn(
            "flex shrink-0 items-center border-e",
            dropOn === NEW_TRACK && "ring-2 ring-primary ring-inset"
          )}
          data-add-track=""
          onDragLeave={fileLeave}
          onDragOver={dragOver(NEW_TRACK, true)}
          onDrop={drop(NEW_TRACK, true)}
          role="group"
          style={{ width: LEAD_PX }}
        >
          {/* One button for every kind of track, each with its keys (KEY-006 to KEY-008). */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  className="min-w-0 flex-1 justify-start gap-1.5 rounded-none px-3 font-normal"
                  size="xs"
                  variant="ghost"
                />
              }
            >
              <PlusIcon aria-hidden="true" />
              {addTrackLabel(dropOn === NEW_TRACK, readingOwn)}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={addAudio}>
                Audio track
                <DropdownMenuShortcut>Ctrl T</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={addMidi}>
                MIDI track
                <DropdownMenuShortcut>Ctrl Shift T</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={addReturn}>
                Return track
                <DropdownMenuShortcut>Cmd Option T</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <TimelineNavigator
          className="h-auto min-w-0 flex-1 rounded-none"
          getAriaValueText={describe}
        />
      </div>
      <TimelineViewport
        className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-muted/30"
        ref={viewportRef}
        scrollbar="hidden"
      >
        <div
          className={cn(
            "flex min-h-full w-max min-w-full shrink-0 flex-col",
            marquee.rect && "select-none"
          )}
          {...marquee.handlers}
        >
          <div className="sticky top-0 z-40 flex min-w-full shrink-0 flex-col bg-background">
            <Row
              className="shrink-0 border-foreground/20 border-b"
              lead={<Label>Loop</Label>}
            >
              <TimelineLane className="h-6 cursor-cell border-b-0">
                <TimelineRange
                  aria-label="Loop"
                  drawable
                  getAriaValueText={describe}
                  onValueChange={changeLoop}
                  onValueCommitted={settle}
                  value={loop.range}
                >
                  <TimelineRangeHandle aria-label="Loop start" edge="start" />
                  <TimelineRangeHandle aria-label="Loop end" edge="end" />
                </TimelineRange>
                <TimelinePlayhead />
              </TimelineLane>
            </Row>
            <Row
              className="shrink-0 border-foreground/20 border-b"
              lead={
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        aria-label="Grid"
                        className="h-full w-full justify-start rounded-none border-0 px-3 font-normal text-muted-foreground text-xs tabular-nums"
                        variant="ghost"
                      />
                    }
                  >
                    {grid.label}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <TimelineGridMenuItems
                      division={grid.division}
                      divisions={GRID_DIVISION_OPTIONS}
                      onDivisionChange={grid.chooseDivision}
                      onSnapChange={grid.setSnap}
                      onTripletChange={grid.setTriplet}
                      snap={grid.snap}
                      triplet={grid.triplet}
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
                <TimelineBarMarks
                  duration={duration}
                  signatures={signatures}
                  tempo={tempo}
                  zoom={zoom}
                />
                <TimelinePlayhead />
              </TimelineRuler>
            </Row>
            {/* The locators and the time signatures share one lane, so the tracks keep the room on a short screen. */}
            <Row
              className="shrink-0 border-foreground/20 border-b"
              lead={
                <span className="flex h-full w-full items-center justify-between ps-3 pe-1 text-muted-foreground text-xs">
                  Markers
                  <MarkerMenu
                    onLocator={markers.addLocator}
                    onSignature={markers.addSignature}
                  />
                </span>
              }
            >
              <TimelineLane className="h-6 border-b-0">
                {signatures.map((change) => (
                  <TimelineSignature
                    change={change}
                    editing={markers.editingSignature === change.id}
                    key={change.id}
                    {...markers.signature}
                  />
                ))}
                {locators.map((locator) => (
                  <TimelineLocator
                    key={locator.id}
                    locator={locator}
                    {...markers.locator}
                  />
                ))}
              </TimelineLane>
            </Row>
          </div>
          {[...arrangement.unfoldedTracks, ...returns].map((track) => {
            const {
              depth,
              inside,
              isGroup,
              isReturn,
              mix,
              silent,
              takesFiles,
            } = rowOf(track, tracks, returns, anySolo);
            const height = arrangement.heights[track.id];
            return (
              <div
                aria-label={track.name}
                className="contents"
                data-track-id={track.id}
                key={track.id}
                role="group"
              >
                <Row
                  className={cn(
                    "border-foreground/20 border-b",
                    height === undefined && "flex-1",
                    isReturn && "bg-muted/40"
                  )}
                  height={height}
                  lead={
                    <div
                      className="flex min-w-0 flex-1"
                      data-depth={depth}
                      style={{ paddingInlineStart: `${depth * 0.75}rem` }}
                    >
                      {isReturn ? null : (
                        <TrackGrip
                          dragging={reorder.draggingId === track.id}
                          trackName={track.name}
                          {...reorder.gripProps(track.id)}
                        />
                      )}
                      <FollowingControls
                        armed={armed.has(track.id)}
                        compact={isShort(height)}
                        folded={arrangement.folded[track.id]}
                        following={{
                          duration,
                          overridden: automation.overridden[track.id],
                          position: engine.position,
                        }}
                        meter={
                          <TrackLevel
                            analysers={engine.meter(track.id)}
                            name={track.name}
                          />
                        }
                        name={track.name}
                        onArm={isGroup || isReturn ? undefined : onArm}
                        onMix={automation.changeMix}
                        onMixCommit={settle}
                        onRemove={removeTrack}
                        onRename={renameTrack}
                        onSelect={pickTrack}
                        onToggleFold={arrangement.toggleFold}
                        selected={
                          selectedTracks.includes(track.id) ||
                          selectedTrack === track.id
                        }
                        track={track}
                        trackId={track.id}
                        {...menuOf(isReturn, isGroup)}
                      >
                        {automation.automating ? (
                          <TrackAutomationChooser
                            onClear={automation.clear}
                            onParameterChange={automation.show}
                            parameter={automation.parameterOf(track.id)}
                            targets={targets.get(track.id)}
                            track={track}
                          />
                        ) : null}
                      </FollowingControls>
                    </div>
                  }
                  onResize={arrangement.resizeTrack}
                  selected={selectedTracks.includes(track.id)}
                  trackId={track.id}
                >
                  <ContextMenu>
                    <ContextMenuTrigger render={<div className="contents" />}>
                      <TimelineLane
                        className={cn(
                          laneFit(height),
                          dropOn === track.id &&
                            "ring-2 ring-primary ring-inset",
                          silent && "**:data-clip-id:opacity-40"
                        )}
                        data-track={track.id}
                        gridStep={grid.snapStep}
                        onDoubleClick={
                          track.kind === "midi" ? doubleClick : undefined
                        }
                        onDragLeave={fileLeave}
                        onDragOver={dragOver(track.id, takesFiles)}
                        onDrop={drop(track.id, takesFiles)}
                        onPointerDown={pressBareLane}
                        onSelectionChange={timeSelection.onSelectionChange}
                        seekable
                      >
                        <DropLine active={dropOn === track.id} ref={dropLine} />
                        <ReadingClips reading={reading} track={track.id} />
                        {isGroup ? (
                          <ArrangedGroupPreview
                            clips={clips.filter((clip) =>
                              inside.includes(clip.track)
                            )}
                          />
                        ) : null}
                        {arrangedClips.ghostsOn(track.id).map((original) => (
                          <ArrangedClipGhost
                            clip={original}
                            key={original.id}
                          />
                        ))}
                        {clips
                          .filter((clip) => clip.track === track.id)
                          .map((clip) => (
                            <ArrangedClip
                              describe={describe}
                              key={clip.id}
                              peaks={peaksOf(clip)}
                              swatch={mix.color}
                              trackName={track.name}
                              {...arrangedClips.clipProps(clip)}
                            />
                          ))}
                        <TrackTake
                          position={engine.position}
                          take={liveTake}
                          track={track}
                        />
                        {selectedTime?.tracks.includes(track.id) ? (
                          <TimelineTimeSelection range={selectedTime.range} />
                        ) : null}
                        {automation.automating ? (
                          <TrackAutomation
                            describe={describe}
                            duration={duration}
                            mix={mix}
                            onChange={automation.edit}
                            onCommit={settle}
                            overridden={automation.overridden[track.id]}
                            parameter={automation.parameterOf(track.id)}
                            snapStep={grid.snapStep}
                            targets={targets.get(track.id)}
                            track={track}
                          />
                        ) : null}
                        <TimelinePlayhead />
                      </TimelineLane>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-auto min-w-48">
                      <TimelineGridMenuItems
                        division={grid.division}
                        divisions={GRID_DIVISION_OPTIONS}
                        onDivisionChange={grid.chooseDivision}
                        onSnapChange={grid.setSnap}
                        onTripletChange={grid.setTriplet}
                        snap={grid.snap}
                        triplet={grid.triplet}
                      />
                    </ContextMenuContent>
                  </ContextMenu>
                </Row>
              </div>
            );
          })}
          {/* Under the last track, always: it takes files and devices, a track for each. */}
          <div
            aria-label="Room for new tracks"
            className={cn(
              "flex min-h-14 items-center text-muted-foreground text-xs",
              roomLeft ? "flex-1" : "shrink-0",
              dropOn === NEW_TRACK && "ring-2 ring-primary ring-inset"
            )}
            data-slot="arrangement-drop"
            onDragLeave={fileLeave}
            onDragOver={dragOver(NEW_TRACK, true)}
            onDrop={drop(NEW_TRACK, true)}
            role="group"
          >
            {readingOwn ? (
              <span
                className="sticky left-3 px-3 text-primary motion-safe:animate-pulse"
                data-slot="arrangement-reading"
                role="status"
              >
                Reading {readingOwn.name}…
              </span>
            ) : (
              <span className="sticky left-3 px-3">
                Drop audio files or a device here
              </span>
            )}
          </div>
        </div>
      </TimelineViewport>
      {marquee.rect
        ? createPortal(
            <div
              aria-hidden="true"
              className="pointer-events-none fixed z-50 border border-primary bg-primary/10"
              data-slot="timeline-marquee"
              style={marquee.rect}
            />,
            document.body
          )
        : null}
      <TrackReorderGhost
        className={
          dragged ? TRACK_COLORS[mixOf(dragged).color]?.edge : undefined
        }
        ghost={reorder.ghost}
        ghostRef={reorder.ghostRef}
        trackName={dragged?.name}
      />
    </Timeline>
  );
}
