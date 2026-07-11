"use client";

import { useState } from "react";
import { Button } from "@/registry/bases/base/ui/button";
import { Sequencer } from "@/registry-audio/bases/base/audio/elements/sequencer";
import { useStepClock } from "@/registry-audio/bases/base/hooks/use-step-clock";

const initialPattern = [
  [true, false, false, false, true, false, false, false],
  [false, false, true, false, false, false, true, false],
];

export default function SequencerPlayingDemo() {
  const [pattern, setPattern] = useState(initialPattern);
  const { isPlaying, start, step, stop } = useStepClock({
    bpm: 120,
    totalSteps: pattern[0]?.length ?? 0,
  });

  return (
    <div className="flex w-full max-w-lg flex-col gap-3">
      <Sequencer
        activeStep={isPlaying ? step : undefined}
        aria-label="Step pattern"
        onValueChange={setPattern}
        value={pattern}
      />
      <Button
        onClick={isPlaying ? stop : start}
        size="sm"
        type="button"
        variant="outline"
      >
        {isPlaying ? "Stop" : "Play"}
      </Button>
    </div>
  );
}
