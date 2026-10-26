import { Knob } from "@audio-ui/react/knob";
import { useCallback, useMemo } from "react";
import type { Knobbed, OnParam } from "./params";

/** A rotary knob on the panel's 0 to 10 scale, or on the steps of a list (`max`), snapped to its marks. */
export function Dial({
  label,
  max = 10,
  onParam,
  param,
  valueText,
  value,
}: {
  label: string;
  max?: number;
  onParam: OnParam;
  param: Knobbed;
  /** What a screen reader hears for a value, when the number alone says nothing (a ratio). */
  valueText?: (value: number) => string;
  value: number;
}) {
  const change = useCallback(
    (next: number) => onParam(param, next),
    [onParam, param]
  );
  const marks = useMemo(
    () => Array.from({ length: max + 1 }, (_, mark) => mark),
    [max]
  );
  const ariaValueText = useCallback(
    (formatted: string, current: number) =>
      valueText ? valueText(current) : formatted,
    [valueText]
  );
  return (
    <Knob.Root
      className="nova-knob"
      dragMode="vertical"
      largeStep={2}
      max={max}
      min={0}
      onValueChange={change}
      step={1}
      value={value}
    >
      <Knob.Control className="nova-knob-control">
        <Knob.Thumb
          className="nova-knob-thumb"
          getAriaValueText={ariaValueText}
        />
        {marks.map((mark) => (
          <Knob.Mark className="nova-knob-mark" key={mark} value={mark}>
            <span className="nova-knob-tick" />
          </Knob.Mark>
        ))}
      </Knob.Control>
      <Knob.Label className="nova-label">{label}</Knob.Label>
    </Knob.Root>
  );
}
