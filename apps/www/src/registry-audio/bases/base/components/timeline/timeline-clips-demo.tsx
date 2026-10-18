"use client";

import {
  DEFAULT_TEMPO,
  describeBarsBeats,
  secondsPerBar,
} from "@audio-ui/core/time";
import type { Timeline as TimelinePrimitive } from "@audio-ui/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
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
import { useSimulatedClock } from "@/registry-audio/bases/base/hooks/use-simulated-clock";

type ClipValue = TimelinePrimitive.Clip.Value;

/** The timeline counts in seconds; a bar of 4/4 at 120 BPM lasts two of them. */
const BAR = secondsPerBar(DEFAULT_TEMPO);
const BARS = 16;
const DURATION = BARS * BAR;
const bars = (count: number) => count * BAR;

const LOOP = [bars(4), bars(8)] as const;
/** A label on every other bar. */
const MARKS = Array.from({ length: BARS / 2 }, (_, index) => index * 2);

const TRACKS = [
  { id: "drums", name: "Drums" },
  { id: "bass", name: "Bass" },
] as const;

const CLIPS = [
  {
    id: "groove",
    title: "Groove",
    track: "drums",
    value: { fadeIn: 0, fadeOut: 0.5, length: bars(4), offset: 0, start: 0 },
  },
  {
    id: "fill",
    title: "Fill",
    track: "drums",
    value: {
      fadeIn: 0,
      fadeOut: 0,
      length: bars(2),
      offset: 0,
      start: bars(6),
    },
  },
  {
    id: "sub",
    title: "Sub",
    track: "bass",
    value: {
      fadeIn: 0.5,
      fadeOut: 1,
      length: bars(6),
      offset: 0,
      start: bars(3),
    },
  },
] as const;

const describe = (seconds: number) => describeBarsBeats(seconds, DEFAULT_TEMPO);

function Clip({
  onChange,
  title,
  track,
  value,
}: {
  onChange: (value: ClipValue) => void;
  title: string;
  track: string;
  value: ClipValue;
}) {
  return (
    <TimelineClip
      aria-label={`${track}, ${title}`}
      className="inset-y-1.5 bg-primary/30"
      getAriaValueText={describe}
      onValueChange={onChange}
      sourceLength={DURATION}
      value={value}
    >
      <TimelineClipHeader>
        <span>{title}</span>
      </TimelineClipHeader>
      <TimelineClipFade edge="in" />
      <TimelineClipFade edge="out" />
      <TimelineClipHandle aria-label={`${title} start`} edge="start" />
      <TimelineClipHandle aria-label={`${title} end`} edge="end" />
      <TimelineClipFadeHandle aria-label={`${title} fade in`} edge="in" />
      <TimelineClipFadeHandle aria-label={`${title} fade out`} edge="out" />
    </TimelineClip>
  );
}

export default function TimelineClipsDemo() {
  const [loop, setLoop] = useState<readonly [number, number]>(LOOP);
  const [clips, setClips] = useState<Record<string, ClipValue>>(() =>
    Object.fromEntries(CLIPS.map((clip) => [clip.id, { ...clip.value }]))
  );
  // The timeline fits the width it is given until the navigator zooms it.
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fitPx, setFitPx] = useState(0);
  const [zoomed, setZoomed] = useState<number | null>(null);
  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }
    const measure = () => {
      const lead =
        element.querySelector<HTMLElement>(
          '[data-slot="timeline-track-header"]'
        )?.offsetWidth ?? 0;
      setFitPx(Math.max(0, (element.clientWidth - lead) / DURATION));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const [heights, setHeights] = useState<Record<string, number | undefined>>(
    {}
  );
  // Never less than what fits the width.
  const zoom = Math.max(zoomed ?? fitPx, fitPx) || 8;
  const { clock } = useSimulatedClock({
    duration: DURATION,
    loop,
    looping: true,
  });
  const moveClip = useCallback(
    (id: string) => (value: ClipValue) =>
      setClips((all) => ({ ...all, [id]: value })),
    []
  );
  const resizeTrack = useCallback(
    (id: string) => (height: number | undefined) =>
      setHeights((all) => ({ ...all, [id]: height })),
    []
  );
  return (
    <Timeline
      className="w-full gap-2"
      duration={DURATION}
      maxZoom={96}
      minZoom={fitPx || undefined}
      onPositionChange={clock.set}
      onZoomChange={setZoomed}
      snapStep={BAR / 4}
      source={clock}
      zoom={zoom}
    >
      <TimelineNavigator getAriaValueText={describe} />
      <TimelineViewport
        className="flex flex-col overflow-y-hidden bg-muted/40"
        ref={viewportRef}
        scrollbar="hidden"
      >
        {/* As wide as the lanes, so the stuck headers stay put however far it scrolls. */}
        <div className="flex min-h-full w-max min-w-full shrink-0 flex-col">
          <TimelineTrack>
            <TimelineTrackHeader className="flex items-center px-3 text-muted-foreground text-xs">
              Loop
            </TimelineTrackHeader>
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
          </TimelineTrack>
          <TimelineTrack>
            <TimelineTrackHeader className="flex items-center px-3 text-xs">
              Bars
            </TimelineTrackHeader>
            <TimelineRuler
              aria-label="Playhead"
              className="border-b-0"
              getAriaValueText={describe}
            >
              {MARKS.map((bar) => (
                <TimelineMark key={bar} value={bars(bar)}>
                  {bar + 1}
                </TimelineMark>
              ))}
              <TimelinePlayhead />
            </TimelineRuler>
          </TimelineTrack>
          {TRACKS.map((track) => (
            <TimelineTrack
              height={heights[track.id]}
              key={track.id}
              maxHeight={200}
              minHeight={56}
              onHeightChange={resizeTrack(track.id)}
            >
              <TimelineTrackHeader className="flex items-center px-3 font-medium text-sm">
                {track.name}
                <TimelineTrackResizeHandle
                  aria-label={`Height of ${track.name}`}
                />
              </TimelineTrackHeader>
              <TimelineLane
                className="h-auto min-h-14 flex-1 border-b-0"
                gridStep={BAR}
                seekable
              >
                {CLIPS.filter((clip) => clip.track === track.id).map((clip) => (
                  <Clip
                    key={clip.id}
                    onChange={moveClip(clip.id)}
                    title={clip.title}
                    track={track.name}
                    value={clips[clip.id] ?? clip.value}
                  />
                ))}
                <TimelinePlayhead />
              </TimelineLane>
            </TimelineTrack>
          ))}
        </div>
      </TimelineViewport>
    </Timeline>
  );
}
