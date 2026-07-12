"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/registry/bases/base/ui/button";
import { Waveform } from "@/registry-audio/bases/base/audio/elements/waveform";
import {
  downsampleWaveform,
  linearWaveformPath,
  normalizeWaveform,
} from "@/registry-audio/bases/base/lib/waveform-path";

const SAMPLE_COUNT = 4000;
const PATH_SAMPLES = 100;
const PATH_WIDTH = 800;
const PATH_HEIGHT = 100;
const DURATION_SECONDS = 30;
/** Caps how much a single frame can advance progress — a backgrounded or throttled tab can leave `requestAnimationFrame` idle for seconds at a time, and without this a resumed frame would read that whole gap as elapsed playback time and jump straight to the end instead of just continuing from where it left off. */
const MAX_FRAME_SECONDS = 0.1;

/** A deterministic stand-in for real decoded audio samples — a few sine partials summed and shaped by a slow envelope, so the waveform has visually interesting peaks and valleys without needing an actual audio file. Swap for `decodeAudioSamples` fed by a real file's bytes. */
function generateSyntheticSamples(count: number): number[] {
  const samples: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / count;
    const envelope = 0.4 + 0.6 * Math.abs(Math.sin(t * Math.PI * 3));
    const wave =
      Math.sin(t * 220) * 0.6 +
      Math.sin(t * 55) * 0.3 +
      Math.sin(t * 660) * 0.1;
    samples.push(wave * envelope);
  }
  return samples;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

/** A seekable waveform player — click or drag the waveform to scrub, Play/Pause to auto-advance. The waveform shape comes from a synthetic sample set standing in for real decoded audio (see `generateSyntheticSamples`'s doc comment for the real-audio equivalent). */
export default function BlockWaveformPlayer() {
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);

  const d = useMemo(() => {
    const samples = generateSyntheticSamples(SAMPLE_COUNT);
    const downsampled = downsampleWaveform(samples, PATH_SAMPLES);
    const normalized = normalizeWaveform(downsampled);
    return linearWaveformPath(normalized, {
      height: PATH_HEIGHT,
      style: "steps",
      width: PATH_WIDTH,
    });
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    lastFrameTimeRef.current = performance.now();
    const tick = (now: number) => {
      const elapsedSeconds = Math.min(
        MAX_FRAME_SECONDS,
        (now - lastFrameTimeRef.current) / 1000
      );
      lastFrameTimeRef.current = now;
      setProgress((current) => {
        const next = current + elapsedSeconds / DURATION_SECONDS;
        if (next >= 1) {
          setIsPlaying(false);
          return 1;
        }
        return next;
      });
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [isPlaying]);

  const handlePlayToggle = useCallback(() => {
    setIsPlaying((playing) => {
      if (!playing && progress >= 1) {
        setProgress(0);
      }
      return !playing;
    });
  }, [progress]);

  const currentSeconds = progress * DURATION_SECONDS;

  return (
    <div className="cn-audio-panel flex w-full min-w-0 flex-col gap-4 border bg-card p-4">
      <Waveform
        aria-label="Track progress"
        d={d}
        onValueChange={setProgress}
        onValueCommit={setProgress}
        value={progress}
      />
      <div className="flex items-center justify-between gap-4">
        <Button
          onClick={handlePlayToggle}
          size="sm"
          type="button"
          variant="outline"
        >
          {isPlaying ? "Pause" : "Play"}
        </Button>
        <span className="text-muted-foreground text-sm tabular-nums">
          {formatTime(currentSeconds)} / {formatTime(DURATION_SECONDS)}
        </span>
      </div>
    </div>
  );
}
