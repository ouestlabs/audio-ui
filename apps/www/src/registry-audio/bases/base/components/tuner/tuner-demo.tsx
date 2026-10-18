"use client";

import { Tuner } from "@/registry-audio/bases/base/audio/elements/tuner";
import { usePageMicrophone } from "@/registry-audio/bases/base/hooks/use-microphone";
import { usePitch } from "@/registry-audio/bases/base/hooks/use-pitch";

/** A chromatic tuner on the microphone: turn it on from the bar, then play or sing a note and read how far from it you are. Nothing is recorded or played back. */
export default function TunerDemo() {
  const pitch = usePitch(usePageMicrophone());
  return (
    <div className="flex w-full justify-center">
      <Tuner source={pitch} />
    </div>
  );
}
