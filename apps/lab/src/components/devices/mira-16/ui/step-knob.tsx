import { pitchName } from "@audio-ui/core/pitch";
import { Knob } from "@audio-ui/react/knob";
import { useCallback } from "react";
import { ROOT, SPAN } from "../audio/engine";

/** One step's bass pitch: a small knob over two octaves, the note it plays printed under it. */
export function StepKnob({
  onPitch,
  step,
  value,
}: {
  onPitch: (step: number, value: number) => void;
  step: number;
  value: number;
}) {
  const change = useCallback(
    (next: number) => onPitch(step, next),
    [onPitch, step]
  );
  return (
    <Knob.Root
      className="mira-step-knob"
      dragMode="vertical"
      largeStep={5}
      max={SPAN}
      min={0}
      onValueChange={change}
      step={1}
      value={value}
    >
      <Knob.Control className="mira-step-knob-control">
        <Knob.Thumb className="mira-step-knob-thumb" />
      </Knob.Control>
      <Knob.Label className="sr-only">{`Step ${step + 1} bass pitch`}</Knob.Label>
      <span aria-hidden="true" className="mira-note">
        {pitchName(ROOT + value)}
      </span>
    </Knob.Root>
  );
}
