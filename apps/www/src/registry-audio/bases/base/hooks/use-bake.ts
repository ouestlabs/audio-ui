import {
  type FilterType,
  filterChannels,
  type NormalizeTarget,
  normalizeChannels,
  padChannels,
  panChannels,
  repeatChannels,
  reverseChannels,
  type ShiftMethod,
  type StretchMethod,
  shiftChannels,
  speedChannels,
  stretchChannels,
} from "@audio-ui/engine/files";
import {
  formatFrequency,
  formatLevel,
  formatPan,
} from "@audio-ui/engine/format";
import { useCallback, useMemo } from "react";
import { renderTrackClips } from "@/registry-audio/bases/base/lib/arrangement-engine";
import type { ArrangementDoc } from "@/registry-audio/bases/base/lib/arrangement-state";
import type { RecordingSource } from "@/registry-audio/bases/base/lib/clip-player";

const FILTER_NAMES = {
  highpass: "High-pass",
  lowpass: "Low-pass",
  notch: "Notch",
} as const;

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
 * undo. `reverse`, `repeat` and `pad` change the structure of a sound;
 * `normalize`, `pan` and `filter` its level, balance and tone; `stretch`,
 * `shift` and `speed` its time and pitch; each is over `bake`. A browser that cannot render offline says so.
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
      /** The sound's tone: a filter of `type` at `frequency`, in hertz. */
      filter: (type: FilterType, frequency: number) =>
        bake(
          `${FILTER_NAMES[type]} at ${formatFrequency(frequency)}`,
          ({ channels, sampleRate: rate }) => ({
            channels: filterChannels(channels, rate, { frequency, type }),
            sampleRate: rate,
          })
        ),
      /** The sound `factor` times as long at the same pitch, by `method`. */
      stretch: (factor: number, method: StretchMethod) =>
        bake(
          `Stretch to ${Math.round(factor * 100)} %`,
          ({ channels, sampleRate: rate }) => ({
            channels: stretchChannels(channels, rate, { factor, method }),
            sampleRate: rate,
          })
        ),
      /** The pitch `semitones` higher or lower at the same length, by `method`. */
      shift: (semitones: number, method: ShiftMethod) =>
        bake(
          `Pitch ${semitones > 0 ? "+" : ""}${semitones} st`,
          ({ channels, sampleRate: rate }) => ({
            channels: shiftChannels(channels, rate, { method, semitones }),
            sampleRate: rate,
          })
        ),
      /** The sound `speed` times as fast, its pitch moving with it. */
      speed: (speed: number) =>
        bake(`Speed ×${speed}`, ({ channels, sampleRate: rate }) => ({
          channels: speedChannels(channels, rate, speed),
          sampleRate: rate,
        })),
      /** One gain on every channel, to a peak in dBFS or a loudness in LUFS. */
      normalize: (target: NormalizeTarget) =>
        bake(
          `Normalize to ${
            "peak" in target
              ? formatLevel(target.peak, "dBFS")
              : formatLevel(target.lufs, "LUFS")
          }`,
          ({ channels, sampleRate: rate }) => ({
            channels: normalizeChannels(channels, rate, target),
            sampleRate: rate,
          })
        ),
      /** A stereo sound's balance, from -1 (left) to 1 (right). */
      pan: (pan: number) =>
        bake(`Pan ${formatPan(pan)}`, ({ channels, sampleRate: rate }) => ({
          channels: panChannels(channels, pan),
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
