import { Knob } from "@audio-ui/react/knob";
import { useCallback, useMemo } from "react";
import type { Param } from "../audio/engine";

/** A control of the panel that moves a number: a section's level, the sustain, and the tempo. */
export type Knobbed = Param | "tempo";

/** A rotary knob snapped to whole steps, its ends and middle printed; `0` to `10` unless told otherwise. */
export function Dial({
  label,
  max = 10,
  min = 0,
  onParam,
  param,
  value,
}: {
  label: string;
  max?: number;
  min?: number;
  onParam: (param: Knobbed, value: number) => void;
  param: Knobbed;
  value: number;
}) {
  const change = useCallback(
    (next: number) => onParam(param, next),
    [onParam, param]
  );
  const marks = useMemo(() => {
    const span = max - min;
    return Array.from({ length: 11 }, (_, mark) => ({
      numeral: mark % 5 === 0,
      value: min + (span * mark) / 10,
    }));
  }, [max, min]);
  return (
    <Knob.Root
      className="sera-knob"
      dragMode="vertical"
      largeStep={(max - min) / 5}
      max={max}
      min={min}
      onValueChange={change}
      step={1}
      value={value}
    >
      <Knob.Control className="sera-knob-control">
        <Knob.Thumb className="sera-knob-thumb" />
        {marks.map((mark) => (
          <Knob.Mark
            className="sera-knob-mark"
            key={mark.value}
            value={mark.value}
          >
            <span className="sera-knob-tick" />
            {mark.numeral ? (
              <span className="sera-knob-numeral">{mark.value}</span>
            ) : null}
          </Knob.Mark>
        ))}
      </Knob.Control>
      <Knob.Label className="sera-label">{label}</Knob.Label>
    </Knob.Root>
  );
}
