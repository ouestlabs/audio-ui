import { Sequencer } from "@/registry-audio/bases/base/audio/elements/sequencer";

const defaultPattern = [
  [true, false, true, false, true, false, true, false],
  [false, true, false, true, false, true, false, true],
];

export default function SequencerSizeSmDemo() {
  return (
    <Sequencer
      aria-label="Step pattern"
      className="max-w-lg"
      defaultValue={defaultPattern}
      size="sm"
    />
  );
}
