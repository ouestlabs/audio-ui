import { Knob } from "@audio-ui/react/knob";
import { useCallback } from "react";
import type { Param } from "../audio/engine";

const MARKS = Array.from({ length: 11 }, (_, value) => value);
/** The numerals printed at the ends and the middle. */
const NUMERALS: Record<number, string> = { 0: "0", 5: "5", 10: "10" };
/** A bipolar knob prints its ends as a way, not a number: slower, the middle, faster. */
const BIPOLAR: Record<number, string> = { 0: "-", 5: "0", 10: "+" };

/** A rotary knob on the panel's 0 to 10 scale, snapped to its marks; a bipolar one grows from its middle. */
export function Dial({
  bipolar,
  label,
  onParam,
  param,
  value,
}: {
  bipolar?: boolean;
  label: string;
  onParam: (param: Param, value: number) => void;
  param: Param;
  value: number;
}) {
  const numerals = bipolar ? BIPOLAR : NUMERALS;
  const change = useCallback(
    (next: number) => onParam(param, next),
    [onParam, param]
  );
  return (
    <Knob.Root
      anchor={bipolar ? 5 : undefined}
      className="rhea-knob"
      dragMode="vertical"
      largeStep={2}
      max={10}
      min={0}
      onValueChange={change}
      step={1}
      value={value}
    >
      <Knob.Control className="rhea-knob-control">
        <Knob.Thumb className="rhea-knob-thumb" />
        {MARKS.map((mark) => (
          <Knob.Mark className="rhea-knob-mark" key={mark} value={mark}>
            <span className="rhea-knob-tick" />
            {mark in numerals ? (
              <span className="rhea-knob-numeral">{numerals[mark]}</span>
            ) : null}
          </Knob.Mark>
        ))}
      </Knob.Control>
      <Knob.Label className="rhea-label">{label}</Knob.Label>
    </Knob.Root>
  );
}
