import { reportSound, type SoundReport } from "@audio-ui/engine/analysis";
import { useCallback, useState } from "react";
import { renderEdited } from "@/registry-audio/bases/base/hooks/use-bake";
import type { ArrangementDoc } from "@/registry-audio/bases/base/lib/arrangement-state";
import type { RecordingSource } from "@/registry-audio/bases/base/lib/clip-player";

interface SoundReportOptions {
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
 * Reads the sound as edited, to tell what it is: its loudness, key and tempo,
 * and whether it meets ACX's audiobook requirements. `analyze` renders what
 * the track's clips play, reads it with `reportSound` of the engine, and keeps
 * the `report` until `clear`.
 */
export function useSoundReport({
  doc,
  recordings,
  sampleRate,
  setStatus,
  track,
}: SoundReportOptions) {
  const [report, setReport] = useState<SoundReport | null>(null);
  const analyze = useCallback(async () => {
    setStatus("Analyzing…");
    // One frame to show it: the render and the reading cover every sample.
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    const rendered = await renderEdited(doc, track, recordings, sampleRate);
    if (!rendered) {
      setStatus("This browser cannot render offline");
      return;
    }
    setReport(reportSound(rendered.channels, rendered.sampleRate));
    setStatus("");
  }, [doc, recordings, sampleRate, setStatus, track]);
  const clear = useCallback(() => setReport(null), []);
  return { analyze, clear, report };
}
