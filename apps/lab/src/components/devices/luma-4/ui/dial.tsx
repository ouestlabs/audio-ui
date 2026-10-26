import { Knob } from "@audio-ui/react/knob";
import { useCallback } from "react";
import type { Param } from "../audio/engine";

const MARKS = Array.from({ length: 11 }, (_, value) => value);
const NUMERALS = new Set([0, 5, 10]);

/** A rotary knob on the panel's 0 to 10 scale, snapped to its marks; `lg` for the one the hand goes to first. */
export function Dial({
  label,
  onParam,
  param,
  size,
  value,
}: {
  label: string;
  onParam: (param: Param, value: number) => void;
  param: Param;
  size?: "lg";
  value: number;
}) {
  const change = useCallback(
    (next: number) => onParam(param, next),
    [onParam, param]
  );
  return (
    <Knob.Root
      className="luma-knob"
      data-size={size}
      dragMode="vertical"
      largeStep={2}
      max={10}
      min={0}
      onValueChange={change}
      step={1}
      value={value}
    >
      <Knob.Control className="luma-knob-control">
        <Knob.Thumb className="luma-knob-thumb" />
        {MARKS.map((mark) => (
          <Knob.Mark className="luma-knob-mark" key={mark} value={mark}>
            <span className="luma-knob-tick" />
            {NUMERALS.has(mark) && (
              <span className="luma-knob-numeral">{mark}</span>
            )}
          </Knob.Mark>
        ))}
      </Knob.Control>
      <Knob.Label className="luma-label">{label}</Knob.Label>
    </Knob.Root>
  );
}
