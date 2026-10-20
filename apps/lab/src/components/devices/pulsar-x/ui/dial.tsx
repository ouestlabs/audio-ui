import { Knob } from "@audio-ui/react/knob";
import { useCallback } from "react";
import type { Knobbed, OnParam } from "./params";

const MARKS = Array.from({ length: 11 }, (_, value) => value);
const NUMERALS = new Set([0, 5, 10]);

/** A rotary knob on the panel's 0 to 10 scale, snapped to its marks, with a cream cap. */
export function Dial({
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
    <Knob.Root
      className="pulsar-knob"
      dragMode="vertical"
      largeStep={2}
      max={10}
      min={0}
      onValueChange={change}
      step={1}
      value={value}
    >
      <Knob.Control className="pulsar-knob-control">
        <Knob.Thumb className="pulsar-knob-thumb" />
        {MARKS.map((mark) => (
          <Knob.Mark className="pulsar-knob-mark" key={mark} value={mark}>
            <span className="pulsar-knob-tick" />
            {NUMERALS.has(mark) && (
              <span className="pulsar-knob-numeral">{mark}</span>
            )}
          </Knob.Mark>
        ))}
      </Knob.Control>
      <Knob.Label className="pulsar-knob-label">{label}</Knob.Label>
    </Knob.Root>
  );
}
