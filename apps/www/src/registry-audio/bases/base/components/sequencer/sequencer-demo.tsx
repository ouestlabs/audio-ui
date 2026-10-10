"use client";

import { createSource } from "@audio-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { Button } from "@/registry/bases/base/ui/button";
import { Sequencer } from "@/registry-audio/bases/base/audio/elements/sequencer";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useTransportClock } from "@/registry-audio/bases/base/hooks/use-transport-clock";
import { useWebAudio } from "@/registry-audio/bases/base/hooks/use-web-audio";
import {
  triggerHihat,
  triggerKick,
  triggerSnare,
} from "@/registry-audio/bases/base/lib/drum-synthesis";

const STEPS = 16;
const STEPS_PER_BEAT = 4;
const BPM = 112;
const VOLUME = 0.7;
const ROWS = ["Kick", "Snare", "Hihat"];
const TRIGGERS = [triggerKick, triggerSnare, triggerHihat];

const x = (steps: number[]) =>
  Array.from({ length: STEPS }, (_, step) => steps.includes(step));
const BEAT = [x([0, 4, 8, 12]), x([4, 12]), x([2, 6, 10, 14])];

/** A drum machine: draw a pattern and hear it. Press a step, or drag across several; the playing column lights up. */
export default function SequencerDemo() {
  const [pattern, setPattern] = useState(BEAT);
  const patternRef = useRef(pattern);
  patternRef.current = pattern;
  const [step] = useState(() => createSource(-1));
  const webAudio = useWebAudio();
  const master = useMasterBus(VOLUME);

  const playStep = useCallback(
    (index: number, time: number) => {
      const ctx = webAudio.getContext();
      if (!(ctx && master)) {
        return;
      }
      patternRef.current.forEach((row, at) => {
        if (row[index]) {
          TRIGGERS[at]?.(ctx, master, time);
        }
      });
    },
    [master, webAudio]
  );
  const { getPosition, isPlaying, start, stop } = useTransportClock({
    bpm: BPM,
    onStep: playStep,
    stepsPerBeat: STEPS_PER_BEAT,
    totalSteps: STEPS,
  });

  useEffect(() => {
    if (!isPlaying) {
      step.set(-1);
      return;
    }
    let frame = 0;
    const tick = () => {
      step.set(Math.floor(getPosition()) % STEPS);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [getPosition, isPlaying, step]);

  const toggle = useCallback(
    () => (isPlaying ? stop() : start()),
    [isPlaying, start, stop]
  );
  const clear = useCallback(
    () =>
      setPattern(ROWS.map(() => Array.from({ length: STEPS }, () => false))),
    []
  );

  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
      <Sequencer
        aria-label="Drum pattern"
        onValueChange={setPattern}
        rowLabels={ROWS}
        source={step}
        value={pattern}
      />
      <div className="flex items-center justify-between gap-2">
        <Button
          aria-label={isPlaying ? "Stop" : "Play"}
          onClick={toggle}
          size="icon-sm"
          variant="outline"
        >
          <IconPlaceholder
            hugeicons={isPlaying ? "PauseIcon" : "PlayIcon"}
            lucide={isPlaying ? "PauseIcon" : "PlayIcon"}
            phosphor={isPlaying ? "PauseIcon" : "PlayIcon"}
            remixicon={isPlaying ? "RiPauseLine" : "RiPlayLine"}
            tabler={isPlaying ? "IconPlayerPause" : "IconPlayerPlay"}
          />
        </Button>
        <Button onClick={clear} size="sm" variant="ghost">
          Clear
        </Button>
      </div>
    </div>
  );
}
