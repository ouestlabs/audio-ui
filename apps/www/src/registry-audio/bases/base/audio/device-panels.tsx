import type { ParameterValue } from "@audio-ui/core/device";
import type { Tempo } from "@audio-ui/core/time";
import type { ComponentType, ReactNode } from "react";
import { AutoPanPanel } from "@/registry-audio/bases/base/devices/auto-pan/panel";
import { BassEnhancerPanel } from "@/registry-audio/bases/base/devices/bass-enhancer/panel";
import { BinauralPannerPanel } from "@/registry-audio/bases/base/devices/binaural-panner/panel";
import { ChannelEqPanel } from "@/registry-audio/bases/base/devices/channel-eq/panel";
import { ChorusPanel } from "@/registry-audio/bases/base/devices/chorus/panel";
import { CompressorPanel } from "@/registry-audio/bases/base/devices/compressor/panel";
import { DeesserPanel } from "@/registry-audio/bases/base/devices/deesser/panel";
import { DelayPanel } from "@/registry-audio/bases/base/devices/delay/panel";
import { DistortionPanel } from "@/registry-audio/bases/base/devices/distortion/panel";
import { DrumSynthPanel } from "@/registry-audio/bases/base/devices/drum-synth/panel";
import { ElectricPianoPanel } from "@/registry-audio/bases/base/devices/electric-piano/panel";
import { EqualizerPanel } from "@/registry-audio/bases/base/devices/equalizer/panel";
import { ExciterPanel } from "@/registry-audio/bases/base/devices/exciter/panel";
import { FilterPanel } from "@/registry-audio/bases/base/devices/filter/panel";
import { FmSynthPanel } from "@/registry-audio/bases/base/devices/fm-synth/panel";
import { FrequencyShifterPanel } from "@/registry-audio/bases/base/devices/frequency-shifter/panel";
import { GatePanel } from "@/registry-audio/bases/base/devices/gate/panel";
import { GraphicEqPanel } from "@/registry-audio/bases/base/devices/graphic-eq/panel";
import { GuitarPanel } from "@/registry-audio/bases/base/devices/guitar/panel";
import { LimiterPanel } from "@/registry-audio/bases/base/devices/limiter/panel";
import { LofiPanel } from "@/registry-audio/bases/base/devices/lofi/panel";
import { MidSidePanel } from "@/registry-audio/bases/base/devices/mid-side/panel";
import { MonoSynthPanel } from "@/registry-audio/bases/base/devices/mono-synth/panel";
import { MultibandPanel } from "@/registry-audio/bases/base/devices/multiband/panel";
import { OrganPanel } from "@/registry-audio/bases/base/devices/organ/panel";
import { OverdrivePanel } from "@/registry-audio/bases/base/devices/overdrive/panel";
import { PhaserPanel } from "@/registry-audio/bases/base/devices/phaser/panel";
import { PocketSynthPanel } from "@/registry-audio/bases/base/devices/pocket-synth/panel";
import { PolySynthPanel } from "@/registry-audio/bases/base/devices/poly-synth/panel";
import { ReduxPanel } from "@/registry-audio/bases/base/devices/redux/panel";
import { ReverbPanel } from "@/registry-audio/bases/base/devices/reverb/panel";
import { RotaryPanel } from "@/registry-audio/bases/base/devices/rotary/panel";
import { SamplerPanel } from "@/registry-audio/bases/base/devices/sampler/panel";
import { SaturatorPanel } from "@/registry-audio/bases/base/devices/saturator/panel";
import { StringMachinePanel } from "@/registry-audio/bases/base/devices/string-machine/panel";
import { StutterPanel } from "@/registry-audio/bases/base/devices/stutter/panel";
import { TapeKeysPanel } from "@/registry-audio/bases/base/devices/tape-keys/panel";
import { TiltEqPanel } from "@/registry-audio/bases/base/devices/tilt-eq/panel";
import { TransientPanel } from "@/registry-audio/bases/base/devices/transient/panel";
import { UtilityPanel } from "@/registry-audio/bases/base/devices/utility/panel";
import { VibePanel } from "@/registry-audio/bases/base/devices/vibe/panel";
import { WahPanel } from "@/registry-audio/bases/base/devices/wah/panel";
import { WaveShaperPanel } from "@/registry-audio/bases/base/devices/wave-shaper/panel";

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

/** A panel as the catalog holds it: its own device's state, read as any device's. */
function entry<State, Note = never>(
  Panel: ComponentType<{
    activeNotes?: readonly number[];
    children?: ReactNode;
    className?: string;
    onNoteOff?: () => void;
    onNoteOn?: (note: Note) => void;
    onValueChange: (state: State) => void;
    tempo?: Tempo;
    value: State;
  }>,
  width = "w-80"
): DevicePanelEntry {
  return { Panel: Panel as unknown as DevicePanelEntry["Panel"], width };
}

/**
 * Every device's panel, by the device's stable id, such as
 * `audioui.compressor`: what draws a device on a track's chain with the face it
 * has on its own page. Pairs with `device-library`, which makes its engine.
 */
export const DEVICE_PANELS: Readonly<Record<string, DevicePanelEntry>> = {
  "audioui.auto-pan": entry(AutoPanPanel),
  "audioui.channel-eq": entry(ChannelEqPanel),
  "audioui.chorus": entry(ChorusPanel),
  "audioui.compressor": entry(CompressorPanel, "w-96"),
  "audioui.deesser": entry(DeesserPanel),
  "audioui.delay": entry(DelayPanel, "w-[28rem]"),
  "audioui.distortion": entry(DistortionPanel, "w-96"),
  "audioui.electric-piano": entry(ElectricPianoPanel, "w-[32rem]"),
  "audioui.equalizer": entry(EqualizerPanel, "w-96"),
  "audioui.filter": entry(FilterPanel),
  "audioui.fm-synth": entry(FmSynthPanel, "w-[52rem]"),
  "audioui.gate": entry(GatePanel),
  "audioui.binaural-panner": entry(BinauralPannerPanel),
  "audioui.stutter": entry(StutterPanel),
  "audioui.rotary": entry(RotaryPanel, "w-96"),
  "audioui.bass-enhancer": entry(BassEnhancerPanel),
  "audioui.exciter": entry(ExciterPanel),
  "audioui.frequency-shifter": entry(FrequencyShifterPanel, "w-96"),
  "audioui.wah": entry(WahPanel, "w-[32rem]"),
  "audioui.graphic-eq": entry(GraphicEqPanel, "w-[28rem]"),
  "audioui.tilt-eq": entry(TiltEqPanel),
  "audioui.limiter": entry(LimiterPanel),
  "audioui.mid-side": entry(MidSidePanel),
  "audioui.mono-synth": entry(MonoSynthPanel, "w-[40rem]"),
  "audioui.organ": entry(OrganPanel, "w-[44rem]"),
  "audioui.string-machine": entry(StringMachinePanel, "w-[36rem]"),
  "audioui.tape-keys": entry(TapeKeysPanel, "w-[32rem]"),
  "audioui.guitar": entry(GuitarPanel, "w-[30rem]"),
  "audioui.drum-synth": entry(DrumSynthPanel, "w-[26rem]"),
  "audioui.multiband": entry(MultibandPanel, "w-96"),
  "audioui.overdrive": entry(OverdrivePanel),
  "audioui.phaser": entry(PhaserPanel, "w-[28rem]"),
  "audioui.pocket-synth": entry(PocketSynthPanel),
  "audioui.poly-synth": entry(PolySynthPanel, "w-[40rem]"),
  "audioui.redux": entry(ReduxPanel),
  "audioui.lofi": entry(LofiPanel),
  "audioui.reverb": entry(ReverbPanel),
  "audioui.sampler": entry(SamplerPanel, "w-[32rem]"),
  "audioui.saturator": entry(SaturatorPanel),
  "audioui.transient": entry(TransientPanel),
  "audioui.utility": entry(UtilityPanel),
  "audioui.vibe": entry(VibePanel),
  "audioui.wave-shaper": entry(WaveShaperPanel),
};

/** The panel of the device with the stable id `id`. */
export function devicePanel(id: string): DevicePanelEntry | undefined {
  return DEVICE_PANELS[id];
}
