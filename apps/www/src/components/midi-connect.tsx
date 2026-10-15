"use client";

import { PianoKeysIcon } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMidiInput } from "@/registry-audio/bases/base/hooks/use-midi-input";

/**
 * Connects the page's MIDI input from a preview's bar, for the previews that
 * play from a keyboard: they listen to the same input, so a device connected
 * here plays all of them. Hidden where the browser has no Web MIDI.
 */
export function MidiConnect() {
  const midi = useMidiInput();
  if (!midi.isSupported) {
    return null;
  }
  const status = midi.isConnected
    ? `Connected: ${midi.inputNames.join(", ")}. Click to disconnect.`
    : (midi.error ?? "Play it from a MIDI keyboard");
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={midi.isConnected ? "Disconnect MIDI" : "Connect MIDI"}
            aria-pressed={midi.isConnected}
            className="shrink-0 aria-pressed:bg-site-accent"
            onClick={midi.isConnected ? midi.disconnect : midi.requestAccess}
            size="icon"
            variant="outline"
          >
            <PianoKeysIcon aria-hidden="true" />
          </Button>
        }
      />
      <TooltipContent>{status}</TooltipContent>
    </Tooltip>
  );
}
