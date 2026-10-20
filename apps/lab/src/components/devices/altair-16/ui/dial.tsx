import { Knob } from "@audio-ui/react/knob";
import { useCallback } from "react";
import type { Knobbed, OnParam } from "./params";

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

/** The pitch, in semitones: a mark every four, the middle at rest. */
export const SEMITONES: Scale = {
  marks: [-12, -8, -4, 0, 4, 8, 12],
  max: 12,
  min: -12,
  numerals: [-12, 0, 12],
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
  onParam: OnParam;
  param: Knobbed;
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
      className="altair-knob"
      data-size={size}
      dragMode="vertical"
      largeStep={(scale.max - scale.min) / 6}
      max={scale.max}
      min={scale.min}
      onValueChange={change}
      step={1}
      value={value}
    >
      <Knob.Control className="altair-knob-control">
        <Knob.Thumb className="altair-knob-thumb" />
        {scale.marks.map((mark) => (
          <Knob.Mark className="altair-knob-mark" key={mark} value={mark}>
            <span className="altair-knob-tick" />
            {scale.numerals.includes(mark) && (
              <span className="altair-knob-numeral">{mark}</span>
            )}
          </Knob.Mark>
        ))}
      </Knob.Control>
      <Knob.Label className="altair-knob-label">{label}</Knob.Label>
    </Knob.Root>
  );
}
