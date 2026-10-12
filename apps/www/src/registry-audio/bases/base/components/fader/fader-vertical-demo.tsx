import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";

const MARKS = [
  { label: "0", value: 0 },
  25,
  50,
  75,
  { label: "100", value: 100 },
];

export default function FaderVerticalDemo() {
  return (
    <Fader
      aria-label="Volume"
      defaultValue={50}
      editableValue
      marks={MARKS}
      max={100}
      min={0}
      step={1}
    />
  );
}
