import type { ParameterValue } from "@audio-ui/core/device";
import type { Tempo } from "@audio-ui/core/time";
import type { ComponentType, ReactNode } from "react";
import { AutoPanPanel } from "@/components/audio-ui/devices/auto-pan/panel";
import { ChannelEqPanel } from "@/components/audio-ui/devices/channel-eq/panel";
import { ChorusPanel } from "@/components/audio-ui/devices/chorus/panel";
import { CompressorPanel } from "@/components/audio-ui/devices/compressor/panel";
import { DeesserPanel } from "@/components/audio-ui/devices/deesser/panel";
import { DelayPanel } from "@/components/audio-ui/devices/delay/panel";
import { DistortionPanel } from "@/components/audio-ui/devices/distortion/panel";
import { EqualizerPanel } from "@/components/audio-ui/devices/equalizer/panel";
import { FilterPanel } from "@/components/audio-ui/devices/filter/panel";
import { GatePanel } from "@/components/audio-ui/devices/gate/panel";
import { LimiterPanel } from "@/components/audio-ui/devices/limiter/panel";
import { MidSidePanel } from "@/components/audio-ui/devices/mid-side/panel";
import { MultibandPanel } from "@/components/audio-ui/devices/multiband/panel";
import { OverdrivePanel } from "@/components/audio-ui/devices/overdrive/panel";
import { PhaserPanel } from "@/components/audio-ui/devices/phaser/panel";
import { PocketSynthPanel } from "@/components/audio-ui/devices/pocket-synth/panel";
import { ReduxPanel } from "@/components/audio-ui/devices/redux/panel";
import { ReverbPanel } from "@/components/audio-ui/devices/reverb/panel";
import { SaturatorPanel } from "@/components/audio-ui/devices/saturator/panel";
import { TransientPanel } from "@/components/audio-ui/devices/transient/panel";
import { UtilityPanel } from "@/components/audio-ui/devices/utility/panel";
import { WaveShaperPanel } from "@/components/audio-ui/devices/wave-shaper/panel";

/** What every device's panel takes: its state, what changes it, and what a host puts in its title bar. */
export interface DevicePanelProps {
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
  "audioui.delay": entry(DelayPanel),
  "audioui.distortion": entry(DistortionPanel),
  "audioui.equalizer": entry(EqualizerPanel, "w-96"),
  "audioui.filter": entry(FilterPanel),
  "audioui.gate": entry(GatePanel),
  "audioui.limiter": entry(LimiterPanel),
  "audioui.mid-side": entry(MidSidePanel),
  "audioui.multiband": entry(MultibandPanel, "w-96"),
  "audioui.overdrive": entry(OverdrivePanel),
  "audioui.phaser": entry(PhaserPanel, "w-[28rem]"),
  "audioui.pocket-synth": entry(PocketSynthPanel),
  "audioui.redux": entry(ReduxPanel),
  "audioui.reverb": entry(ReverbPanel),
  "audioui.saturator": entry(SaturatorPanel),
  "audioui.transient": entry(TransientPanel),
  "audioui.utility": entry(UtilityPanel),
  "audioui.wave-shaper": entry(WaveShaperPanel),
};

/** The panel of the device with the stable id `id`. */
export function devicePanel(id: string): DevicePanelEntry | undefined {
  return DEVICE_PANELS[id];
}