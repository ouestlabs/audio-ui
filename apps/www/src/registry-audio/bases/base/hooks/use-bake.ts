import {
  padChannels,
  repeatChannels,
  reverseChannels,
} from "@audio-ui/engine/files";
import { useCallback, useMemo } from "react";
import { renderTrackClips } from "@/registry-audio/bases/base/lib/arrangement-engine";
import type { ArrangementDoc } from "@/registry-audio/bases/base/lib/arrangement-state";
import type { RecordingSource } from "@/registry-audio/bases/base/lib/clip-player";

/** A sound as plain samples: what an operation reads and writes. */
export interface BakedSound {
  channels: Float32Array[];
  sampleRate: number;
}

interface BakeOptions {
  doc: ArrangementDoc;
  /** The sound baked, as the step `label` of the history: put it on the track. */
  onBaked: (sound: BakedSound, label: string) => void;
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
 * Changes the samples of the sound as edited. `bake(label, change)` renders
 * what the track's clips play (the cuts, fades and gains already made), hands
 * its channels to `change`, and gives the result to `onBaked` as one step of
 * undo. `reverse`, `repeat` and `pad` are the operations of the structure of
 * a sound, each over `bake`. A browser that cannot render offline says so.
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
      change: (sound: BakedSound) => BakedSound | Promise<BakedSound>
    ) => {
      setStatus(label);
      // One frame to show it: the render and the operation read every sample.
      await new Promise((resolve) => window.setTimeout(resolve, 20));
      const rendered = await renderTrackClips(
        doc,
        track,
        [0, doc.duration],
        recordings,
        { sampleRate }
      );
      if (!rendered) {
        setStatus("This browser cannot render offline");
        return;
      }
      const next = await change({
        channels: Array.from(
          { length: rendered.numberOfChannels },
          (_, index) => rendered.getChannelData(index)
        ),
        sampleRate: rendered.sampleRate,
      });
      stop();
      onBaked(next, label);
      setStatus("");
    },
    [doc, onBaked, recordings, sampleRate, setStatus, stop, track]
  );
  return useMemo(
    () => ({
      bake,
      /** The sound played from its end. */
      reverse: () =>
        bake("Reverse", ({ channels, sampleRate: rate }) => ({
          channels: reverseChannels(channels),
          sampleRate: rate,
        })),
      /** The sound played `times` times in a row. */
      repeat: (times: number) =>
        bake(`Repeat ×${times}`, ({ channels, sampleRate: rate }) => ({
          channels: repeatChannels(channels, times),
          sampleRate: rate,
        })),
      /** Silence of `seconds` added at the start, the end, or both. */
      pad: (seconds: number, where: "both" | "end" | "start") =>
        bake(
          `Add ${seconds} s of silence`,
          ({ channels, sampleRate: rate }) => ({
            channels: padChannels(channels, {
              after: where === "start" ? 0 : seconds * rate,
              before: where === "end" ? 0 : seconds * rate,
            }),
            sampleRate: rate,
          })
        ),
    }),
    [bake]
  );
}
