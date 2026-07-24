"use client";

import { useEffect, useRef, useState } from "react";
import { useTransportClock } from "@/registry-audio/bases/base/hooks/use-transport-clock";

const DEFAULT_BPM = 120;
const DEFAULT_STEPS_PER_BEAT = 4;

export interface UseStepClockOptions {
  bpm?: number;
  /** `time` is the exact AudioContext.currentTime the step is scheduled for — pass it to node .start() calls for sample-accurate triggering instead of firing synthesis at setTimeout-jittered "now". */
  onStep?: (step: number, time: number) => void;
  stepsPerBeat?: number;
  totalSteps: number;
}

export interface UseStepClockReturn {
  isPlaying: boolean;
  start: () => void;
  step: number;
  stop: () => void;
}

/**
 * Drift-free step clock: schedules steps against the shared AudioContext's
 * clock (not setInterval) with a lookahead scheduler, so playback stays in
 * sync even when the tab is throttled in the background. Pass `step` to a
 * Sequencer's `activeStep` prop to drive the playhead. A thin adapter over
 * `useTransportClock` (the region-aware clock) with no loop region — it only
 * adds the reactive `step` a Sequencer needs.
 */
export function useStepClock({
  bpm = DEFAULT_BPM,
  onStep,
  stepsPerBeat = DEFAULT_STEPS_PER_BEAT,
  totalSteps,
}: UseStepClockOptions): UseStepClockReturn {
  const [step, setStep] = useState(0);
  const { getPosition, isPlaying, start, stop } = useTransportClock({
    bpm,
    onStep,
    stepsPerBeat,
    totalSteps,
  });

  const getPositionRef = useRef(getPosition);
  getPositionRef.current = getPosition;

  // The reactive `step` for a Sequencer's `activeStep`, derived from the
  // clock's continuous position in a single rAF — it flips within a frame of
  // the real boundary without the clock setting state on every scheduled step.
  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    let rafId: number;
    const tick = () => {
      const next = Math.floor(getPositionRef.current()) % totalSteps;
      setStep((current) => (current === next ? current : next));
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, totalSteps]);

  return { isPlaying, start, step, stop };
}
