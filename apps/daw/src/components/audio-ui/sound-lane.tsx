import type { SpectrogramScale } from "@audio-ui/gl/spectrogram";
import type { WaveformClip, WaveformLayout } from "@audio-ui/gl/waveform";
import { createSource } from "@audio-ui/react";
import { type ComponentProps, useState } from "react";
import {
  SpectrogramAxis,
  type SpectrogramBand,
  SpectrogramLane,
} from "@/components/audio-ui/clip-spectrogram";
import { WaveformLane } from "@/components/audio-ui/waveform-lane";

/** How a sound lane draws its clips: the waveform, the waveform by band, or the spectrogram on one of its frequency axes. */
export type SoundView = "bands" | "wave" | SpectrogramScale;

/** The views a sound lane draws, labelled for a menu: the waveforms first, then the spectrogram on each axis. */
export const SOUND_VIEWS: readonly {
  label: string;
  note: string;
  value: SoundView;
}[] = [
  { label: "Waveform", note: "Level over time", value: "wave" },
  { label: "Waveform, by band", note: "Lows, mids, highs", value: "bands" },
  { label: "Spectrogram", note: "Octaves", value: "log" },
  { label: "Spectrogram, mel", note: "Pitch scale", value: "mel" },
  { label: "Spectrogram, ERB", note: "Hearing filters", value: "erb" },
  { label: "Spectrogram, hertz", note: "Linear", value: "lin" },
];

/** Whether a string is one of the views, as a menu's value comes back. */
export const isSoundView = (value: string): value is SoundView =>
  SOUND_VIEWS.some((each) => each.value === value);

/** Whether a view draws the spectrogram. */
export const isSpectrogramView = (view: SoundView): view is SpectrogramScale =>
  view !== "wave" && view !== "bands";

/**
 * A lane's clips drawn on the GPU in the view you pick: their waveforms
 * (`WaveformLane`), the waveforms by band, or their spectrograms
 * (`SpectrogramLane`) with the frequency axis down the lane's left edge and
 * the frequency and level under the pointer. Put it in the lane's box, `zoom`
 * being the lane's pixels a second. Clips without `bands` are drawn plain in
 * the band view. It keeps the frequencies shown itself unless given `band`, and
 * needs WebGL 2: `hasWebGL2` of `@audio-ui/gl/lane` says whether to draw this
 * way at all.
 */
function SoundLane({
  band,
  className,
  clips,
  layout = "auto",
  view,
  zoom,
  ...props
}: Omit<ComponentProps<"canvas">, "ref"> & {
  /** The frequencies a spectrogram shows, as shares of its axis: give one to keep it outside, as it is kept across views. */
  band?: SpectrogramBand;
  clips: readonly WaveformClip[];
  /** How a recording's channels are laid out in the waveform: a row each once the rows are tall enough to read (`auto`), always (`split`) or never (`mix`). @default "auto" */
  layout?: WaveformLayout;
  view: SoundView;
  /** The lane's pixels a second. */
  zoom: number;
}) {
  const [shown] = useState(() =>
    createSource<readonly [number, number]>([0, 1])
  );
  // The frequency under the pointer, from the picture to the axis.
  const [pointer] = useState(() => createSource<number | null>(null));
  const [first] = clips;
  if (isSpectrogramView(view)) {
    return (
      <>
        {first ? (
          <SpectrogramAxis
            band={band ?? shown}
            pointer={pointer}
            sampleRate={first.sampleRate}
            scale={view}
          />
        ) : null}
        <SpectrogramLane
          band={band ?? shown}
          className={className}
          clips={clips}
          pointerHertz={pointer}
          scale={view}
          zoom={zoom}
          {...props}
        />
      </>
    );
  }
  return (
    <WaveformLane
      className={className}
      clips={clips}
      layout={layout}
      look={view === "bands" ? "bands" : "plain"}
      zoom={zoom}
      {...props}
    />
  );
}

export { SoundLane };
