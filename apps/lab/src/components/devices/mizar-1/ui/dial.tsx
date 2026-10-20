import { Knob } from "@audio-ui/react/knob";
import { useCallback } from "react";
import type { Param } from "../audio/engine";

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
  onParam: (param: Param, value: number) => void;
  param: Param;
  value: number;
}) {
  const change = useCallback(
    (next: number) => onParam(param, next),
    [onParam, param]
  );
  return (
    <Knob.Root
      className="mizar-knob"
      dragMode="vertical"
      largeStep={2}
      max={10}
      min={0}
      onValueChange={change}
      step={1}
      value={value}
    >
      <Knob.Control className="mizar-knob-control">
        <Knob.Thumb className="mizar-knob-thumb" />
        {MARKS.map((mark) => (
          <Knob.Mark className="mizar-knob-mark" key={mark} value={mark}>
            <span className="mizar-knob-tick" />
            {NUMERALS.has(mark) && (
              <span className="mizar-knob-numeral">{mark}</span>
            )}
          </Knob.Mark>
        ))}
      </Knob.Control>
      <Knob.Label className="mizar-knob-label">{label}</Knob.Label>
    </Knob.Root>
  );
}
