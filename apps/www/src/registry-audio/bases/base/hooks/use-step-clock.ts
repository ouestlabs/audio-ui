"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.1;

export interface UseStepClockOptions {
  bpm?: number;
  onStep?: (step: number) => void;
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
 * Drift-free step clock: schedules steps against the AudioContext's clock
 * (not setInterval) with a lookahead scheduler, so playback stays in sync
 * even when the tab is throttled in the background. Pass `step` to a
 * Sequencer's `activeStep` prop to drive the playhead.
 */
export function useStepClock({
  bpm = 120,
  onStep,
  stepsPerBeat = 4,
  totalSteps,
}: UseStepClockOptions): UseStepClockReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [step, setStep] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStepTimeRef = useRef(0);
  const currentStepRef = useRef(0);
  const intervalIdRef = useRef<number | null>(null);
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  const stop = useCallback(() => {
    if (intervalIdRef.current !== null) {
      window.clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const start = useCallback(() => {
    const audioContext = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = audioContext;

    currentStepRef.current = 0;
    nextStepTimeRef.current = audioContext.currentTime;
    setStep(0);
    setIsPlaying(true);

    const secondsPerStep = 60 / bpm / stepsPerBeat;

    intervalIdRef.current = window.setInterval(() => {
      while (
        nextStepTimeRef.current <
        audioContext.currentTime + SCHEDULE_AHEAD_SECONDS
      ) {
        const scheduledStep = currentStepRef.current;
        const delayMs = Math.max(
          0,
          (nextStepTimeRef.current - audioContext.currentTime) * 1000
        );

        window.setTimeout(() => {
          setStep(scheduledStep);
          onStepRef.current?.(scheduledStep);
        }, delayMs);

        currentStepRef.current = (scheduledStep + 1) % totalSteps;
        nextStepTimeRef.current += secondsPerStep;
      }
    }, LOOKAHEAD_MS);
  }, [bpm, stepsPerBeat, totalSteps]);

  useEffect(() => stop, [stop]);

  return { isPlaying, start, step, stop };
}
