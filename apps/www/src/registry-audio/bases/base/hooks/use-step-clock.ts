"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWebAudio } from "@/registry-audio/bases/base/hooks/use-web-audio";

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.1;

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
 * Sequencer's `activeStep` prop to drive the playhead.
 */
export function useStepClock({
  bpm = 120,
  onStep,
  stepsPerBeat = 4,
  totalSteps,
}: UseStepClockOptions): UseStepClockReturn {
  const webAudio = useWebAudio();
  const [isPlaying, setIsPlaying] = useState(false);
  const [step, setStep] = useState(0);

  const nextStepTimeRef = useRef(0);
  const currentStepRef = useRef(0);
  const intervalIdRef = useRef<number | null>(null);
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;
  // Read fresh on every scheduled step (not captured once at start()) so a
  // tempo change while playing takes effect on the next step, not on the
  // next stop/start cycle.
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;
  const stepsPerBeatRef = useRef(stepsPerBeat);
  stepsPerBeatRef.current = stepsPerBeat;

  const stop = useCallback(() => {
    if (intervalIdRef.current !== null) {
      window.clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const start = useCallback(() => {
    const audioContext = webAudio.getContext();
    if (!audioContext) {
      return;
    }

    currentStepRef.current = 0;
    nextStepTimeRef.current = audioContext.currentTime;
    setStep(0);
    setIsPlaying(true);

    intervalIdRef.current = window.setInterval(() => {
      while (
        nextStepTimeRef.current <
        audioContext.currentTime + SCHEDULE_AHEAD_SECONDS
      ) {
        const scheduledStep = currentStepRef.current;
        const scheduledTime = nextStepTimeRef.current;
        const delayMs = Math.max(
          0,
          (scheduledTime - audioContext.currentTime) * 1000
        );

        window.setTimeout(() => {
          setStep(scheduledStep);
          onStepRef.current?.(scheduledStep, scheduledTime);
        }, delayMs);

        const secondsPerStep = 60 / bpmRef.current / stepsPerBeatRef.current;
        currentStepRef.current = (scheduledStep + 1) % totalSteps;
        nextStepTimeRef.current += secondsPerStep;
      }
    }, LOOKAHEAD_MS);
  }, [totalSteps, webAudio]);

  useEffect(() => stop, [stop]);

  return { isPlaying, start, step, stop };
}
