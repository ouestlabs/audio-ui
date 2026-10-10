import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";

const MARKS = [
  { label: "0", value: 0 },
  25,
  50,
  75,
  { label: "100", value: 100 },
];

export default function FaderHorizontalDemo() {
  return (
    <Fader
      aria-label="Volume"
      defaultValue={50}
      marks={MARKS}
      max={100}
      min={0}
      orientation="horizontal"
      step={1}
    />
  );
}
