import { Knob } from "@audio-ui/react/knob";
import { useCallback } from "react";
import type { Param } from "../audio/engine";

const MARKS = Array.from({ length: 11 }, (_, value) => value);
/** The numerals printed at the ends and the middle. */
const NUMERALS: Record<number, string> = { 0: "0", 5: "5", 10: "10" };
/** A bipolar knob prints its ends as a way, not a number: down, the middle, up. */
const BIPOLAR: Record<number, string> = { 0: "-", 5: "0", 10: "+" };

/** A rotary knob on the panel's 0 to 10 scale, snapped to its marks; a bipolar one grows from its middle. */
export function Dial({
  bipolar,
  label,
  onParam,
  param,
  valueText,
  value,
}: {
  bipolar?: boolean;
  label: string;
  onParam: (param: Param, value: number) => void;
  param: Param;
  /** What a screen reader hears for a value, when the number alone says nothing. */
  valueText?: (value: number) => string;
  value: number;
}) {
  const numerals = bipolar ? BIPOLAR : NUMERALS;
  const change = useCallback(
    (next: number) => onParam(param, next),
    [onParam, param]
  );
  const ariaValueText = useCallback(
    (formatted: string, current: number) =>
      valueText ? valueText(current) : formatted,
    [valueText]
  );
  return (
    <Knob.Root
      anchor={bipolar ? 5 : undefined}
      className="maia-knob"
      dragMode="vertical"
      largeStep={2}
      max={10}
      min={0}
      onValueChange={change}
      step={1}
      value={value}
    >
      <Knob.Control className="maia-knob-control">
        <Knob.Thumb
          className="maia-knob-thumb"
          getAriaValueText={ariaValueText}
        />
        {MARKS.map((mark) => (
          <Knob.Mark className="maia-knob-mark" key={mark} value={mark}>
            <span className="maia-knob-tick" />
            {mark in numerals ? (
              <span className="maia-knob-numeral">{numerals[mark]}</span>
            ) : null}
          </Knob.Mark>
        ))}
      </Knob.Control>
      <Knob.Label className="maia-label">{label}</Knob.Label>
    </Knob.Root>
  );
}
