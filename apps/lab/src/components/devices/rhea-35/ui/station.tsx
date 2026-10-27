import { Knob } from "@audio-ui/react/knob";
import { STATIONS, stationOf } from "../audio/engine";

const STOPS = STATIONS.map((name, index) => ({ index, name }));
const stationText = (_formatted: string, value: number) => stationOf(value);

/** The station: a big pointer knob with three stops, the track's name printed at each; it clicks from one to the next. */
export function StationKnob({
  onChange,
  value,
}: {
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <Knob.Root
      className="rhea-knob rhea-station"
      dragMode="vertical"
      largeStep={1}
      max={STATIONS.length - 1}
      min={0}
      onValueChange={onChange}
      step={1}
      value={value}
    >
      <Knob.Control className="rhea-knob-control">
        <Knob.Thumb
          className="rhea-knob-thumb"
          getAriaValueText={stationText}
        />
        {STOPS.map((stop) => (
          <Knob.Mark
            className="rhea-knob-mark"
            key={stop.name}
            value={stop.index}
          >
            <span className="rhea-knob-tick" />
            <span
              className="rhea-station-name"
              data-current={stop.index === Math.round(value) || undefined}
            >
              {stop.name}
            </span>
          </Knob.Mark>
        ))}
      </Knob.Control>
      <Knob.Label className="rhea-label">Station</Knob.Label>
    </Knob.Root>
  );
}
