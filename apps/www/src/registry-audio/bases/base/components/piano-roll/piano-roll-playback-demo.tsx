"use client";

import type { Note } from "@audio-ui/core/piano-roll";
import type { Tempo } from "@audio-ui/core/time";
import { useEffect, useRef, useState } from "react";
import {
  PianoRoll,
  PianoRollGrid,
  PianoRollKeys,
  PianoRollStrip,
  PianoRollViewport,
} from "@/registry-audio/bases/base/audio/elements/piano-roll";
import {
  Timeline,
  TimelinePlayhead,
} from "@/registry-audio/bases/base/audio/elements/timeline";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  meterOf,
  usePianoRollPlayback,
} from "@/registry-audio/bases/base/hooks/use-piano-roll-playback";
import { usePlaySwitch } from "@/registry-audio/bases/base/hooks/use-play-switch";
import { useSynthVoices } from "@/registry-audio/bases/base/hooks/use-synth-voices";

const TEMPO: Tempo = { beatsPerBar: 4, beatUnit: 4, bpm: 110 };
const METER = meterOf(TEMPO, 1);

const PHRASE: Note[] = [
  { id: "1", length: 2, pitch: 60, start: 0, velocity: 0.9 },
  { id: "2", length: 2, pitch: 64, start: 2, velocity: 0.5 },
  { id: "3", length: 2, pitch: 67, start: 4, velocity: 0.8 },
  { id: "4", length: 2, pitch: 72, start: 6, velocity: 1 },
  { id: "5", length: 1, pitch: 71, start: 9, velocity: 0.4 },
  { id: "6", length: 3, pitch: 67, start: 10, velocity: 0.7 },
  { id: "7", length: 3, pitch: 62, start: 13, velocity: 0.6 },
];

/** A bar on loop: edit the notes while it plays, and the next pass plays them. It plays while the play switch of its session is on. */
export default function PianoRollPlaybackDemo() {
  const [notes, setNotes] = useState(PHRASE);
  const output = useMasterBus(0.7);
  const voices = useSynthVoices({ destination: output });
  const playback = usePianoRollPlayback({
    destination: output,
    meter: METER,
    metronome: true,
    notes,
    tempo: TEMPO,
    voices,
  });
  const { playing } = usePlaySwitch();
  // Only the switch starts and stops it: editing a note must not restart it.
  const controls = useRef(playback);
  controls.current = playback;
  useEffect(() => {
    if (playing) {
      controls.current.play();
    } else {
      controls.current.stop();
    }
  }, [playing]);

  return (
    <div className="flex w-full flex-col gap-3">
      <Timeline
        duration={METER.duration}
        onPositionChange={playback.seek}
        snapStep={1}
        source={playback.position}
      >
        <PianoRoll
          activePitches={playback.playingPitches}
          className="h-64 rounded-md border"
          maxPitch={72}
          minPitch={60}
          onNoteOff={playback.onNoteOff}
          onNoteOn={playback.onNoteOn}
          onValueChange={setNotes}
          value={notes}
        >
          <PianoRollViewport>
            <PianoRollStrip className="flex-1" lead={<PianoRollKeys />}>
              <PianoRollGrid
                accentStep={METER.stepsPerBeat}
                aria-label="Notes"
                gridStep={1}
              >
                <TimelinePlayhead />
              </PianoRollGrid>
            </PianoRollStrip>
          </PianoRollViewport>
        </PianoRoll>
      </Timeline>
    </div>
  );
}
