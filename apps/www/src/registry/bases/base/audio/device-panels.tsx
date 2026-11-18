import { type ComponentType, lazy, type ReactNode } from "react";
import type { ParameterValue } from "@/engine/device";
import type { Tempo } from "@/engine/time";
import type { DeviceSignal } from "@/registry/bases/base/lib/device-signal";

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
  /** The device's live sound, from its engine: what goes in and comes out, and what it reports of itself, drawn on its face. Without it the face shows its settings only. */
  signal?: DeviceSignal;
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
    import("@/registry/bases/base/devices/auto-pan/panel").then(
      (m) => m.AutoPanPanel
    )
  ),
  "audioui.channel-eq": entry(() =>
    import("@/registry/bases/base/devices/channel-eq/panel").then(
      (m) => m.ChannelEqPanel
    )
  ),
  "audioui.chorus": entry(() =>
    import("@/registry/bases/base/devices/chorus/panel").then(
      (m) => m.ChorusPanel
    )
  ),
  "audioui.compressor": entry(
    () =>
      import("@/registry/bases/base/devices/compressor/panel").then(
        (m) => m.CompressorPanel
      ),
    "w-96"
  ),
  "audioui.deesser": entry(() =>
    import("@/registry/bases/base/devices/deesser/panel").then(
      (m) => m.DeesserPanel
    )
  ),
  "audioui.delay": entry(
    () =>
      import("@/registry/bases/base/devices/delay/panel").then(
        (m) => m.DelayPanel
      ),
    "w-[28rem]"
  ),
  "audioui.distortion": entry(
    () =>
      import("@/registry/bases/base/devices/distortion/panel").then(
        (m) => m.DistortionPanel
      ),
    "w-96"
  ),
  "audioui.electric-piano": entry(
    () =>
      import("@/registry/bases/base/devices/electric-piano/panel").then(
        (m) => m.ElectricPianoPanel
      ),
    "w-[32rem]"
  ),
  "audioui.equalizer": entry(
    () =>
      import("@/registry/bases/base/devices/equalizer/panel").then(
        (m) => m.EqualizerPanel
      ),
    "w-96"
  ),
  "audioui.filter": entry(() =>
    import("@/registry/bases/base/devices/filter/panel").then(
      (m) => m.FilterPanel
    )
  ),
  "audioui.fm-synth": entry(
    () =>
      import("@/registry/bases/base/devices/fm-synth/panel").then(
        (m) => m.FmSynthPanel
      ),
    "w-[52rem]"
  ),
  "audioui.gate": entry(() =>
    import("@/registry/bases/base/devices/gate/panel").then((m) => m.GatePanel)
  ),
  "audioui.unlimiter": entry(() =>
    import("@/registry/bases/base/devices/unlimiter/panel").then(
      (m) => m.UnlimiterPanel
    )
  ),
  "audioui.compander": entry(() =>
    import("@/registry/bases/base/devices/compander/panel").then(
      (m) => m.CompanderPanel
    )
  ),
  "audioui.ducker": entry(() =>
    import("@/registry/bases/base/devices/ducker/panel").then(
      (m) => m.DuckerPanel
    )
  ),
  "audioui.expander": entry(() =>
    import("@/registry/bases/base/devices/expander/panel").then(
      (m) => m.ExpanderPanel
    )
  ),
  "audioui.binaural-panner": entry(() =>
    import("@/registry/bases/base/devices/binaural-panner/panel").then(
      (m) => m.BinauralPannerPanel
    )
  ),
  "audioui.stutter": entry(() =>
    import("@/registry/bases/base/devices/stutter/panel").then(
      (m) => m.StutterPanel
    )
  ),
  "audioui.rotary": entry(
    () =>
      import("@/registry/bases/base/devices/rotary/panel").then(
        (m) => m.RotaryPanel
      ),
    "w-96"
  ),
  "audioui.bass-enhancer": entry(() =>
    import("@/registry/bases/base/devices/bass-enhancer/panel").then(
      (m) => m.BassEnhancerPanel
    )
  ),
  "audioui.exciter": entry(() =>
    import("@/registry/bases/base/devices/exciter/panel").then(
      (m) => m.ExciterPanel
    )
  ),
  "audioui.frequency-shifter": entry(
    () =>
      import("@/registry/bases/base/devices/frequency-shifter/panel").then(
        (m) => m.FrequencyShifterPanel
      ),
    "w-96"
  ),
  "audioui.wah": entry(
    () =>
      import("@/registry/bases/base/devices/wah/panel").then((m) => m.WahPanel),
    "w-[32rem]"
  ),
  "audioui.graphic-eq": entry(
    () =>
      import("@/registry/bases/base/devices/graphic-eq/panel").then(
        (m) => m.GraphicEqPanel
      ),
    "w-[28rem]"
  ),
  "audioui.tilt-eq": entry(() =>
    import("@/registry/bases/base/devices/tilt-eq/panel").then(
      (m) => m.TiltEqPanel
    )
  ),
  "audioui.limiter": entry(() =>
    import("@/registry/bases/base/devices/limiter/panel").then(
      (m) => m.LimiterPanel
    )
  ),
  "audioui.mid-side": entry(() =>
    import("@/registry/bases/base/devices/mid-side/panel").then(
      (m) => m.MidSidePanel
    )
  ),
  "audioui.mono-synth": entry(
    () =>
      import("@/registry/bases/base/devices/mono-synth/panel").then(
        (m) => m.MonoSynthPanel
      ),
    "w-[40rem]"
  ),
  "audioui.organ": entry(
    () =>
      import("@/registry/bases/base/devices/organ/panel").then(
        (m) => m.OrganPanel
      ),
    "w-[44rem]"
  ),
  "audioui.string-machine": entry(
    () =>
      import("@/registry/bases/base/devices/string-machine/panel").then(
        (m) => m.StringMachinePanel
      ),
    "w-[36rem]"
  ),
  "audioui.tape-keys": entry(
    () =>
      import("@/registry/bases/base/devices/tape-keys/panel").then(
        (m) => m.TapeKeysPanel
      ),
    "w-[32rem]"
  ),
  "audioui.guitar": entry(
    () =>
      import("@/registry/bases/base/devices/guitar/panel").then(
        (m) => m.GuitarPanel
      ),
    "w-[30rem]"
  ),
  "audioui.drum-synth": entry(
    () =>
      import("@/registry/bases/base/devices/drum-synth/panel").then(
        (m) => m.DrumSynthPanel
      ),
    "w-[26rem]"
  ),
  "audioui.multiband": entry(
    () =>
      import("@/registry/bases/base/devices/multiband/panel").then(
        (m) => m.MultibandPanel
      ),
    "w-96"
  ),
  "audioui.overdrive": entry(() =>
    import("@/registry/bases/base/devices/overdrive/panel").then(
      (m) => m.OverdrivePanel
    )
  ),
  "audioui.phaser": entry(
    () =>
      import("@/registry/bases/base/devices/phaser/panel").then(
        (m) => m.PhaserPanel
      ),
    "w-[28rem]"
  ),
  "audioui.pocket-synth": entry(() =>
    import("@/registry/bases/base/devices/pocket-synth/panel").then(
      (m) => m.PocketSynthPanel
    )
  ),
  "audioui.poly-synth": entry(
    () =>
      import("@/registry/bases/base/devices/poly-synth/panel").then(
        (m) => m.PolySynthPanel
      ),
    "w-[40rem]"
  ),
  "audioui.redux": entry(() =>
    import("@/registry/bases/base/devices/redux/panel").then(
      (m) => m.ReduxPanel
    )
  ),
  "audioui.lofi": entry(() =>
    import("@/registry/bases/base/devices/lofi/panel").then((m) => m.LofiPanel)
  ),
  "audioui.reverb": entry(() =>
    import("@/registry/bases/base/devices/reverb/panel").then(
      (m) => m.ReverbPanel
    )
  ),
  "audioui.sampler": entry(
    () =>
      import("@/registry/bases/base/devices/sampler/panel").then(
        (m) => m.SamplerPanel
      ),
    "w-[32rem]"
  ),
  "audioui.saturator": entry(() =>
    import("@/registry/bases/base/devices/saturator/panel").then(
      (m) => m.SaturatorPanel
    )
  ),
  "audioui.transient": entry(() =>
    import("@/registry/bases/base/devices/transient/panel").then(
      (m) => m.TransientPanel
    )
  ),
  "audioui.utility": entry(() =>
    import("@/registry/bases/base/devices/utility/panel").then(
      (m) => m.UtilityPanel
    )
  ),
  "audioui.vibe": entry(() =>
    import("@/registry/bases/base/devices/vibe/panel").then((m) => m.VibePanel)
  ),
  "audioui.wave-shaper": entry(() =>
    import("@/registry/bases/base/devices/wave-shaper/panel").then(
      (m) => m.WaveShaperPanel
    )
  ),
};

/** The panel of the device with the stable id `id`. */
export function devicePanel(id: string): DevicePanelEntry | undefined {
  return DEVICE_PANELS[id];
}
