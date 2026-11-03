import {
  describeBarsBeats,
  secondsPerBar,
  secondsPerBeat,
} from "@audio-ui/core/time";
import type { Timeline as TimelinePrimitive } from "@audio-ui/react";
import { PlusIcon } from "@phosphor-icons/react";
import {
  type DragEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useMemo,
  useState,
} from "react";
import { ArrangedClip } from "@/components/audio-ui/arranged-clip";
import { DEVICE_DRAG_TYPE } from "@/components/audio-ui/device-chain";
import {
  MIN_TRACK_HEIGHT,
  Timeline,
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
} from "@/components/audio-ui/timeline";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { useArrangement } from "@/hooks/use-arrangement";
import type { useArrangementEngine } from "@/hooks/use-arrangement-engine";
import {
  GRID_DIVISION_OPTIONS,
  type useTimelineGrid,
} from "@/hooks/use-timeline-grid";
import type { useTimelineZoom } from "@/hooks/use-timeline-zoom";
import {
  type Arranged,
  type ClipAction,
  type Mix,
  mixOf,
} from "@/lib/arrangement";
import { NEW_TRACK } from "@/lib/daw/drop";
import { type Recording, sourcePeaks } from "@/lib/daw/recordings";
import { cn } from "@/lib/utils";

type Arrangement = ReturnType<typeof useArrangement>;
type Engine = ReturnType<typeof useArrangementEngine>;

/** How wide the column of track headers is, in px. */
const LEAD_PX = 220;
/** The closest the ruler's labels come, in px. */
const LABEL_PX = 56;

function carriesFiles(event: DragEvent) {
  return Array.from(event.dataTransfer.types).includes("Files");
}

/** Whether a drag carries a device from the library. */
function carriesDevice(event: DragEvent) {
  return Array.from(event.dataTransfer.types).includes(DEVICE_DRAG_TYPE);
}

/** A row of the arrangement: its header in the sticky column, its lane beside it. */
function Row({
  children,
  className,
  lead,
  selected,
}: {
  children: ReactNode;
  className?: string;
  lead: ReactNode;
  selected?: boolean;
}) {
  return (
    <TimelineTrack
      className={className}
      minHeight={MIN_TRACK_HEIGHT}
      selected={selected}
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
  /** Where playback starts: the start marker, in seconds. */
  cursor: number;
  engine: Engine;
  /** A double-click on a MIDI lane: an empty clip a bar long, from the bar under the pointer. */
  onAddMidiClip: (track: string, at: number) => void;
  /** A device of the library dropped on a track (its id), or on the add-track row (`NEW_TRACK`). */
  onDevice: (device: string, track: string) => void;
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
  cursor,
  engine,
  onAddMidiClip,
  onDevice,
  onFiles,
  onSeek,
  onSelectTrack,
  recordings,
  selectedTrack,
  timelineGrid: grid,
  timelineZoom: view,
  viewportRef,
}: ArrangementViewProps) {
  const { dispatch, doc, selectedIds, selectedTracks } = arrangement;
  const { clips, duration, loop, returns, tempo, tracks } = doc;
  const { zoom } = view;
  const [dropOn, setDropOn] = useState<string | null>(null);
  const beat = secondsPerBeat(tempo);
  const bar = secondsPerBar(tempo);
  const describe = useCallback(
    (seconds: number) => describeBarsBeats(seconds, tempo),
    [tempo]
  );

  // A label every so many bars, so they never crowd: a power of two.
  const labels = useMemo(() => {
    let every = 1;
    while (every * bar * zoom < LABEL_PX && every < 1024) {
      every *= 2;
    }
    const count = Math.floor(duration / bar);
    return Array.from(
      { length: Math.floor(count / every) + 1 },
      (_, index) => ({
        number: index * every + 1,
        start: index * every * bar,
      })
    );
  }, [bar, duration, zoom]);

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
      if (!track || (event.target as HTMLElement).closest("[data-clip-id]")) {
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

  const changeClip = useCallback(
    (
      id: string,
      value: TimelinePrimitive.Clip.Value,
      details: TimelinePrimitive.Clip.ChangeEventDetails
    ) => dispatch({ details, id, type: "change-clip", value }),
    [dispatch]
  );
  const commitClip = useCallback(
    (id: string, details: TimelinePrimitive.Clip.CommitEventDetails) => {
      const named =
        details.lane instanceof HTMLElement
          ? details.lane.dataset.track
          : undefined;
      const clip = clips.find((candidate) => candidate.id === id);
      const kind =
        tracks.find((candidate) => candidate.id === named)?.kind ?? "audio";
      const track =
        (clip?.notes ? "midi" : "audio") === kind ? named : undefined;
      dispatch({ copy: Boolean(details.copy), id, track, type: "commit-clip" });
    },
    [clips, dispatch, tracks]
  );
  const clipAction = useCallback(
    (action: ClipAction, id: string) =>
      dispatch({ action, at: cursor, id, step: beat / 4, type: "clip-action" }),
    [beat, cursor, dispatch]
  );
  const selectClip = useCallback(
    (id: string, additive: boolean) =>
      dispatch({ additive, id, type: "select-clip" }),
    [dispatch]
  );
  const removeClip = useCallback(
    (id: string) => dispatch({ id, type: "remove-clip" }),
    [dispatch]
  );
  const renameClip = useCallback(
    (id: string, name: string) => dispatch({ id, name, type: "rename-clip" }),
    [dispatch]
  );
  const fadeShape = useCallback(
    (
      id: string,
      edge: "in" | "out",
      shape: TimelinePrimitive.Clip.Value["fadeInShape"] & string
    ) => dispatch({ edge, id, shape, type: "set-fade-shape" }),
    [dispatch]
  );
  const changeMix = useCallback(
    (id: string, patch: Partial<Mix>) => {
      const { color: _color, ...rest } = patch;
      // A switch is one step; a drag of the gain or the pan is a burst, closed when it ends.
      const burst = "gain" in rest || "pan" in rest;
      dispatch({ id, patch: rest, type: burst ? "change-mix" : "set-mix" });
    },
    [dispatch]
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
        <div className="flex min-h-full w-max min-w-full shrink-0 flex-col">
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
                {labels.map((label) => (
                  <TimelineMark key={label.start} value={label.start}>
                    {label.number}
                  </TimelineMark>
                ))}
                <TimelinePlayhead />
              </TimelineRuler>
            </Row>
          </div>
          {[...tracks, ...returns].map((track) => {
            const mix = mixOf(track);
            const isReturn = returns.includes(track);
            const silent = mix.muted || (anySolo && !mix.soloed && !isReturn);
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
                    "flex-1 border-foreground/20 border-b",
                    isReturn && "bg-muted/40"
                  )}
                  lead={
                    <TimelineTrackControls
                      compact={false}
                      mix={mix}
                      name={track.name}
                      onDuplicate={isReturn ? undefined : duplicateTrack}
                      onMix={changeMix}
                      onMixCommit={settle}
                      onRemove={removeTrack}
                      onRename={renameTrack}
                      onSelect={pickTrack}
                      selected={
                        selectedTracks.includes(track.id) ||
                        selectedTrack === track.id
                      }
                      trackId={track.id}
                    />
                  }
                  selected={selectedTracks.includes(track.id)}
                >
                  <TimelineLane
                    className={cn(
                      "h-auto min-h-14 flex-1 border-b-0",
                      dropOn === track.id && "ring-2 ring-primary ring-inset",
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
                    seekable
                  >
                    {clips
                      .filter((clip) => clip.track === track.id)
                      .map((clip) => (
                        <ArrangedClip
                          clip={clip}
                          describe={describe}
                          key={clip.id}
                          onAction={clipAction}
                          onChange={changeClip}
                          onCommit={commitClip}
                          onFadeShape={fadeShape}
                          onRemove={removeClip}
                          onRename={renameClip}
                          onSelect={selectClip}
                          peaks={peaksOf(clip)}
                          selected={selectedIds.includes(clip.id)}
                          swatch={mix.color}
                          trackName={track.name}
                        />
                      ))}
                    <TimelinePlayhead />
                  </TimelineLane>
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
    </Timeline>
  );
}
