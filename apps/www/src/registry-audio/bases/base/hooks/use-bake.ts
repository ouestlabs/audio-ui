import { useCallback, useMemo } from "react";
import { renderTrackClips } from "@/registry-audio/bases/base/lib/arrangement-engine";
import type { ArrangementDoc } from "@/registry-audio/bases/base/lib/arrangement-state";
import type { RecordingSource } from "@/registry-audio/bases/base/lib/clip-player";
import {
  applySoundOperation,
  type SoundOperation,
  type SoundSamples,
  soundOperationName,
} from "@/registry-audio/bases/base/lib/sound-operations";

interface BakeOptions {
  doc: ArrangementDoc;
  /** The sound baked, as the step `label` of the history: put it on the track. */
  onBaked: (sound: SoundSamples, label: string) => void;
  recordings: ReadonlyMap<string, RecordingSource>;
  /** The rate the edited sound is rendered at. */
  sampleRate: number;
  /** What the editor says while it works: `""` when it is done. */
  setStatus: (status: string) => void;
  /** Stops what plays, before the sound under it changes. */
  stop: () => void;
  /** The track whose clips are the sound. */
  track: string;
}

/**
 * What the track's clips play over the whole arrangement, as plain channels:
 * the cuts, fades and gains made, not the track's devices. `null` in a
 * browser that cannot render offline.
 */
export async function renderEdited(
  doc: ArrangementDoc,
  track: string,
  recordings: ReadonlyMap<string, RecordingSource>,
  sampleRate: number
): Promise<SoundSamples | null> {
  const rendered = await renderTrackClips(
    doc,
    track,
    [0, doc.duration],
    recordings,
    { sampleRate }
  );
  if (!rendered) {
    return null;
  }
  return {
    channels: Array.from({ length: rendered.numberOfChannels }, (_, index) =>
      rendered.getChannelData(index)
    ),
    sampleRate: rendered.sampleRate,
  };
}

/**
 * Changes the samples of the sound as edited. `bake(label, change)` renders
 * what the track's clips play (the cuts, fades and gains already made), hands
 * its channels to `change`, and gives the result to `onBaked` as one step of
 * undo. `process(operation)` bakes one of the operations of `sound-operations`,
 * named after it. A browser that cannot render offline says so.
 */
export function useBake({
  doc,
  onBaked,
  recordings,
  sampleRate,
  setStatus,
  stop,
  track,
}: BakeOptions) {
  const bake = useCallback(
    async (
      label: string,
      change: (sound: SoundSamples) => SoundSamples | Promise<SoundSamples>
    ) => {
      setStatus(label);
      // One frame to show it: the render and the operation read every sample.
      await new Promise((resolve) => window.setTimeout(resolve, 20));
      const rendered = await renderEdited(doc, track, recordings, sampleRate);
      if (!rendered) {
        setStatus("This browser cannot render offline");
        return;
      }
      const next = await change(rendered);
      stop();
      onBaked(next, label);
      setStatus("");
    },
    [doc, onBaked, recordings, sampleRate, setStatus, stop, track]
  );
  return useMemo(
    () => ({
      bake,
      /** One operation of the Process menu, baked as a step named after it. */
      process: (operation: SoundOperation) =>
        bake(soundOperationName(operation), (sound) =>
          applySoundOperation(sound, operation)
        ),
    }),
    [bake]
  );
}
