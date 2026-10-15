"use client";

import {
  advance,
  anchoredCursor,
  anchorForTempoChange,
  positionAt,
  SCHEDULER_POLL_MS,
  type SchedulerAnchor,
  type SchedulerConfig,
  type SchedulerCursor,
} from "@audio-ui/core/time";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWebAudio } from "@/registry-audio/bases/base/hooks/use-web-audio";

const DEFAULT_BPM = 120;
const DEFAULT_STEPS_PER_BEAT = 4;

export interface TransportRegion {
  /** One past the last step of the loop, exclusive. */
  end: number;
  /** First step of the loop, inclusive. */
  start: number;
}

export interface UseTransportClockOptions {
  bpm?: number;
  /**
   * Fired on every re-anchor (start, stop, seek, region commit), flush any
   * sound already scheduled ahead of the new anchor, e.g. `releaseAll()`.
   */
  onReset?: () => void;
  /**
   * Fired at poll time with the absolute AudioContext time of each step
   * boundary, schedule synthesis here (pass `time` to node `.start()`/`.stop()`)
   * for sample-accurate playback that stays in sync under tab throttling.
   */
  onStep?: (step: number, time: number) => void;
  /** The looping window in steps, read fresh each poll. Omit (or null) for the full grid. */
  region?: TransportRegion | null;
  stepsPerBeat?: number;
  totalSteps: number;
}

export interface UseTransportClockReturn {
  /**
   * The continuous playhead position, in fractional full-grid steps. Read it
   * in an rAF to drive a playhead. Returns the region start while stopped.
   */
  getPosition: () => number;
  isPlaying: boolean;
  /**
   * Re-anchors playback so `step` (default: the region start) plays now, the
   * seek / region-commit primitive. No-op while stopped.
   */
  reanchor: (step?: number) => void;
  /** Seconds between two steps at the current tempo, the canonical step↔time mapping, e.g. for note-off offsets. */
  secondsPerStep: number;
  start: () => void;
  stop: () => void;
}

/**
 * The region-aware {@link https://web.dev/audio-scheduling | look-ahead}
 * transport clock, the seam between musical time (tempo, steps, loop region,
 * seek) and Web Audio scheduling. It advances a drift-free stepping cursor
 * against the shared AudioContext clock and calls `onStep(step, audioTime)` so
 * callers schedule synthesis sample-accurately; it exposes a continuous
 * `getPosition()` for playheads but knows nothing about *what* is played. All
 * of the timing lives in the pure `lib/lookahead-scheduler` core, so this hook
 * is only the React/AudioContext adapter over it.
 */
export function useTransportClock({
  bpm = DEFAULT_BPM,
  onStep,
  onReset,
  region,
  stepsPerBeat = DEFAULT_STEPS_PER_BEAT,
  totalSteps,
}: UseTransportClockOptions): UseTransportClockReturn {
  const webAudio = useWebAudio();
  const [isPlaying, setIsPlaying] = useState(false);

  const secondsPerStep = 60 / bpm / stepsPerBeat;

  // Everything a poll reads goes through refs so a tempo or region change while
  // playing takes effect at the next boundary, not on the next stop/start.
  const config: SchedulerConfig = {
    regionEnd: region ? region.end : totalSteps,
    regionStart: region ? region.start : 0,
    secondsPerStep,
  };
  const configRef = useRef(config);
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;
  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;

  const cursorRef = useRef<SchedulerCursor>({ nextStep: 0, nextStepTime: 0 });
  const anchorRef = useRef<SchedulerAnchor>({ step: 0, time: 0 });
  const intervalRef = useRef<number | null>(null);

  // A tempo change while playing: carry the anchor over at the position the
  // playhead has now, so `getPosition` does not reread the time since the
  // anchor at the new spacing and jump.
  if (
    intervalRef.current !== null &&
    configRef.current.secondsPerStep !== config.secondsPerStep
  ) {
    const ctx = webAudio.getContext();
    if (ctx) {
      anchorRef.current = anchorForTempoChange(
        ctx.currentTime,
        anchorRef.current,
        configRef.current
      );
    }
  }
  configRef.current = config;

  const poll = useCallback(() => {
    const ctx = webAudio.getContext();
    if (!ctx) {
      return;
    }
    const result = advance(
      cursorRef.current,
      ctx.currentTime,
      configRef.current
    );
    cursorRef.current = result.cursor;
    for (const boundary of result.boundaries) {
      onStepRef.current?.(boundary.step, boundary.time);
    }
  }, [webAudio]);

  const anchorAt = useCallback(
    (step: number) => {
      const ctx = webAudio.getContext();
      if (!ctx) {
        return;
      }
      const now = ctx.currentTime;
      cursorRef.current = anchoredCursor(now, step);
      anchorRef.current = { step, time: now };
      onResetRef.current?.();
      poll();
    },
    [poll, webAudio]
  );

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
    onResetRef.current?.();
  }, []);

  const start = useCallback(() => {
    const ctx = webAudio.getContext();
    if (!ctx) {
      return;
    }
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
    }
    setIsPlaying(true);
    anchorAt(configRef.current.regionStart);
    intervalRef.current = window.setInterval(poll, SCHEDULER_POLL_MS);
  }, [anchorAt, poll, webAudio]);

  const reanchor = useCallback(
    (step?: number) => {
      // Only meaningful mid-playback; an idle clock just keeps its next start.
      if (intervalRef.current === null) {
        return;
      }
      anchorAt(step ?? configRef.current.regionStart);
    },
    [anchorAt]
  );

  const getPosition = useCallback(() => {
    const ctx = webAudio.getContext();
    if (!(ctx && intervalRef.current !== null)) {
      return configRef.current.regionStart;
    }
    return positionAt(ctx.currentTime, anchorRef.current, configRef.current);
  }, [webAudio]);

  useEffect(() => stop, [stop]);

  return { getPosition, isPlaying, reanchor, secondsPerStep, start, stop };
}
