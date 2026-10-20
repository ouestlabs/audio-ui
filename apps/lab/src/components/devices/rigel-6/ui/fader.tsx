import { Fader } from "@audio-ui/react/fader";
import { useCallback } from "react";
import { FADER_MAX, FADER_MIN } from "../audio/engine";
import { MARKS } from "./params";

const printed = (db: number) => (db > 0 ? `+${db}` : String(db));

/** A vertical fader in dB, with its levels printed along it. */
export function Slide({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  const change = useCallback((next: number) => onChange(next), [onChange]);
  return (
    <Fader.Root
      className="rigel-fader"
      max={FADER_MAX}
      min={FADER_MIN}
      onValueChange={change}
      orientation="vertical"
      step={0.5}
      value={value}
    >
      <Fader.Control className="rigel-fader-control">
        {MARKS.map((mark) => (
          <Fader.Mark className="rigel-fader-mark" key={mark} value={mark}>
            <span className="rigel-fader-numeral">{printed(mark)}</span>
          </Fader.Mark>
        ))}
        <Fader.Track className="rigel-fader-track" />
        <Fader.Thumb className="rigel-fader-thumb" />
      </Fader.Control>
      <Fader.Label className="sr-only">{label}</Fader.Label>
    </Fader.Root>
  );
}
