import { Sequencer } from "@/registry-audio/bases/base/audio/elements/sequencer";

const defaultPattern = [
  [true, false, false, false, true, false, false, false],
  [false, false, true, false, false, false, true, false],
];

export default function SequencerDisabledDemo() {
  return (
    <Sequencer
      aria-label="Step pattern"
      className="max-w-lg"
      defaultValue={defaultPattern}
      disabled
    />
  );
}
