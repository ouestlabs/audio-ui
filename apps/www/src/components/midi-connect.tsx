"use client";

import { PianoKeysIcon } from "@phosphor-icons/react/ssr";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { $midiInput } from "@/registry-audio/bases/base/lib/midi-input";

/**
 * Connects the page's MIDI input from a preview's bar, for the previews that
 * play from a keyboard: they listen to the same input, so a device connected
 * here plays all of them. Hidden where the browser has no Web MIDI.
 */
export function MidiConnect() {
  const midi = useSyncExternalStore(
    $midiInput.subscribe,
    $midiInput.getSnapshot,
    $midiInput.getServerSnapshot
  );
  if (!midi.supported) {
    return null;
  }
  const status = midi.connected
    ? `Connected: ${midi.inputs.join(", ")}. Click to disconnect.`
    : (midi.error ?? "Play it from a MIDI keyboard");
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={midi.connected ? "Disconnect MIDI" : "Connect MIDI"}
            aria-pressed={midi.connected}
            className="shrink-0 aria-pressed:bg-site-accent"
            onClick={
              midi.connected ? $midiInput.disconnect : $midiInput.connect
            }
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
