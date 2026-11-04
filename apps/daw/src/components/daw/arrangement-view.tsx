import {
  barsBeatsWith,
  secondsPerBar,
  secondsPerBeat,
} from "@audio-ui/core/time";
import type { Timeline as TimelinePrimitive } from "@audio-ui/react";
import { PlusIcon } from "@phosphor-icons/react";
import {
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrangedClip,
  ArrangedClipGhost,
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
  TrackAutomation,
  TrackAutomationChooser,
} from "@/components/audio-ui/track-automation";
import {
  TrackGrip,
  TrackReorderGhost,
  trackReorderClass,
} from "@/components/audio-ui/track-grip";
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
import { useTrackReorder } from "@/hooks/use-track-reorder";
import { type Arranged, mixOf } from "@/lib/arrangement";
import { NEW_TRACK } from "@/lib/daw/drop";
import { type Recording, sourcePeaks } from "@/lib/daw/recordings";
import { cn } from "@/lib/utils";

type Arrangement = ReturnType<typeof useArrangement>;
type Engine = ReturnType<typeof useArrangementEngine>;

/** How wide the column of track headers is, in px. */
const LEAD_PX = 220;

function carriesFiles(event: DragEvent) {
  return Array.from(event.dataTransfer.types).includes("Files");
}

/** Whether a track set by hand is short enough for one row of controls. */
function isShort(height: number | undefined) {
  return height !== undefined && height < COMPACT_TRACK_HEIGHT;
}

/** Whether a drag carries a device from the library. */
function carriesDevice(event: DragEvent) {
  return Array.from(event.dataTransfer.types).includes(DEVICE_DRAG_TYPE);
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

export interface ArrangementViewProps {
  arrangement: Arrangement;
  /** Automation mode, and the gains and pans moved by hand. */
  automation: ReturnType<typeof useTrackAutomation>;
  /** Where playback starts: the start marker, in seconds. */
  cursor: number;
  engine: Engine;
  /** The locators and the time signatures, with the commands behind them. */
  markers: ReturnType<typeof useTimelineMarkers>;
  /** A double-click on a MIDI lane: an empty clip a bar long, from the bar under the pointer. */
  onAddMidiClip: (track: string, at: number) => void;
  /** A device of the library dropped on a track (its id), or on the add-track row (`NEW_TRACK`). */
  onDevice: (device: string, track: string) => void;
  /** "Edit" chosen from a clip's menu: the clip is selected, to show it. */
  onEditClip: () => void;
  /** Files dropped on a track (its id), or on the add-track row (`NEW_TRACK`), at a time of the arrangement. */
  onFiles: (files: File[], track: string, at: number) => void;
  /** A click in the ruler or a lane: where to start, and whether to play from there. */
  onSeek: (seconds: number) => void;
  onSelectTrack: (id: string) => void;
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
export function ArrangementView({
  arrangement,
  automation,
  cursor,
  engine,
  markers,
  onAddMidiClip,
  onDevice,
  onEditClip,
  onFiles,
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
  const reorder = useTrackReorder({ onMove: moveTrack, order: trackOrder });
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
  // What a track's menu has and a return's has not.
  const trackMenu = useMemo(
    () => ({ onDuplicate: duplicateTrack, onInsert: insertTrack }),
    [duplicateTrack, insertTrack]
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
  // A lane takes a device of the library, and files when `files` (an audio track, or the add-track row).
  const dragOver = useCallback(
    (track: string, files: boolean) => (event: DragEvent<HTMLElement>) => {
      if (carriesDevice(event) || (files && carriesFiles(event))) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDropOn(track);
      }
    },
    []
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
        onFiles(Array.from(event.dataTransfer.files), track, timeAt(event));
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
      <div
        className="shrink-0 border-b px-1 py-1"
        style={{ paddingInlineStart: LEAD_PX }}
      >
        <TimelineNavigator getAriaValueText={describe} />
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
            <Row
              className="shrink-0 border-foreground/20 border-b"
              lead={
                <span className="flex h-full w-full items-center justify-between ps-3 pe-1 text-muted-foreground text-xs">
                  Locators
                  <Button
                    aria-label="Add a locator at the cursor (M)"
                    className="size-5"
                    onClick={markers.addLocator}
                    size="icon"
                    title="Add a locator at the cursor (M)"
                    variant="ghost"
                  >
                    <PlusIcon aria-hidden="true" className="size-3" />
                  </Button>
                </span>
              }
            >
              <TimelineLane className="h-6 border-b-0">
                {locators.map((locator) => (
                  <TimelineLocator
                    key={locator.id}
                    locator={locator}
                    {...markers.locator}
                  />
                ))}
              </TimelineLane>
            </Row>
            <Row
              className="shrink-0 border-foreground/20 border-b"
              lead={
                <span className="flex h-full w-full items-center justify-between ps-3 pe-1 text-muted-foreground text-xs">
                  Signature
                  <Button
                    aria-label="Add a time signature at the cursor"
                    className="size-5"
                    onClick={markers.addSignature}
                    size="icon"
                    title="Add a time signature at the cursor"
                    variant="ghost"
                  >
                    <PlusIcon aria-hidden="true" className="size-3" />
                  </Button>
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
              </TimelineLane>
            </Row>
          </div>
          {[...tracks, ...returns].map((track) => {
            const mix = mixOf(track);
            const isReturn = returns.includes(track);
            const silent = mix.muted || (anySolo && !mix.soloed && !isReturn);
            const height = arrangement.heights[track.id];
            // Files go on audio tracks; a device goes on any track that takes it.
            const takesFiles = !isReturn && track.kind !== "midi";
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
                    isReturn && "bg-muted/40",
                    trackReorderClass(reorder, track.id)
                  )}
                  height={height}
                  lead={
                    <div className="flex min-w-0 flex-1">
                      {isReturn ? null : (
                        <TrackGrip
                          dragging={reorder.draggingId === track.id}
                          trackName={track.name}
                          {...reorder.gripProps(track.id)}
                        />
                      )}
                      <TimelineTrackControls
                        compact={isShort(height)}
                        folded={arrangement.folded[track.id]}
                        mix={mix}
                        name={track.name}
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
                        trackId={track.id}
                        {...(isReturn ? undefined : trackMenu)}
                      >
                        {automation.automating ? (
                          <TrackAutomationChooser
                            onClear={automation.clear}
                            onParameterChange={automation.show}
                            parameter={automation.parameterOf(track.id)}
                            track={track}
                          />
                        ) : null}
                      </TimelineTrackControls>
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
                          "h-auto min-h-14 flex-1 border-b-0",
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
          <Row
            className={cn(
              "sticky bottom-0 z-30 bg-background",
              dropOn === NEW_TRACK && "ring-2 ring-primary ring-inset"
            )}
            lead={
              <div className="m-1 flex min-w-0 flex-1">
                {/* One button for every kind of track, each with its keys (KEY-006 to KEY-008). */}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        className="min-w-0 flex-1 justify-start gap-1.5"
                        variant="ghost"
                      />
                    }
                  >
                    <PlusIcon aria-hidden="true" />
                    Add track
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
            }
          >
            <TimelineLane
              className="h-10 border-b-0 text-muted-foreground text-xs"
              data-add-track=""
              onDragLeave={fileLeave}
              onDragOver={dragOver(NEW_TRACK, true)}
              onDrop={drop(NEW_TRACK, true)}
            >
              <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center">
                Drop audio files or a device here: a track for each
              </span>
            </TimelineLane>
          </Row>
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
