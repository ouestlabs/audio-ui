import type {
  Device,
  DeviceContext,
  DeviceState,
  NoteTiming,
  ParameterDescriptor,
  ParameterValue,
} from "@audio-ui/core/device";
import { autoPanDevice } from "@/components/audio-ui/devices/auto-pan/device";
import { createAutoPanEngine } from "@/components/audio-ui/devices/auto-pan/engine";
import { channelEqDevice } from "@/components/audio-ui/devices/channel-eq/device";
import { createChannelEqEngine } from "@/components/audio-ui/devices/channel-eq/engine";
import { chorusDevice } from "@/components/audio-ui/devices/chorus/device";
import { createChorusEngine } from "@/components/audio-ui/devices/chorus/engine";
import { compressorDevice } from "@/components/audio-ui/devices/compressor/device";
import { createCompressorEngine } from "@/components/audio-ui/devices/compressor/engine";
import { deesserDevice } from "@/components/audio-ui/devices/deesser/device";
import { createDeesserEngine } from "@/components/audio-ui/devices/deesser/engine";
import { delayDevice } from "@/components/audio-ui/devices/delay/device";
import { createDelayEngine } from "@/components/audio-ui/devices/delay/engine";
import { distortionDevice } from "@/components/audio-ui/devices/distortion/device";
import { createDistortionEngine } from "@/components/audio-ui/devices/distortion/engine";
import { electricPianoDevice } from "@/components/audio-ui/devices/electric-piano/device";
import { createElectricPianoEngine } from "@/components/audio-ui/devices/electric-piano/engine";
import { equalizerDevice } from "@/components/audio-ui/devices/equalizer/device";
import { createEqualizerEngine } from "@/components/audio-ui/devices/equalizer/engine";
import { filterDevice } from "@/components/audio-ui/devices/filter/device";
import { createFilterEngine } from "@/components/audio-ui/devices/filter/engine";
import { fmSynthDevice } from "@/components/audio-ui/devices/fm-synth/device";
import { createFmSynthEngine } from "@/components/audio-ui/devices/fm-synth/engine";
import { gateDevice } from "@/components/audio-ui/devices/gate/device";
import { createGateEngine } from "@/components/audio-ui/devices/gate/engine";
import { limiterDevice } from "@/components/audio-ui/devices/limiter/device";
import { createLimiterEngine } from "@/components/audio-ui/devices/limiter/engine";
import { midSideDevice } from "@/components/audio-ui/devices/mid-side/device";
import { createMidSideEngine } from "@/components/audio-ui/devices/mid-side/engine";
import { monoSynthDevice } from "@/components/audio-ui/devices/mono-synth/device";
import { createMonoSynthEngine } from "@/components/audio-ui/devices/mono-synth/engine";
import { multibandDevice } from "@/components/audio-ui/devices/multiband/device";
import { createMultibandEngine } from "@/components/audio-ui/devices/multiband/engine";
import { organDevice } from "@/components/audio-ui/devices/organ/device";
import { createOrganEngine } from "@/components/audio-ui/devices/organ/engine";
import { overdriveDevice } from "@/components/audio-ui/devices/overdrive/device";
import { createOverdriveEngine } from "@/components/audio-ui/devices/overdrive/engine";
import { phaserDevice } from "@/components/audio-ui/devices/phaser/device";
import { createPhaserEngine } from "@/components/audio-ui/devices/phaser/engine";
import { pocketSynthDevice } from "@/components/audio-ui/devices/pocket-synth/device";
import { createPocketSynthEngine } from "@/components/audio-ui/devices/pocket-synth/engine";
import { polySynthDevice } from "@/components/audio-ui/devices/poly-synth/device";
import { createPolySynthEngine } from "@/components/audio-ui/devices/poly-synth/engine";
import { reduxDevice } from "@/components/audio-ui/devices/redux/device";
import { createReduxEngine } from "@/components/audio-ui/devices/redux/engine";
import { reverbDevice } from "@/components/audio-ui/devices/reverb/device";
import { createReverbEngine } from "@/components/audio-ui/devices/reverb/engine";
import { samplerDevice } from "@/components/audio-ui/devices/sampler/device";
import { createSamplerEngine } from "@/components/audio-ui/devices/sampler/engine";
import { saturatorDevice } from "@/components/audio-ui/devices/saturator/device";
import { createSaturatorEngine } from "@/components/audio-ui/devices/saturator/engine";
import { transientDevice } from "@/components/audio-ui/devices/transient/device";
import { createTransientEngine } from "@/components/audio-ui/devices/transient/engine";
import { utilityDevice } from "@/components/audio-ui/devices/utility/device";
import { createUtilityEngine } from "@/components/audio-ui/devices/utility/engine";
import { waveShaperDevice } from "@/components/audio-ui/devices/wave-shaper/device";
import { createWaveShaperEngine } from "@/components/audio-ui/devices/wave-shaper/engine";

/** A device's state as a host keeps it: a value for each parameter id. */
export type AnyDeviceState = Readonly<Record<string, ParameterValue>>;

/** What a host needs of a device's engine to put it on a track. */
export interface LibraryEngine {
  dispose: () => void;
  /** Where an effect takes the sound in; an instrument has none. */
  readonly input?: AudioNode;
  /** An instrument's: lets a note go, at a time of the audio clock. */
  noteOff?: (timing?: NoteTiming) => void;
  /** An instrument's: starts a note, at a time of the audio clock. */
  noteOn?: (note: Record<string, number>, timing?: NoteTiming) => void;
  readonly output: AudioNode;
  /** Resolves once an engine that runs a worklet has it in the graph. */
  readonly ready?: Promise<boolean>;
  /** The key input of a device that takes one. */
  readonly sidechain?: AudioNode;
  update: (state: AnyDeviceState, context?: DeviceContext) => void;
}

/** A device of the library: its description, how to make its engine, and the shelf it sits on. */
export interface LibraryDevice {
  create: (
    ctx: BaseAudioContext,
    state: AnyDeviceState,
    context?: DeviceContext
  ) => LibraryEngine;
  device: Device<readonly ParameterDescriptor[]>;
  /** An instrument whose engine is the whole of it, one note at a time: a host makes one and gives it every note, as it glides from one to the next. */
  mono?: boolean;
  shelf: string;
}

/** Pairs a device with its engine, checked against each other, for a list that holds them all. */
function entry<const Parameters extends readonly ParameterDescriptor[]>(
  device: Device<Parameters>,
  create: (
    ctx: BaseAudioContext,
    state: DeviceState<Parameters>,
    context?: DeviceContext
  ) => Omit<LibraryEngine, "noteOn" | "update"> & {
    noteOn?: (note: never, timing?: NoteTiming) => void;
    update: (state: DeviceState<Parameters>, context?: DeviceContext) => void;
  },
  shelf: string,
  options: { mono?: boolean } = {}
): LibraryDevice {
  return {
    create: create as unknown as LibraryDevice["create"],
    device: device as unknown as LibraryDevice["device"],
    shelf,
    ...options,
  };
}

/**
 * Every device of the registry, with its engine, by shelf: what a host needs
 * to build a track's chain from the ids a project stores, and what a browser
 * shows. A device's panel is the face it has on its own page.
 */
export const DEVICE_LIBRARY: readonly LibraryDevice[] = [
  // Instruments
  entry(polySynthDevice, createPolySynthEngine, "Instruments"),
  entry(monoSynthDevice, createMonoSynthEngine, "Instruments", { mono: true }),
  entry(electricPianoDevice, createElectricPianoEngine, "Instruments"),
  entry(organDevice, createOrganEngine, "Instruments"),
  entry(fmSynthDevice, createFmSynthEngine, "Instruments"),
  entry(samplerDevice, createSamplerEngine, "Instruments"),
  entry(pocketSynthDevice, createPocketSynthEngine, "Instruments"),
  entry(waveShaperDevice, createWaveShaperEngine, "Instruments"),
  // Dynamics
  entry(compressorDevice, createCompressorEngine, "Dynamics"),
  entry(limiterDevice, createLimiterEngine, "Dynamics"),
  entry(gateDevice, createGateEngine, "Dynamics"),
  entry(multibandDevice, createMultibandEngine, "Dynamics"),
  entry(transientDevice, createTransientEngine, "Dynamics"),
  entry(deesserDevice, createDeesserEngine, "Dynamics"),
  // Tone
  entry(equalizerDevice, createEqualizerEngine, "Tone"),
  entry(channelEqDevice, createChannelEqEngine, "Tone"),
  entry(filterDevice, createFilterEngine, "Tone"),
  // Distortion
  entry(saturatorDevice, createSaturatorEngine, "Distortion"),
  entry(overdriveDevice, createOverdriveEngine, "Distortion"),
  entry(distortionDevice, createDistortionEngine, "Distortion"),
  entry(reduxDevice, createReduxEngine, "Distortion"),
  // Space
  entry(delayDevice, createDelayEngine, "Space"),
  entry(reverbDevice, createReverbEngine, "Space"),
  entry(chorusDevice, createChorusEngine, "Space"),
  // Motion
  entry(phaserDevice, createPhaserEngine, "Motion"),
  entry(autoPanDevice, createAutoPanEngine, "Motion"),
  // Utility
  entry(utilityDevice, createUtilityEngine, "Utility"),
  entry(midSideDevice, createMidSideEngine, "Utility"),
];

const byId = new Map(DEVICE_LIBRARY.map((item) => [item.device.id, item]));

/** The library's device with the stable id `id`, such as `audioui.compressor`. */
export function libraryDevice(id: string): LibraryDevice | undefined {
  return byId.get(id);
}

/** The library by shelf, in order: what a device browser lists. */
export const DEVICE_SHELVES: readonly {
  devices: readonly LibraryDevice[];
  label: string;
}[] = [...new Set(DEVICE_LIBRARY.map((item) => item.shelf))].map((label) => ({
  devices: DEVICE_LIBRARY.filter((item) => item.shelf === label),
  label,
}));
