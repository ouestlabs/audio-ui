"use client";

import { createSource } from "@audio-ui/react";
import { useCallback, useEffect, useState } from "react";
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

const BARS = 16;
const DURATION = BARS * secondsPerBar(DEFAULT_TEMPO);
const MIN_ZOOM = 8;
const MAX_ZOOM = 240;
const ZOOM_STEP = 1.5;
const LANES = ["drums", "bass"];

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

export default function TimelineDemo() {
  const { clock, playing, setPlaying } = usePlaybackClock();
  const [zoom, setZoom] = useState(32);
  const togglePlaying = useCallback(
    () => setPlaying((on) => !on),
    [setPlaying]
  );
  const zoomOut = useCallback(
    () => setZoom((z) => Math.max(MIN_ZOOM, z / ZOOM_STEP)),
    []
  );
  const zoomIn = useCallback(
    () => setZoom((z) => Math.min(MAX_ZOOM, z * ZOOM_STEP)),
    []
  );
  const seek = useCallback((seconds: number) => clock.set(seconds), [clock]);
  const [loop, setLoop] = useState<readonly [number, number]>([8, 16]);
  // The grid the lanes draw is the grid everything snaps to.
  const snapStep = gridInterval("adaptive", zoom, DEFAULT_TEMPO);
  const labelEvery = barLabelInterval(zoom, DEFAULT_TEMPO);
  const labels = Array.from(
    { length: Math.floor(DURATION / labelEvery) },
    (_, index) => index * labelEvery
  );

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
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
            disabled={zoom <= MIN_ZOOM}
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
        className="gap-2"
        duration={DURATION}
        maxZoom={MAX_ZOOM}
        minZoom={MIN_ZOOM}
        onPositionChange={seek}
        onZoomChange={setZoom}
        snapStep={snapStep}
        source={clock}
        zoom={zoom}
      >
        <TimelineViewport className="rounded-lg border" scrollbar="hidden">
          <TimelineRuler
            aria-label="Playhead"
            getAriaValueText={describePosition}
          >
            {labels.map((seconds) => (
              <TimelineMark key={seconds} value={seconds}>
                {seconds / secondsPerBar(DEFAULT_TEMPO) + 1}
              </TimelineMark>
            ))}
            <TimelinePlayhead />
          </TimelineRuler>
          <TimelineLane className="h-4 cursor-cell">
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
          {LANES.map((name) => (
            <TimelineLane gridStep={snapStep} key={name}>
              <TimelinePlayhead />
            </TimelineLane>
          ))}
        </TimelineViewport>
        <TimelineNavigator getAriaValueText={describePosition} />
      </Timeline>
      <p className="text-muted-foreground text-xs">
        Cmd/Ctrl + scroll to zoom around the pointer, or drag the bar below.
        Drag across the strip under the ruler to set a loop. Hold Cmd/Ctrl to
        leave the grid, Shift to scrub finely.
      </p>
    </div>
  );
}
