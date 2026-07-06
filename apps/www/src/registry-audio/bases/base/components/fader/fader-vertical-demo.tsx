import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";

export default function FaderVerticalDemo() {
  return <Fader defaultValue={50} max={100} min={0} step={1} />;
}
