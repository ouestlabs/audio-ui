import { Fader } from "@audio-ui/react/fader";
import { useCallback } from "react";
import type { Knobbed, OnParam } from "./params";

/** A short vertical slider on the panel's 0 to 10 scale: an operator's level. */
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
      className="nova-fader"
      max={10}
      min={0}
      onValueChange={change}
      orientation="vertical"
      step={0.1}
      value={value}
    >
      <Fader.Control className="nova-fader-control">
        <Fader.Track className="nova-fader-track">
          <Fader.Indicator className="nova-fader-indicator" />
        </Fader.Track>
        <Fader.Thumb className="nova-fader-thumb" />
      </Fader.Control>
      <Fader.Label className="nova-label">{label}</Fader.Label>
    </Fader.Root>
  );
}
