"use client";

import {
  createSource,
  splitClip,
  type Timeline as TimelinePrimitive,
} from "@audio-ui/react";
import {
  type KeyboardEvent,
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
import { ButtonGroup } from "@/registry/bases/base/ui/button-group";
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
import {
  barLabelInterval,
  DEFAULT_TEMPO,
  describeBarsBeats,
  gridInterval,
  secondsPerBar,
} from "@/registry-audio/bases/base/lib/musical-time";

const BARS = 32;
const BAR = secondsPerBar(DEFAULT_TEMPO);
const DURATION = BARS * BAR;
/** The width of a track header, which the lanes start after. */
const LEAD_PX = 112;
const MAX_ZOOM = 240;
const ZOOM_STEP = 1.5;

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
function usePlaybackClock() {
  const [clock] = useState(() => createSource(0));
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) {
      return;
    }
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      clock.set((clock.getSnapshot() + (now - last) / 1000) % DURATION);
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [clock, playing]);

  return { clock, playing, setPlaying };
}

const describePosition = (seconds: number) =>
  describeBarsBeats(seconds, DEFAULT_TEMPO);

/** A row of the arrangement: the track's header stuck to the left edge as it scrolls, its lane beside it. */
function Row({
  children,
  className,
  lead,
}: {
  children: ReactNode;
  className?: string;
  lead?: ReactNode;
}) {
  return (
    <div className={`flex min-w-full ${className ?? ""}`}>
      <div className="sticky left-0 z-20 flex w-28 shrink-0 items-stretch border-e bg-background text-sm">
        {lead}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

/** A track's header: pressing it selects the whole track, its content is where the cursor goes. */
function TrackHeader({
  name,
  onSelect,
  selected,
  trackId,
}: {
  name: string;
  onSelect: (trackId: Arranged["track"]) => void;
  selected: boolean;
  trackId: Arranged["track"];
}) {
  const handleClick = useCallback(() => onSelect(trackId), [onSelect, trackId]);
  return (
    <button
      aria-pressed={selected}
      className="flex w-full items-center px-3 text-left font-medium outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-pressed:bg-muted"
      onClick={handleClick}
      type="button"
    >
      {name}
    </button>
  );
}

/** One clip: move it, trim either edge into its recording, fade it in and out. */
function ClipView({
  clip,
  onChange,
  onCommit,
  onRemove,
  onSelect,
  selected,
  trackName,
}: {
  clip: Arranged;
  onChange: (id: string, value: TimelinePrimitive.Clip.Value) => void;
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
    (value: TimelinePrimitive.Clip.Value) => onChange(clip.id, value),
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
      getAriaValueText={describePosition}
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
}

/**
 * An arrangement: a bar ruler that seeks on the grid, a loop strip, a lane per
 * track with clips to move between tracks, trim and fade, a cursor to put
 * anywhere on a track and split at, and a playhead following a transport
 * clock. Cmd/Ctrl + scroll zooms around the pointer, and the bar below scrolls
 * and zooms. Made to be opened at full size, where the tracks take the screen.
 */
export default function BlockTimeline() {
  const { clock, playing, setPlaying } = usePlaybackClock();
  // The timeline fits the width it is given until it is zoomed.
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fitPx, setFitPx] = useState(0);
  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }
    const measure = () =>
      setFitPx(Math.max(0, (element.clientWidth - LEAD_PX) / DURATION));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const [zoomed, setZoom] = useState<number | null>(null);
  const zoom = Math.max(zoomed ?? fitPx, fitPx) || 8;
  const [loop, setLoop] = useState<Span>([bars(8), bars(16)]);
  const [clips, setClips] = useState(CLIPS);
  // One thing is selected at a time: a clip, or a whole track by its header.
  const [selection, setSelection] = useState<{
    id: string;
    kind: "clip" | "track";
  } | null>(null);
  const selectedId = selection?.kind === "clip" ? selection.id : null;
  const selectedTrack = selection?.kind === "track" ? selection.id : null;
  const pieces = useRef(0);

  const togglePlaying = useCallback(
    () => setPlaying((on) => !on),
    [setPlaying]
  );
  const zoomOut = useCallback(
    () =>
      setZoom((current) => {
        const next = (current ?? fitPx) / ZOOM_STEP;
        return next <= fitPx ? null : next;
      }),
    [fitPx]
  );
  const zoomIn = useCallback(
    () =>
      setZoom((current) => Math.min(MAX_ZOOM, (current ?? fitPx) * ZOOM_STEP)),
    [fitPx]
  );
  const seek = useCallback((seconds: number) => clock.set(seconds), [clock]);
  const changeClip = useCallback(
    (id: string, value: TimelinePrimitive.Clip.Value) =>
      setClips((all) =>
        all.map((clip) => (clip.id === id ? { ...clip, value } : clip))
      ),
    []
  );
  // A clip dropped on another track moves to it.
  const commitClip = useCallback(
    (id: string, details: TimelinePrimitive.Clip.CommitEventDetails) => {
      const track = details.lane?.dataset.track;
      if (!track) {
        return;
      }
      setClips((all) =>
        all.map((clip) =>
          clip.id === id ? { ...clip, track: track as Arranged["track"] } : clip
        )
      );
    },
    []
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
        const cut = targeted ? splitClip(clip.value, at, BAR / 4) : null;
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
  }, [clock, selectedId, selectedTrack]);
  // S, or Cmd/Ctrl + E, splits at the cursor; Escape drops the selection.
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        setSelection(null);
        return;
      }
      const key = event.key.toLowerCase();
      const split =
        (key === "s" && !(event.metaKey || event.ctrlKey || event.altKey)) ||
        (key === "e" && (event.metaKey || event.ctrlKey));
      if (split && selection) {
        event.preventDefault();
        splitAtCursor();
      }
    },
    [selection, splitAtCursor]
  );

  // The grid the lanes draw is the grid everything snaps to.
  const snapStep = gridInterval("adaptive", zoom, DEFAULT_TEMPO);
  const labelEvery = barLabelInterval(zoom, DEFAULT_TEMPO);
  const labels = Array.from(
    { length: Math.floor(DURATION / labelEvery) },
    (_, index) => index * labelEvery
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the editor's shortcuts, caught from the controls inside it
    <div
      className="cn-audio-panel flex w-full min-w-0 flex-col gap-4 border bg-card p-4 outline-none"
      onKeyDown={handleKeyDown}
      ref={panelRef}
      tabIndex={-1}
    >
      <div className="flex items-center justify-between gap-2">
        <Button
          aria-label={playing ? "Pause" : "Play"}
          onClick={togglePlaying}
          size="icon"
          variant="outline"
        >
          <IconPlaceholder
            hugeicons={playing ? "PauseIcon" : "PlayIcon"}
            lucide={playing ? "PauseIcon" : "PlayIcon"}
            phosphor={playing ? "PauseIcon" : "PlayIcon"}
            remixicon={playing ? "RiPauseLine" : "RiPlayLine"}
            tabler={playing ? "IconPlayerPause" : "IconPlayerPlay"}
          />
        </Button>
        <ButtonGroup>
          <Button
            aria-label="Zoom out"
            disabled={zoomed === null}
            onClick={zoomOut}
            size="icon"
            variant="outline"
          >
            <IconPlaceholder
              hugeicons="ZoomOutAreaIcon"
              lucide="ZoomOutIcon"
              phosphor="MagnifyingGlassMinusIcon"
              remixicon="RiZoomOutLine"
              tabler="IconZoomOut"
            />
          </Button>
          <Button
            aria-label="Zoom in"
            disabled={zoom >= MAX_ZOOM}
            onClick={zoomIn}
            size="icon"
            variant="outline"
          >
            <IconPlaceholder
              hugeicons="ZoomInAreaIcon"
              lucide="ZoomInIcon"
              phosphor="MagnifyingGlassPlusIcon"
              remixicon="RiZoomInLine"
              tabler="IconZoomIn"
            />
          </Button>
        </ButtonGroup>
      </div>
      <Timeline
        className="min-h-0 flex-1 gap-2"
        duration={DURATION}
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
              <TimelineRuler
                aria-label="Playhead"
                getAriaValueText={describePosition}
              >
                {labels.map((seconds) => (
                  <TimelineMark key={seconds} value={seconds}>
                    {seconds / BAR + 1}
                  </TimelineMark>
                ))}
                <TimelinePlayhead />
              </TimelineRuler>
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
                  getAriaValueText={describePosition}
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
                className="flex-1"
                key={track.id}
                lead={
                  <TrackHeader
                    name={track.name}
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
        <TimelineNavigator getAriaValueText={describePosition} />
      </Timeline>
    </div>
  );
}
