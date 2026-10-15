"use client";

import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { Button } from "@/registry/bases/base/ui/button";
import { Tuner } from "@/registry-audio/bases/base/audio/elements/tuner";
import { useMicrophone } from "@/registry-audio/bases/base/hooks/use-microphone";
import { usePitch } from "@/registry-audio/bases/base/hooks/use-pitch";

/** A chromatic tuner on the microphone: play or sing a note and read how far from it you are. Nothing is recorded or played back. */
export default function TunerDemo() {
  const microphone = useMicrophone();
  const pitch = usePitch(microphone.analyser);
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <Tuner source={pitch} />
      <div className="flex flex-col items-center gap-2">
        <Button
          onClick={microphone.isListening ? microphone.stop : microphone.start}
          variant={microphone.isListening ? "outline" : "default"}
        >
          {microphone.isListening ? (
            <IconPlaceholder
              hugeicons="MicOff01Icon"
              lucide="MicOffIcon"
              phosphor="MicrophoneSlashIcon"
              remixicon="RiMicOffLine"
              tabler="IconMicrophoneOff"
            />
          ) : (
            <IconPlaceholder
              hugeicons="Mic01Icon"
              lucide="MicIcon"
              phosphor="MicrophoneIcon"
              remixicon="RiMicLine"
              tabler="IconMicrophone"
            />
          )}
          {microphone.isListening ? "Stop listening" : "Listen"}
        </Button>
        {microphone.error ? (
          <p className="text-destructive text-xs" role="alert">
            {microphone.error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
