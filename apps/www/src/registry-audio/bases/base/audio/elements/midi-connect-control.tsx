"use client";

import { Button } from "@/registry/bases/base/ui/button";
import {
  ButtonGroup,
  ButtonGroupText,
} from "@/registry/bases/base/ui/button-group";
import type { useMidiInput } from "@/registry-audio/bases/base/hooks/use-midi-input";

interface MidiConnectControlProps {
  midi: ReturnType<typeof useMidiInput>;
  onToggle: () => void;
}

/** The "Connect MIDI Keyboard" button plus its device-name/error text, shared by any block wiring up `useMidiInput`. Renders nothing when the browser doesn't support the Web MIDI API. */
export function MidiConnectControl({
  midi,
  onToggle,
}: MidiConnectControlProps) {
  if (!midi.isSupported) {
    return null;
  }
  return (
    <ButtonGroup>
      <Button onClick={onToggle} size="sm" type="button" variant="outline">
        {midi.isConnected ? "Disconnect MIDI" : "Connect MIDI Keyboard"}
      </Button>
      {midi.isConnected || midi.error ? (
        <ButtonGroupText className="text-muted-foreground">
          {midi.isConnected ? midi.inputNames.join(", ") : midi.error}
        </ButtonGroupText>
      ) : null}
    </ButtonGroup>
  );
}
