import { Fader } from "@audio-ui/react/fader";
import { useCallback } from "react";
import type { Knobbed, OnParam } from "./params";

/** A vertical slider on the panel's 0 to 10 scale. */
export function Slider({
  label,
  onParam,
  param,
  value,
}: {
  label: string;
  onParam: OnParam;
  param: Knobbed;
  value: number;
}) {
  const change = useCallback(
    (next: number) => onParam(param, next),
    [onParam, param]
  );
  return (
    <Fader.Root
      className="lyra-fader"
      max={10}
      min={0}
      onValueChange={change}
      orientation="vertical"
      step={0.1}
      value={value}
    >
      <Fader.Control className="lyra-fader-control">
        <Fader.Track className="lyra-fader-track" />
        <Fader.Thumb className="lyra-fader-thumb" />
      </Fader.Control>
      <Fader.Label className="lyra-label">{label}</Fader.Label>
    </Fader.Root>
  );
}
