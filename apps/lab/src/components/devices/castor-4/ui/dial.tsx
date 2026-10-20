import { Knob } from "@audio-ui/react/knob";
import { useCallback } from "react";
import type { Knobbed, OnParam } from "./params";

const MARKS = Array.from({ length: 11 }, (_, value) => value);
const NUMERALS = new Set([0, 5, 10]);

/** A rotary knob on the panel's 0 to 10 scale, snapped to its marks. */
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
      className="castor-knob"
      data-cap="black"
      dragMode="vertical"
      largeStep={2}
      max={10}
      min={0}
      onValueChange={change}
      step={1}
      value={value}
    >
      <Knob.Control className="castor-knob-control">
        <Knob.Thumb className="castor-knob-thumb" />
        {MARKS.map((mark) => (
          <Knob.Mark className="castor-knob-mark" key={mark} value={mark}>
            <span className="castor-knob-tick" />
            {NUMERALS.has(mark) && (
              <span className="castor-knob-numeral">{mark}</span>
            )}
          </Knob.Mark>
        ))}
      </Knob.Control>
      <Knob.Label className="castor-label">{label}</Knob.Label>
    </Knob.Root>
  );
}
