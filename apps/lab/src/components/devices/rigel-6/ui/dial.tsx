import { Knob } from "@audio-ui/react/knob";
import { useCallback } from "react";
import type { Channel, Knob as Param } from "../audio/engine";
import type { OnKnob } from "./params";

export interface Scale {
  marks: readonly number[];
  max: number;
  min: number;
  numerals: readonly number[];
}

/** The EQ: 12 dB of cut or boost, a mark every six. */
export const GAIN: Scale = {
  marks: [-12, -6, 0, 6, 12],
  max: 12,
  min: -12,
  numerals: [],
};

/** The pan: left to right, a mark every five. */
export const PAN: Scale = {
  marks: [-10, -5, 0, 5, 10],
  max: 10,
  min: -10,
  numerals: [],
};

type Cap = "blue" | "green" | "red";

/** A small rotary knob, snapped to its marks, its cap colored by what it does. */
export function Dial({
  cap,
  channel,
  label,
  onKnob,
  param,
  scale,
  value,
}: {
  cap: Cap;
  channel: Channel;
  label: string;
  onKnob: OnKnob;
  param: Param;
  scale: Scale;
  value: number;
}) {
  const change = useCallback(
    (next: number) => onKnob(channel, param, next),
    [channel, onKnob, param]
  );
  return (
    <Knob.Root
      className="rigel-knob"
      data-cap={cap}
      dragMode="vertical"
      largeStep={(scale.max - scale.min) / 4}
      max={scale.max}
      min={scale.min}
      onValueChange={change}
      step={1}
      value={value}
    >
      <Knob.Control className="rigel-knob-control">
        <Knob.Thumb className="rigel-knob-thumb" />
        {scale.marks.map((mark) => (
          <Knob.Mark className="rigel-knob-mark" key={mark} value={mark}>
            <span className="rigel-knob-tick" />
          </Knob.Mark>
        ))}
      </Knob.Control>
      <Knob.Label className="rigel-knob-label">{label}</Knob.Label>
    </Knob.Root>
  );
}
