import type { ReactNode } from "react";
import {
  Timeline,
  TimelineClip,
  TimelineClipHeader,
  TimelineLane,
  TimelineMark,
  TimelineNavigator,
  TimelinePlayhead,
  TimelineRuler,
  TimelineTrack,
  TimelineTrackHeader,
  TimelineViewport,
  TRACK_COLORS,
} from "@/registry-audio/bases/base/audio/elements/timeline";
import { MOTION, ramp } from "../motion.ts";

const BARS = 8;
const BARS_PER_SECOND = 0.9;
const TRACKS = [
  {
    clips: [
      { length: 4, name: "Beat A", start: 0 },
      { length: 4, name: "Beat B", start: 4 },
    ],
    name: "Drums",
  },
  {
    clips: [
      { length: 2, name: "Bass", start: 1 },
      { length: 3, name: "Bass 2", start: 4 },
    ],
    name: "Bass",
  },
  { clips: [{ length: 4, name: "Chords", start: 2 }], name: "Keys" },
];
const CLIP_STAGGER = 0.08;
const BAR_STARTS = Array.from({ length: BARS }, (_, bar) => bar);
/** The clips are laid down in order, across the tracks: the place of each track's first. */
const FIRST_CLIP = TRACKS.map((_, index) =>
  TRACKS.slice(0, index).reduce((count, track) => count + track.clips.length, 0)
);

function Row({ children, lead }: { children: ReactNode; lead: ReactNode }) {
  return (
    <TimelineTrack>
      <TimelineTrackHeader className="relative flex items-stretch">
        <span className="flex h-full items-center px-3 text-sm">{lead}</span>
      </TimelineTrackHeader>
      <div className="flex flex-1 flex-col">{children}</div>
    </TimelineTrack>
  );
}

/** An arrangement: the clips are laid down track by track, then the playhead runs. */
export function TimelineShowcase({ t }: { t: number }) {
  const position = (Math.max(t - 0.2, 0) * BARS_PER_SECOND) % BARS;
  return (
    <Timeline className="h-full" duration={BARS} position={position}>
      <TimelineViewport className="flex flex-1 flex-col overflow-hidden bg-muted/40">
        <Row lead={<span className="text-muted-foreground text-xs">Bars</span>}>
          <TimelineRuler
            aria-label="Playhead"
            className="border-b-0 bg-background"
          >
            {BAR_STARTS.map((bar) => (
              <TimelineMark key={bar} value={bar}>
                {bar + 1}
              </TimelineMark>
            ))}
            <TimelinePlayhead />
          </TimelineRuler>
        </Row>
        {TRACKS.map((track, index) => (
          <Row key={track.name} lead={track.name}>
            <TimelineLane className="h-auto min-h-14 flex-1" gridStep={1}>
              {track.clips.map((clip, clipIndex) => {
                const grown = MOTION.move(
                  ramp(
                    t -
                      0.1 -
                      ((FIRST_CLIP[index] ?? 0) + clipIndex) * CLIP_STAGGER,
                    0.6
                  )
                );
                return grown > 0.01 ? (
                  <TimelineClip
                    aria-label={`${track.name}, ${clip.name}`}
                    className={`inset-y-1.5 ${TRACK_COLORS[index + 1]?.clip ?? ""}`}
                    key={clip.name}
                    value={{
                      fadeIn: 0,
                      fadeOut: 0,
                      length: clip.length * grown,
                      offset: 0,
                      start: clip.start,
                    }}
                  >
                    <TimelineClipHeader>
                      <span>{clip.name}</span>
                    </TimelineClipHeader>
                  </TimelineClip>
                ) : null;
              })}
              <TimelinePlayhead />
            </TimelineLane>
          </Row>
        ))}
      </TimelineViewport>
      <TimelineNavigator className="m-2" />
    </Timeline>
  );
}
