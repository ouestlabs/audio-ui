"use client";

import { useCallback, useEffect, useId, useState } from "react";
import {
  ChannelStrip,
  ChannelStripContent,
  ChannelStripLabel,
  ChannelStripSection,
  ChannelStripValue,
} from "@/registry-audio/bases/base/audio/elements/channel-strip";
import { Envelope } from "@/registry-audio/bases/base/audio/elements/envelope";
import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";
import { MidiConnectControl } from "@/registry-audio/bases/base/audio/elements/midi-connect-control";
import { Piano } from "@/registry-audio/bases/base/audio/elements/piano";
import { useMidiInput } from "@/registry-audio/bases/base/hooks/use-midi-input";
import { useSynthVoices } from "@/registry-audio/bases/base/hooks/use-synth-voices";
import { useWebAudio } from "@/registry-audio/bases/base/hooks/use-web-audio";
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
  const webAudio = useWebAudio();
  const volumeId = useId();
  const volumeLabelId = useId();
  const volumeValueId = useId();

  const [envelopePoints, setEnvelopePoints] =
    useState<EnvelopePoint[]>(DEFAULT_ENVELOPE);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [masterGain, setMasterGain] = useState<GainNode | null>(null);

  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!ctx) {
      return;
    }
    const gain = ctx.createGain();
    gain.gain.value = DEFAULT_VOLUME;
    gain.connect(ctx.destination);
    setMasterGain(gain);
    return () => {
      gain.disconnect();
    };
  }, [webAudio]);

  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!(ctx && masterGain)) {
      return;
    }
    masterGain.gain.setTargetAtTime(volume, ctx.currentTime, 0.01);
  }, [volume, masterGain, webAudio]);

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
        <ChannelStrip
          aria-label="Volume"
          className="flex-1"
          orientation="horizontal"
        >
          <ChannelStripContent>
            <ChannelStripSection>
              <ChannelStripLabel id={volumeLabelId}>Volume</ChannelStripLabel>
              <Fader
                aria-describedby={volumeValueId}
                aria-labelledby={volumeLabelId}
                id={volumeId}
                max={1}
                min={0}
                onValueChange={setVolume}
                step={0.01}
                value={volume}
              />
              <ChannelStripValue id={volumeValueId}>
                {Math.round(volume * 100)}%
              </ChannelStripValue>
            </ChannelStripSection>
          </ChannelStripContent>
        </ChannelStrip>
        <MidiConnectControl midi={midi} onToggle={handleMidiToggle} />
      </div>
    </div>
  );
}
