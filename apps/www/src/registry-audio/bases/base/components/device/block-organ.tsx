"use client";

import { noteToFrequency } from "@audio-ui/core/pitch";
import { useCallback, useEffect, useRef, useState } from "react";
import { OrganPanel } from "@/registry-audio/bases/base/audio/panels/organ-panel";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useMidiInput } from "@/registry-audio/bases/base/hooks/use-midi-input";
import {
  type OrganNote,
  type OrganState,
  organDevice,
} from "@/registry-audio/bases/base/lib/organ-device";
import {
  createOrganEngine,
  type OrganEngine,
} from "@/registry-audio/bases/base/lib/organ-engine";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

/** How many keys sound at once: a ninth takes the voice held longest. */
const VOICES = 8;
/** The note the panel's keyboard holds: one at a time, under its own name. */
const PANEL_NOTE = "panel";

interface Voice {
  engine: OrganEngine;
  holding: string | null;
  since: number;
}

/**
 * A tonewheel organ you can plug in: its state, a panel that draws and plays
 * it, and a Web Audio engine that makes the sound, each its own file. The
 * engine plays one key; eight of them play chords. Play the keyboard, or
 * connect a MIDI keyboard and play chords on it.
 */
export default function BlockOrgan() {
  const [state, setState] = useState<OrganState>(() => organDevice.defaults());
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
      const engine = createOrganEngine(ctx, stateRef.current);
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
    (note: OrganNote, id: string) => {
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
    (note: OrganNote) => noteOn(note, PANEL_NOTE),
    [noteOn]
  );
  const releaseKey = useCallback(() => noteOff(PANEL_NOTE), [noteOff]);
  const midi = useMidiInput({
    onNoteOff: (pitch: number) => noteOff(`midi-${pitch}`),
    onNoteOn: (pitch: number, velocity: number) =>
      noteOn({ frequency: noteToFrequency(pitch), velocity }, `midi-${pitch}`),
  });

  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <OrganPanel
        activeNotes={midi.activeNotes}
        onNoteOff={releaseKey}
        onNoteOn={playKey}
        onValueChange={setState}
        value={state}
      />
    </div>
  );
}
