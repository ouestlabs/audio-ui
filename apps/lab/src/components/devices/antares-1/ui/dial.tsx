import { Knob } from "@audio-ui/react/knob";
import { useCallback } from "react";
import type { Knob as Param } from "../audio/mapping";

const MARKS = Array.from({ length: 11 }, (_, value) => value);
const NUMERALS = new Set([0, 5, 10]);

/** A rotary knob on the panel's 0 to 10 scale, snapped to its marks. */
export function Dial({
  label,
  onKnob,
  param,
  value,
}: {
  label: string;
  onKnob: (param: Param, value: number) => void;
  param: Param;
  value: number;
}) {
  const change = useCallback(
    (next: number) => onKnob(param, next),
    [onKnob, param]
  );
  return (
    <Knob.Root
      className="antares-knob"
      dragMode="vertical"
      largeStep={2}
      max={10}
      min={0}
      onValueChange={change}
      step={1}
      value={value}
    >
      <Knob.Control className="antares-knob-control">
        <Knob.Thumb className="antares-knob-thumb" />
        {MARKS.map((mark) => (
          <Knob.Mark className="antares-knob-mark" key={mark} value={mark}>
            <span className="antares-knob-tick" />
            {NUMERALS.has(mark) && (
              <span className="antares-knob-numeral">{mark}</span>
            )}
          </Knob.Mark>
        ))}
      </Knob.Control>
      <Knob.Label className="antares-knob-label">{label}</Knob.Label>
    </Knob.Root>
  );
}
