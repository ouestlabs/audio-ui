import type { ParameterValue } from "@audio-ui/engine/device";
import type { Tempo } from "@audio-ui/engine/time";
import { type ComponentType, lazy, type ReactNode } from "react";

/** What every device's panel takes: its state, what changes it, and what a host puts in its title bar. */
export interface DevicePanelProps {
  /** For an instrument's panel with keys or pads: the notes held now, such as on a MIDI keyboard, which light up. */
  activeNotes?: readonly number[];
  /** What the host puts at the end of the title bar: a chain's controls, a play button. */
  children?: ReactNode;
  className?: string;
  /** For an instrument's panel that plays it, such as a pad: its pad let go. */
  onNoteOff?: () => void;
  /** For an instrument's panel that plays it, such as a pad: a note, by the instrument's note parameters, called again as it moves. */
  onNoteOn?: (note: Readonly<Record<string, number>>) => void;
  onValueChange: (state: Readonly<Record<string, ParameterValue>>) => void;
  /** For the panels that show a time in notes: the tempo it is read against. */
  tempo?: Tempo;
  value: Readonly<Record<string, ParameterValue>>;
}

/** A device's own face, and how wide it is drawn in a row of devices. */
export interface DevicePanelEntry {
  Panel: ComponentType<DevicePanelProps>;
  width: string;
}

/** A panel as the catalog holds it: its own device's state, read as any device's, loaded the first time it is drawn, so a host loads the panels of the devices it shows and no other. */
function entry(
  load: () => Promise<ComponentType<never>>,
  width = "w-80"
): DevicePanelEntry {
  return {
    Panel: lazy(async () => ({
      default: (await load()) as unknown as DevicePanelEntry["Panel"],
    })),
    width,
  };
}

/**
 * Every device's panel, by the device's stable id, such as
 * `audioui.compressor`: what draws a device on a track's chain with the face it
 * has on its own page. Pairs with `device-library`, which makes its engine.
 * Each panel loads the first time it is drawn: draw it inside a `Suspense`.
 */
export const DEVICE_PANELS: Readonly<Record<string, DevicePanelEntry>> = {
  "audioui.auto-pan": entry(() =>
    import("@/components/audio-ui/devices/auto-pan/panel").then(
      (m) => m.AutoPanPanel
    )
  ),
  "audioui.channel-eq": entry(() =>
    import("@/components/audio-ui/devices/channel-eq/panel").then(
      (m) => m.ChannelEqPanel
    )
  ),
  "audioui.chorus": entry(() =>
    import("@/components/audio-ui/devices/chorus/panel").then(
      (m) => m.ChorusPanel
    )
  ),
  "audioui.compressor": entry(
    () =>
      import("@/components/audio-ui/devices/compressor/panel").then(
        (m) => m.CompressorPanel
      ),
    "w-96"
  ),
  "audioui.deesser": entry(() =>
    import("@/components/audio-ui/devices/deesser/panel").then(
      (m) => m.DeesserPanel
    )
  ),
  "audioui.delay": entry(
    () =>
      import("@/components/audio-ui/devices/delay/panel").then(
        (m) => m.DelayPanel
      ),
    "w-[28rem]"
  ),
  "audioui.distortion": entry(
    () =>
      import("@/components/audio-ui/devices/distortion/panel").then(
        (m) => m.DistortionPanel
      ),
    "w-96"
  ),
  "audioui.electric-piano": entry(
    () =>
      import("@/components/audio-ui/devices/electric-piano/panel").then(
        (m) => m.ElectricPianoPanel
      ),
    "w-[32rem]"
  ),
  "audioui.equalizer": entry(
    () =>
      import("@/components/audio-ui/devices/equalizer/panel").then(
        (m) => m.EqualizerPanel
      ),
    "w-96"
  ),
  "audioui.filter": entry(() =>
    import("@/components/audio-ui/devices/filter/panel").then(
      (m) => m.FilterPanel
    )
  ),
  "audioui.fm-synth": entry(
    () =>
      import("@/components/audio-ui/devices/fm-synth/panel").then(
        (m) => m.FmSynthPanel
      ),
    "w-[52rem]"
  ),
  "audioui.gate": entry(() =>
    import("@/components/audio-ui/devices/gate/panel").then((m) => m.GatePanel)
  ),
  "audioui.unlimiter": entry(() =>
    import("@/components/audio-ui/devices/unlimiter/panel").then(
      (m) => m.UnlimiterPanel
    )
  ),
  "audioui.compander": entry(() =>
    import("@/components/audio-ui/devices/compander/panel").then(
      (m) => m.CompanderPanel
    )
  ),
  "audioui.ducker": entry(() =>
    import("@/components/audio-ui/devices/ducker/panel").then(
      (m) => m.DuckerPanel
    )
  ),
  "audioui.expander": entry(() =>
    import("@/components/audio-ui/devices/expander/panel").then(
      (m) => m.ExpanderPanel
    )
  ),
  "audioui.binaural-panner": entry(() =>
    import("@/components/audio-ui/devices/binaural-panner/panel").then(
      (m) => m.BinauralPannerPanel
    )
  ),
  "audioui.stutter": entry(() =>
    import("@/components/audio-ui/devices/stutter/panel").then(
      (m) => m.StutterPanel
    )
  ),
  "audioui.rotary": entry(
    () =>
      import("@/components/audio-ui/devices/rotary/panel").then(
        (m) => m.RotaryPanel
      ),
    "w-96"
  ),
  "audioui.bass-enhancer": entry(() =>
    import("@/components/audio-ui/devices/bass-enhancer/panel").then(
      (m) => m.BassEnhancerPanel
    )
  ),
  "audioui.exciter": entry(() =>
    import("@/components/audio-ui/devices/exciter/panel").then(
      (m) => m.ExciterPanel
    )
  ),
  "audioui.frequency-shifter": entry(
    () =>
      import("@/components/audio-ui/devices/frequency-shifter/panel").then(
        (m) => m.FrequencyShifterPanel
      ),
    "w-96"
  ),
  "audioui.wah": entry(
    () =>
      import("@/components/audio-ui/devices/wah/panel").then((m) => m.WahPanel),
    "w-[32rem]"
  ),
  "audioui.graphic-eq": entry(
    () =>
      import("@/components/audio-ui/devices/graphic-eq/panel").then(
        (m) => m.GraphicEqPanel
      ),
    "w-[28rem]"
  ),
  "audioui.tilt-eq": entry(() =>
    import("@/components/audio-ui/devices/tilt-eq/panel").then(
      (m) => m.TiltEqPanel
    )
  ),
  "audioui.limiter": entry(() =>
    import("@/components/audio-ui/devices/limiter/panel").then(
      (m) => m.LimiterPanel
    )
  ),
  "audioui.mid-side": entry(() =>
    import("@/components/audio-ui/devices/mid-side/panel").then(
      (m) => m.MidSidePanel
    )
  ),
  "audioui.mono-synth": entry(
    () =>
      import("@/components/audio-ui/devices/mono-synth/panel").then(
        (m) => m.MonoSynthPanel
      ),
    "w-[40rem]"
  ),
  "audioui.organ": entry(
    () =>
      import("@/components/audio-ui/devices/organ/panel").then(
        (m) => m.OrganPanel
      ),
    "w-[44rem]"
  ),
  "audioui.string-machine": entry(
    () =>
      import("@/components/audio-ui/devices/string-machine/panel").then(
        (m) => m.StringMachinePanel
      ),
    "w-[36rem]"
  ),
  "audioui.tape-keys": entry(
    () =>
      import("@/components/audio-ui/devices/tape-keys/panel").then(
        (m) => m.TapeKeysPanel
      ),
    "w-[32rem]"
  ),
  "audioui.guitar": entry(
    () =>
      import("@/components/audio-ui/devices/guitar/panel").then(
        (m) => m.GuitarPanel
      ),
    "w-[30rem]"
  ),
  "audioui.drum-synth": entry(
    () =>
      import("@/components/audio-ui/devices/drum-synth/panel").then(
        (m) => m.DrumSynthPanel
      ),
    "w-[26rem]"
  ),
  "audioui.multiband": entry(
    () =>
      import("@/components/audio-ui/devices/multiband/panel").then(
        (m) => m.MultibandPanel
      ),
    "w-96"
  ),
  "audioui.overdrive": entry(() =>
    import("@/components/audio-ui/devices/overdrive/panel").then(
      (m) => m.OverdrivePanel
    )
  ),
  "audioui.phaser": entry(
    () =>
      import("@/components/audio-ui/devices/phaser/panel").then(
        (m) => m.PhaserPanel
      ),
    "w-[28rem]"
  ),
  "audioui.pocket-synth": entry(() =>
    import("@/components/audio-ui/devices/pocket-synth/panel").then(
      (m) => m.PocketSynthPanel
    )
  ),
  "audioui.poly-synth": entry(
    () =>
      import("@/components/audio-ui/devices/poly-synth/panel").then(
        (m) => m.PolySynthPanel
      ),
    "w-[40rem]"
  ),
  "audioui.redux": entry(() =>
    import("@/components/audio-ui/devices/redux/panel").then(
      (m) => m.ReduxPanel
    )
  ),
  "audioui.lofi": entry(() =>
    import("@/components/audio-ui/devices/lofi/panel").then((m) => m.LofiPanel)
  ),
  "audioui.reverb": entry(() =>
    import("@/components/audio-ui/devices/reverb/panel").then(
      (m) => m.ReverbPanel
    )
  ),
  "audioui.sampler": entry(
    () =>
      import("@/components/audio-ui/devices/sampler/panel").then(
        (m) => m.SamplerPanel
      ),
    "w-[32rem]"
  ),
  "audioui.saturator": entry(() =>
    import("@/components/audio-ui/devices/saturator/panel").then(
      (m) => m.SaturatorPanel
    )
  ),
  "audioui.transient": entry(() =>
    import("@/components/audio-ui/devices/transient/panel").then(
      (m) => m.TransientPanel
    )
  ),
  "audioui.utility": entry(() =>
    import("@/components/audio-ui/devices/utility/panel").then(
      (m) => m.UtilityPanel
    )
  ),
  "audioui.vibe": entry(() =>
    import("@/components/audio-ui/devices/vibe/panel").then((m) => m.VibePanel)
  ),
  "audioui.wave-shaper": entry(() =>
    import("@/components/audio-ui/devices/wave-shaper/panel").then(
      (m) => m.WaveShaperPanel
    )
  ),
};

/** The panel of the device with the stable id `id`. */
export function devicePanel(id: string): DevicePanelEntry | undefined {
  return DEVICE_PANELS[id];
}
