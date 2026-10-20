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

/** The tempo, in beats a minute: a mark every twenty. */
export const TEMPO: Scale = {
  marks: [60, 80, 100, 120, 140, 160, 180],
  max: 180,
  min: 60,
  numerals: [60, 120, 180],
};

/** A rotary knob, snapped to its marks, with its scale printed round it. */
export function Dial({
  label,
  onParam,
  param,
  scale = TEN,
  value,
}: {
  label: string;
  onParam: OnParam;
  param: Knobbed;
  scale?: Scale;
  value: number;
}) {
  const change = useCallback(
    (next: number) => onParam(param, next),
    [onParam, param]
  );
  return (
    <Knob.Root
      className="sirius-knob"
      dragMode="vertical"
      largeStep={(scale.max - scale.min) / 5}
      max={scale.max}
      min={scale.min}
      onValueChange={change}
      step={1}
      value={value}
    >
      <Knob.Control className="sirius-knob-control">
        <Knob.Thumb className="sirius-knob-thumb" />
        {scale.marks.map((mark) => (
          <Knob.Mark className="sirius-knob-mark" key={mark} value={mark}>
            <span className="sirius-knob-tick" />
            {scale.numerals.includes(mark) && (
              <span className="sirius-knob-numeral">{mark}</span>
            )}
          </Knob.Mark>
        ))}
      </Knob.Control>
      <Knob.Label className="sirius-knob-label">{label}</Knob.Label>
    </Knob.Root>
  );
}
