import { Envelope } from "@/registry-audio/bases/base/audio/elements/envelope";

export default function EnvelopeNoNewPointsDemo() {
  return <Envelope aria-label="Fixed envelope" maxPoints={5} minPoints={5} />;
}
