import { Fader } from "@audio-ui/react/fader";
import { useCallback } from "react";
import type { Param } from "../audio/engine";
import type { OnParam } from "./params";

/** A vertical slider on the panel's 0 to 10 scale. */
export function Slider({
  label,
  onParam,
  param,
  value,
}: {
  label: string;
  onParam: OnParam;
  param: Param;
  value: number;
}) {
  const change = useCallback(
    (next: number) => onParam(param, next),
    [onParam, param]
  );
  return (
    <Fader.Root
      className="fader"
      max={10}
      min={0}
      onValueChange={change}
      orientation="vertical"
      step={0.1}
      value={value}
    >
      <Fader.Control className="fader-control">
        <Fader.Track className="fader-track" />
        <Fader.Thumb className="fader-thumb" />
      </Fader.Control>
      <Fader.Label className="knob-label">{label}</Fader.Label>
    </Fader.Root>
  );
}
