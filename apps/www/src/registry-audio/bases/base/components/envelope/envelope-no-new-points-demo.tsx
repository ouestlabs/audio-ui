import { Envelope } from "@/registry-audio/bases/base/audio/elements/envelope";

export default function EnvelopeNoNewPointsDemo() {
  return (
    <Envelope
      allowAddPoints={false}
      allowRemovePoints={false}
      aria-label="Fixed envelope"
    />
  );
}
