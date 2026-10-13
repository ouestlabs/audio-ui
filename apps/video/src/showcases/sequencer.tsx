import { createSource } from "@audio-ui/react";
import { useLayoutEffect, useState } from "react";
import { Sequencer } from "@/registry-audio/bases/base/audio/elements/sequencer";

const STEPS = 16;
const STEPS_PER_SECOND = 8;
const ROWS = [
  ["Kick", "1000001010001000"],
  ["Snare", "0000100000001000"],
  ["Hat", "1010101010101011"],
  ["Clap", "0000100100001001"],
] as const;
const LABELS = ROWS.map(([label]) => label);

/** A drum pattern drawn in step by step, then played. */
export function SequencerShowcase({ t }: { t: number }) {
  const [step] = useState(() => createSource(-1));
  const playing =
    t > 0.3 ? Math.floor((t - 0.3) * STEPS_PER_SECOND) % STEPS : -1;
  // The playing column is painted from the source, outside React.
  useLayoutEffect(() => step.set(playing), [playing, step]);
  const pattern = ROWS.map(([, steps], row) =>
    Array.from(
      { length: STEPS },
      (_, index) => steps[index] === "1" && t > 0.1 + index * 0.025 + row * 0.05
    )
  );
  return (
    <div className="flex h-full items-center">
      <Sequencer
        aria-label="Drum pattern"
        rowLabels={LABELS}
        source={step}
        value={pattern}
      />
    </div>
  );
}
