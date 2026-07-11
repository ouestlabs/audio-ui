import { Sequencer } from "@/registry-audio/bases/base/audio/elements/sequencer";

const defaultPattern = [
  [true, false, false, false, true, false, false, false],
  [false, false, true, false, false, false, true, false],
  [true, true, false, true, true, true, false, true],
  [false, false, false, false, false, false, false, false],
];

export default function SequencerSizeDefaultDemo() {
  return (
    <Sequencer
      aria-label="Step pattern"
      className="max-w-lg"
      defaultValue={defaultPattern}
    />
  );
}
