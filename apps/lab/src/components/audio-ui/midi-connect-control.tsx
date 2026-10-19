"use client";

import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { useMidiInput } from "@/hooks/use-midi-input";

/**
 * Connects the page's MIDI input, with the device's name or the error beside
 * it. Put it anywhere: every component listening with `useMidiInput` hears
 * the device it connects. Renders nothing when the browser has no Web MIDI.
 */
export function MidiConnectControl() {
  const midi = useMidiInput();
  if (!midi.isSupported) {
    return null;
  }
  return (
    <ButtonGroup>
      <Button
        onClick={midi.isConnected ? midi.disconnect : midi.requestAccess}
        type="button"
        variant="outline"
      >
        {midi.isConnected ? "Disconnect MIDI" : "Connect MIDI"}
      </Button>
      {midi.isConnected || midi.error ? (
        <ButtonGroupText className="text-muted-foreground">
          {midi.isConnected ? midi.inputNames.join(", ") : midi.error}
        </ButtonGroupText>
      ) : null}
    </ButtonGroup>
  );
}
