"use client";

import { createSource } from "@audio-ui/react";
import {
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

interface Clip {
  id: string;
  name: string;
  range: Span;
  track: (typeof TRACKS)[number]["id"];
}

const CLIPS: Clip[] = [
  { id: "d1", name: "Intro", range: [bars(0), bars(4)], track: "drums" },
  { id: "d2", name: "Groove", range: [bars(4), bars(16)], track: "drums" },
  { id: "d3", name: "Groove", range: [bars(16), bars(28)], track: "drums" },
  { id: "d4", name: "Fill", range: [bars(28), bars(32)], track: "drums" },
  { id: "b1", name: "Sub", range: [bars(4), bars(12)], track: "bass" },
  { id: "b2", name: "Sub", range: [bars(16), bars(28)], track: "bass" },
  { id: "k1", name: "Pad", range: [bars(0), bars(8)], track: "keys" },
  { id: "k2", name: "Chords", range: [bars(8), bars(16)], track: "keys" },
  { id: "k3", name: "Pad", range: [bars(20), bars(32)], track: "keys" },
  { id: "v1", name: "Verse", range: [bars(8), bars(16)], track: "vocals" },
  { id: "v2", name: "Hook", range: [bars(16), bars(24)], track: "vocals" },
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
      <div className="sticky left-0 z-20 flex w-28 shrink-0 items-center border-e bg-background px-3 text-sm">
        {lead}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

/** One clip: a range to move and trim. */
function ClipRange({
  clip,
  onMove,
  trackName,
}: {
  clip: Clip;
  onMove: (id: string, range: Span) => void;
  trackName: string;
}) {
  const handleChange = useCallback(
    (range: Span) => onMove(clip.id, range),
    [clip.id, onMove]
  );
  return (
    <TimelineRange
      aria-label={`${trackName}, ${clip.name}`}
      className="inset-y-1.5"
      getAriaValueText={describePosition}
      onValueChange={handleChange}
      value={clip.range}
    >
      <TimelineRangeHandle aria-label={`${clip.name} start`} edge="start" />
      <TimelineRangeHandle aria-label={`${clip.name} end`} edge="end" />
      <span className="pointer-events-none absolute inset-x-2 top-1 truncate text-xs">
        {clip.name}
      </span>
    </TimelineRange>
  );
}

/**
 * An arrangement: a bar ruler that seeks on the grid, a loop strip, a lane per
 * track with clips to move and trim, and a playhead following a transport
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
  const moveClip = useCallback(
    (id: string, range: Span) =>
      setClips((all) =>
        all.map((clip) => (clip.id === id ? { ...clip, range } : clip))
      ),
    []
  );

  // The grid the lanes draw is the grid everything snaps to.
  const snapStep = gridInterval("adaptive", zoom, DEFAULT_TEMPO);
  const labelEvery = barLabelInterval(zoom, DEFAULT_TEMPO);
  const labels = Array.from(
    { length: Math.floor(DURATION / labelEvery) },
    (_, index) => index * labelEvery
  );

  return (
    <div className="cn-audio-panel flex w-full min-w-0 flex-col gap-4 border bg-card p-4">
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
              lead={<span className="text-muted-foreground text-xs">Loop</span>}
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
                lead={<span className="font-medium">{track.name}</span>}
              >
                <TimelineLane
                  className="h-auto min-h-14 flex-1"
                  gridStep={snapStep}
                >
                  {clips
                    .filter((clip) => clip.track === track.id)
                    .map((clip) => (
                      <ClipRange
                        clip={clip}
                        key={clip.id}
                        onMove={moveClip}
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
      <p className="text-muted-foreground text-xs">
        Drag a clip to move it and its edges to trim it, on the grid unless
        Cmd/Ctrl is held. Drag across the loop strip to set a loop. Cmd/Ctrl +
        scroll zooms around the pointer, or drag the bar below.
      </p>
    </div>
  );
}
