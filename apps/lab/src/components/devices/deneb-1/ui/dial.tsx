import { Knob } from "@audio-ui/react/knob";
import { useCallback } from "react";
import type { Param } from "../audio/engine";
import type { OnParam } from "./params";

const MARKS = Array.from({ length: 11 }, (_, value) => value);
const NUMERALS = new Set([0, 5, 10]);

/** A rotary knob on the panel's 0 to 10 scale, snapped to its marks, with a silver cap. */
export function Dial({
  label,
  onParam,
  param,
  size = "md",
  value,
}: {
  label: string;
  onParam: OnParam;
  param: Param;
  size?: "lg" | "md";
  value: number;
}) {
  const change = useCallback(
    (next: number) => onParam(param, next),
    [onParam, param]
  );
  return (
    <Knob.Root
      className="deneb-knob"
      data-size={size}
      dragMode="vertical"
      largeStep={2}
      max={10}
      min={0}
      onValueChange={change}
      step={1}
      value={value}
    >
      <Knob.Control className="deneb-knob-control">
        <Knob.Thumb className="deneb-knob-thumb" />
        {MARKS.map((mark) => (
          <Knob.Mark className="deneb-knob-mark" key={mark} value={mark}>
            <span className="deneb-knob-tick" />
            {NUMERALS.has(mark) && (
              <span className="deneb-knob-numeral">{mark}</span>
            )}
          </Knob.Mark>
        ))}
      </Knob.Control>
      <Knob.Label className="deneb-knob-label">{label}</Knob.Label>
    </Knob.Root>
  );
}
