"use client";

import { noteToFrequency } from "@audio-ui/core/pitch";
import {
  type DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { SamplerPanel } from "@/registry-audio/bases/base/audio/panels/sampler-panel";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useMidiInput } from "@/registry-audio/bases/base/hooks/use-midi-input";
import {
  type SamplerNote,
  type SamplerState,
  samplerDevice,
} from "@/registry-audio/bases/base/lib/sampler-device";
import {
  createSamplerEngine,
  type SamplerEngine,
} from "@/registry-audio/bases/base/lib/sampler-engine";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

/** How many slices play at once: a ninth takes the voice held longest. */
const VOICES = 8;
/** The note the panel's keyboard holds: one at a time, under its own name. */
const PANEL_NOTE = "panel";

interface Voice {
  engine: SamplerEngine;
  holding: string | null;
  since: number;
}

/**
 * A slice sampler you can plug in: its state, a panel that draws and plays it,
 * and a Web Audio engine that makes the sound, each its own file. Strike the
 * pads, or play a MIDI keyboard from C2: each key plays a slice. Drop an audio
 * file on it and it plays that instead of its own sample.
 */
export default function BlockSampler() {
  const [state, setState] = useState<SamplerState>(() =>
    samplerDevice.defaults()
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
      const engine = createSamplerEngine(ctx, stateRef.current);
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
    (note: SamplerNote, id: string) => {
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
    (note: SamplerNote) => noteOn(note, PANEL_NOTE),
    [noteOn]
  );
  const releaseKey = useCallback(() => noteOff(PANEL_NOTE), [noteOff]);
  useMidiInput({
    onNoteOff: (pitch: number) => noteOff(`midi-${pitch}`),
    onNoteOn: (pitch: number, velocity: number) =>
      noteOn({ frequency: noteToFrequency(pitch), velocity }, `midi-${pitch}`),
  });

  // A file dropped on the sampler is decoded and played in place of its own sample.
  const [file, setFile] = useState<string | null>(null);
  const takeFile = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);
  const dropFile = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      const [dropped] = Array.from(event.dataTransfer.files);
      const ctx = webAudio.getContext();
      event.preventDefault();
      if (!(dropped && ctx && voices)) {
        return;
      }
      try {
        const buffer = await ctx.decodeAudioData(await dropped.arrayBuffer());
        for (const voice of voices) {
          voice.engine.load(buffer);
        }
        setFile(dropped.name);
      } catch {
        setFile(null);
      }
    },
    [voices]
  );
  // The state naming another sample lets go of the file.
  const { sample } = state;
  useEffect(() => {
    if (sample) {
      setFile(null);
    }
  }, [sample]);

  return (
    <div
      aria-label={file ? `Sampler, playing ${file}` : "Sampler"}
      className="cn-audio-panel h-full w-full min-w-0"
      onDragOver={takeFile}
      onDrop={dropFile}
      role="group"
    >
      <SamplerPanel
        onNoteOff={releaseKey}
        onNoteOn={playKey}
        onValueChange={setState}
        value={state}
      />
    </div>
  );
}
