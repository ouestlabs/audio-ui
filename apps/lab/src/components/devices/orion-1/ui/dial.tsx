import { Knob } from "@audio-ui/react/knob";
import { useCallback } from "react";
import type { Knobbed, OnParam } from "./params";

type Cap = "black" | "ivory" | "orange";

const MARKS = Array.from({ length: 11 }, (_, value) => value);
const NUMERALS = new Set([0, 5, 10]);

/** A rotary knob on the panel's 0 to 10 scale, snapped to its marks. */
export function Dial({
  cap = "black",
  label,
  onParam,
  param,
  size = "md",
  value,
}: {
  cap?: Cap;
  label: string;
  onParam: OnParam;
  param: Knobbed;
  size?: "lg" | "md" | "sm";
  value: number;
}) {
  const change = useCallback(
    (next: number) => onParam(param, next),
    [onParam, param]
  );
  return (
    <Knob.Root
      className="knob"
      data-cap={cap}
      data-size={size}
      dragMode="vertical"
      largeStep={2}
      max={10}
      min={0}
      onValueChange={change}
      step={1}
      value={value}
    >
      <Knob.Control className="knob-control">
        <Knob.Thumb className="knob-thumb" />
        {MARKS.map((mark) => (
          <Knob.Mark className="knob-mark" key={mark} value={mark}>
            <span className="knob-tick" />
            {NUMERALS.has(mark) && <span className="knob-numeral">{mark}</span>}
          </Knob.Mark>
        ))}
      </Knob.Control>
      <Knob.Label className="knob-label">{label}</Knob.Label>
    </Knob.Root>
  );
}
