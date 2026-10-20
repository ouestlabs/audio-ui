import { Knob } from "@audio-ui/react/knob";
import { useCallback } from "react";
import type { Param } from "./params";

export interface Scale {
  marks: readonly number[];
  max: number;
  min: number;
  numerals: readonly number[];
}

/** The panel's usual scale: 0 to 10, a mark at each number. */
export const TEN: Scale = {
  marks: Array.from({ length: 11 }, (_, value) => value),
  max: 10,
  min: 0,
  numerals: [0, 5, 10],
};

/** A rotary knob, snapped to its marks, with its scale printed round it. */
export function Dial({
  label,
  onParam,
  param,
  scale = TEN,
  size = "md",
  value,
}: {
  label: string;
  onParam: (param: Param, value: number) => void;
  param: Param;
  scale?: Scale;
  size?: "lg" | "md";
  value: number;
}) {
  const change = useCallback(
    (next: number) => onParam(param, next),
    [onParam, param]
  );
  return (
    <Knob.Root
      className="vega-knob"
      data-size={size}
      dragMode="vertical"
      largeStep={(scale.max - scale.min) / 5}
      max={scale.max}
      min={scale.min}
      onValueChange={change}
      step={1}
      value={value}
    >
      <Knob.Control className="vega-knob-control">
        <Knob.Thumb className="vega-knob-thumb" />
        {scale.marks.map((mark) => (
          <Knob.Mark className="vega-knob-mark" key={mark} value={mark}>
            <span className="vega-knob-tick" />
            {scale.numerals.includes(mark) && (
              <span className="vega-knob-numeral">{mark}</span>
            )}
          </Knob.Mark>
        ))}
      </Knob.Control>
      <Knob.Label className="vega-knob-label">{label}</Knob.Label>
    </Knob.Root>
  );
}
