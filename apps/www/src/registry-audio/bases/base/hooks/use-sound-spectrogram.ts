import { type Spectrogram, spectrogram } from "@audio-ui/engine/analysis";
import { useCallback, useState } from "react";
import { renderEdited } from "@/registry-audio/bases/base/hooks/use-bake";
import type { ArrangementDoc } from "@/registry-audio/bases/base/lib/arrangement-state";
import type { RecordingSource } from "@/registry-audio/bases/base/lib/clip-player";

interface SoundSpectrogramOptions {
  doc: ArrangementDoc;
  recordings: ReadonlyMap<string, RecordingSource>;
  /** The rate the edited sound is rendered at. */
  sampleRate: number;
  /** What the editor says while it works: `""` when it is done. */
  setStatus: (status: string) => void;
  /** The track whose clips are the sound. */
  track: string;
}

/**
 * Reads the frequencies of the sound as edited over time. `show` renders what
 * the track's clips play, reads it with `spectrogram` of the engine, and
 * keeps the `grid` until `clear`.
 */
export function useSoundSpectrogram({
  doc,
  recordings,
  sampleRate,
  setStatus,
  track,
}: SoundSpectrogramOptions) {
  const [grid, setGrid] = useState<Spectrogram | null>(null);
  const show = useCallback(async () => {
    setStatus("Reading the frequencies…");
    // One frame to show it: the render and the reading cover every sample.
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    const rendered = await renderEdited(doc, track, recordings, sampleRate);
    if (!rendered) {
      setStatus("This browser cannot render offline");
      return;
    }
    setGrid(spectrogram(rendered.channels, rendered.sampleRate));
    setStatus("");
  }, [doc, recordings, sampleRate, setStatus, track]);
  const clear = useCallback(() => setGrid(null), []);
  return { clear, grid, show };
}
