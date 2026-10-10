"use client";

import { useCallback, useId, useState } from "react";
import { Envelope } from "@/registry-audio/bases/base/audio/elements/envelope";
import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";
import { MidiConnectControl } from "@/registry-audio/bases/base/audio/elements/midi-connect-control";
import { Piano } from "@/registry-audio/bases/base/audio/elements/piano";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useMidiInput } from "@/registry-audio/bases/base/hooks/use-midi-input";
import { useSynthVoices } from "@/registry-audio/bases/base/hooks/use-synth-voices";
import type { EnvelopePoint } from "@/registry-audio/bases/base/lib/synth-voice";

const DEFAULT_VOLUME = 0.7;
const MIDI_MAX_VELOCITY = 127;

/** ADSR-shaped: attack to peak, decay to a sustain plateau, release — matches the Envelope primitive's own default so the two feel like the same instrument. */
const DEFAULT_ENVELOPE: EnvelopePoint[] = [
  { x: 0, y: 0.05 },
  { x: 0.15, y: 1 },
  { x: 0.35, y: 0.6 },
  { x: 0.7, y: 0.6 },
  { x: 1, y: 0.05 },
];

export default function BlockPolysynth() {
  const volumeId = useId();
  const volumeLabelId = useId();
  const volumeValueId = useId();

  const [envelopePoints, setEnvelopePoints] =
    useState<EnvelopePoint[]>(DEFAULT_ENVELOPE);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const masterGain = useMasterBus(volume);

  const { releaseAll, releaseNote, setPitchBend, triggerNote } = useSynthVoices(
    {
      destination: masterGain,
    }
  );

  const handleNoteOn = useCallback(
    (note: number) => {
      triggerNote(note, envelopePoints);
    },
    [envelopePoints, triggerNote]
  );

  const handleNoteOff = useCallback(
    (note: number) => {
      releaseNote(note, envelopePoints);
    },
    [envelopePoints, releaseNote]
  );

  const handleMidiNoteOn = useCallback(
    (note: number, velocity: number) => {
      triggerNote(note, envelopePoints, velocity / MIDI_MAX_VELOCITY);
    },
    [envelopePoints, triggerNote]
  );

  const handleMidiNoteOff = useCallback(
    (note: number) => {
      releaseNote(note, envelopePoints);
    },
    [envelopePoints, releaseNote]
  );

  const midi = useMidiInput({
    onNoteOff: handleMidiNoteOff,
    onNoteOn: handleMidiNoteOn,
    onPitchBend: setPitchBend,
  });

  const handleMidiToggle = useCallback(() => {
    if (midi.isConnected) {
      midi.disconnect();
      releaseAll();
    } else {
      midi.requestAccess();
    }
  }, [midi, releaseAll]);

  return (
    <div className="cn-audio-panel flex w-full min-w-0 flex-col gap-4 border bg-card p-4">
      <Envelope
        aria-label="Amplitude envelope"
        onValueChange={setEnvelopePoints}
        value={envelopePoints}
      />
      <Piano
        activeNotes={midi.activeNotes}
        aria-label="Polysynth keyboard"
        onNoteOff={handleNoteOff}
        onNoteOn={handleNoteOn}
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div aria-label="Volume" className="flex-1" role="group">
          <div className="flex w-full min-w-0 flex-col gap-3">
            <div className="flex w-full min-w-0 items-center justify-between gap-4 [&>*:not(output):not(span)]:min-w-0 [&>*:not(output):not(span)]:flex-1">
              <span
                className="text-center text-muted-foreground text-xs"
                id={volumeLabelId}
              >
                Volume
              </span>
              <Fader
                aria-describedby={volumeValueId}
                aria-labelledby={volumeLabelId}
                id={volumeId}
                max={1}
                min={0}
                onValueChange={setVolume}
                orientation="horizontal"
                step={0.01}
                value={volume}
                valueLabel="hidden"
              />
              <output
                aria-live="polite"
                className="min-w-12 text-center font-mono text-muted-foreground text-xs tabular-nums"
                id={volumeValueId}
              >
                {Math.round(volume * 100)}%
              </output>
            </div>
          </div>
        </div>
        <MidiConnectControl midi={midi} onToggle={handleMidiToggle} />
      </div>
    </div>
  );
}
