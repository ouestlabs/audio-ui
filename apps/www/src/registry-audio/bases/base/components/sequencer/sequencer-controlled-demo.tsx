"use client";

import { useState } from "react";
import { Sequencer } from "@/registry-audio/bases/base/audio/elements/sequencer";

const initialPattern = [
  [true, false, false, true, false, false, true, false],
  [false, true, false, false, true, false, false, true],
];

export default function SequencerControlledDemo() {
  const [pattern, setPattern] = useState(initialPattern);
  const activeSteps = pattern.flat().filter(Boolean).length;

  return (
    <div className="flex w-full max-w-lg flex-col gap-3">
      <Sequencer
        aria-label="Drum pattern"
        onValueChange={setPattern}
        value={pattern}
      />
      <output className="text-center font-mono text-muted-foreground text-xs">
        {activeSteps} steps active
      </output>
    </div>
  );
}
