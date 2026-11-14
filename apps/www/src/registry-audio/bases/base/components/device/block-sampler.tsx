import { midiToHz } from "@audio-ui/engine/pitch";
import { type DragEvent, useCallback, useEffect, useState } from "react";
import {
  type SamplerNote,
  type SamplerState,
  samplerDevice,
} from "@/registry-audio/bases/base/devices/sampler/device";
import { createSamplerEngine } from "@/registry-audio/bases/base/devices/sampler/engine";
import { SamplerPanel } from "@/registry-audio/bases/base/devices/sampler/panel";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useMidiInput } from "@/registry-audio/bases/base/hooks/use-midi-input";
import { usePolyphony } from "@/registry-audio/bases/base/hooks/use-polyphony";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

/** The note the panel's keyboard holds: one at a time, under its own name. */
const PANEL_NOTE = "panel";

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
  const { engines, noteOff, noteOn } = usePolyphony({
    create: createSamplerEngine,
    destination: master,
    state,
    // How many slices play at once: a ninth takes the voice held longest.
    voices: 8,
  });

  const playKey = useCallback(
    (note: SamplerNote) => noteOn(note, PANEL_NOTE),
    [noteOn]
  );
  const releaseKey = useCallback(() => noteOff(PANEL_NOTE), [noteOff]);
  const midi = useMidiInput({
    onNoteOff: (pitch: number) => noteOff(`midi-${pitch}`),
    onNoteOn: (pitch: number, velocity: number) =>
      noteOn({ frequency: midiToHz(pitch), velocity }, `midi-${pitch}`),
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
      if (!(dropped && ctx && engines.length > 0)) {
        return;
      }
      try {
        const buffer = await ctx.decodeAudioData(await dropped.arrayBuffer());
        for (const engine of engines) {
          engine.load(buffer);
        }
        setFile(dropped.name);
      } catch {
        setFile(null);
      }
    },
    [engines]
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
        activeNotes={midi.activeNotes}
        onNoteOff={releaseKey}
        onNoteOn={playKey}
        onValueChange={setState}
        value={state}
      />
    </div>
  );
}
