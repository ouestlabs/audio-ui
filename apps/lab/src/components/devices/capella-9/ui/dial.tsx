import { Knob } from "@audio-ui/react/knob";
import { useCallback } from "react";
import type { OnKnob } from "./params";

const MARKS = Array.from({ length: 11 }, (_, value) => value);
const NUMERALS = new Set([0, 5, 10]);

/** A rotary knob on the panel's 0 to 10 scale, snapped to its marks. */
export function Dial({
  knob,
  label,
  onKnob,
  value,
}: {
  knob: "click" | "drive" | "volume";
  label: string;
  onKnob: OnKnob;
  value: number;
}) {
  const change = useCallback(
    (next: number) => onKnob(knob, next),
    [knob, onKnob]
  );
  return (
    <Knob.Root
      className="capella-knob"
      dragMode="vertical"
      largeStep={2}
      max={10}
      min={0}
      onValueChange={change}
      step={1}
      value={value}
    >
      <Knob.Control className="capella-knob-control">
        <Knob.Thumb className="capella-knob-thumb" />
        {MARKS.map((mark) => (
          <Knob.Mark className="capella-knob-mark" key={mark} value={mark}>
            <span className="capella-knob-tick" />
            {NUMERALS.has(mark) && (
              <span className="capella-knob-numeral">{mark}</span>
            )}
          </Knob.Mark>
        ))}
      </Knob.Control>
      <Knob.Label className="capella-label">{label}</Knob.Label>
    </Knob.Root>
  );
}
