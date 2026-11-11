"use client";

import { midiToHz } from "@audio/note";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type TapeKeysNote,
  type TapeKeysState,
  tapeKeysDevice,
} from "@/registry-audio/bases/base/devices/tape-keys/device";
import {
  createTapeKeysEngine,
  type TapeKeysEngine,
} from "@/registry-audio/bases/base/devices/tape-keys/engine";
import { TapeKeysPanel } from "@/registry-audio/bases/base/devices/tape-keys/panel";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useMidiInput } from "@/registry-audio/bases/base/hooks/use-midi-input";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

/** How many keys sound at once: a ninth takes the voice held longest. */
const VOICES = 8;
/** The note the panel's keyboard holds: one at a time, under its own name. */
const PANEL_NOTE = "panel";

interface Voice {
  engine: TapeKeysEngine;
  holding: string | null;
  since: number;
}

/**
 * A tape-replay keyboard you can plug in: its state, a panel that draws and
 * plays it, and a Web Audio engine that makes the sound, each its own file.
 * The engine plays one key's tape; eight of them play chords. Play the
 * keyboard, or connect a MIDI keyboard and play chords on it, from G2 to F5.
 */
export default function BlockTapeKeys() {
  const [state, setState] = useState<TapeKeysState>(() =>
    tapeKeysDevice.defaults()
  );
  const master = useMasterBus(1);
  const [voices, setVoices] = useState<Voice[] | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!(ctx && master)) {
      return;
    }
    const made = Array.from({ length: VOICES }, () => {
      const engine = createTapeKeysEngine(ctx, stateRef.current);
      engine.output.connect(master);
      return { engine, holding: null, since: 0 };
    });
    setVoices(made);
    return () => {
      for (const voice of made) {
        voice.engine.dispose();
      }
      setVoices(null);
    };
  }, [master]);

  // Every voice follows the state, whoever changed it: a control or a call.
  useEffect(() => {
    for (const voice of voices ?? []) {
      voice.engine.update(state);
    }
  }, [state, voices]);

  /** A note on the voice that holds it, else a free one, else the one held longest. */
  const noteOn = useCallback(
    (note: TapeKeysNote, id: string) => {
      if (!voices) {
        return;
      }
      const voice =
        voices.find((item) => item.holding === id) ??
        voices.find((item) => item.holding === null) ??
        voices.reduce((a, b) => (a.since <= b.since ? a : b));
      if (voice.holding !== null && voice.holding !== id) {
        voice.engine.noteOff();
      }
      voice.holding = id;
      voice.since = performance.now();
      voice.engine.noteOn(note, { id });
    },
    [voices]
  );
  const noteOff = useCallback(
    (id: string) => {
      const voice = voices?.find((item) => item.holding === id);
      if (voice) {
        voice.holding = null;
        voice.engine.noteOff({ id });
      }
    },
    [voices]
  );

  const playKey = useCallback(
    (note: TapeKeysNote) => noteOn(note, PANEL_NOTE),
    [noteOn]
  );
  const releaseKey = useCallback(() => noteOff(PANEL_NOTE), [noteOff]);
  const midi = useMidiInput({
    onNoteOff: (pitch: number) => noteOff(`midi-${pitch}`),
    onNoteOn: (pitch: number) =>
      noteOn({ frequency: midiToHz(pitch) }, `midi-${pitch}`),
  });

  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <TapeKeysPanel
        activeNotes={midi.activeNotes}
        onNoteOff={releaseKey}
        onNoteOn={playKey}
        onValueChange={setState}
        value={state}
      />
    </div>
  );
}
