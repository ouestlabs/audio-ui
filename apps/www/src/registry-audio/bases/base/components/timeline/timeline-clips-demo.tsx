"use client";

import type { Timeline as TimelinePrimitive } from "@audio-ui/react";
import { useCallback, useState } from "react";
import {
  Timeline,
  TimelineClip,
  TimelineClipFade,
  TimelineClipFadeHandle,
  TimelineClipHandle,
  TimelineClipHeader,
  TimelineLane,
  TimelineMark,
  TimelinePlayhead,
  TimelineRange,
  TimelineRangeHandle,
  TimelineRuler,
  TimelineTrack,
  TimelineTrackHeader,
  TimelineViewport,
} from "@/registry-audio/bases/base/audio/elements/timeline";
import { useSimulatedClock } from "@/registry-audio/bases/base/hooks/use-simulated-clock";

type ClipValue = TimelinePrimitive.Clip.Value;

/** The length of the timeline, in seconds: the unit of everything below. */
const DURATION = 32;
const LOOP = [8, 16] as const;
const MARKS = [0, 4, 8, 12, 16, 20, 24, 28];

const TRACKS = [
  {
    clip: { fadeIn: 0.5, fadeOut: 1, length: 10, offset: 0, start: 2 },
    id: "drums",
    name: "Drums",
    title: "Groove",
  },
  {
    clip: { fadeIn: 0, fadeOut: 0, length: 12, offset: 0, start: 14 },
    id: "bass",
    name: "Bass",
    title: "Sub",
  },
] as const;

/** A clip is laid on a track: where it sits, how long it plays, and how its edges fade. */
function TrackClip({
  name,
  onChange,
  title,
  value,
}: {
  name: string;
  onChange: (value: ClipValue) => void;
  title: string;
  value: ClipValue;
}) {
  return (
    <TimelineClip
      aria-label={`${name}, ${title}`}
      className="inset-y-1.5 bg-primary/30"
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
    Object.fromEntries(TRACKS.map((track) => [track.id, { ...track.clip }]))
  );
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
  return (
    <Timeline
      className="w-full"
      duration={DURATION}
      onPositionChange={clock.set}
      source={clock}
      zoom={16}
    >
      <TimelineViewport className="flex flex-col overflow-x-auto bg-muted/40">
        <TimelineTrack>
          <TimelineTrackHeader className="flex items-center px-3 text-muted-foreground text-xs">
            Loop
          </TimelineTrackHeader>
          <TimelineLane className="h-6 cursor-cell border-b-0">
            <TimelineRange
              aria-label="Loop"
              drawable
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
            Seconds
          </TimelineTrackHeader>
          <TimelineRuler aria-label="Playhead" className="border-b-0">
            {MARKS.map((mark) => (
              <TimelineMark key={mark} value={mark}>
                {mark}
              </TimelineMark>
            ))}
            <TimelinePlayhead />
          </TimelineRuler>
        </TimelineTrack>
        {TRACKS.map((track) => (
          <TimelineTrack key={track.id}>
            <TimelineTrackHeader className="flex items-center px-3 font-medium text-sm">
              {track.name}
            </TimelineTrackHeader>
            <TimelineLane className="h-16" seekable>
              <TrackClip
                name={track.name}
                onChange={moveClip(track.id)}
                title={track.title}
                value={clips[track.id] ?? track.clip}
              />
              <TimelinePlayhead />
            </TimelineLane>
          </TimelineTrack>
        ))}
      </TimelineViewport>
    </Timeline>
  );
}
