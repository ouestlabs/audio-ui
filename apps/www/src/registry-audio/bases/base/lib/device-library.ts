import type {
  Device,
  DeviceContext,
  DeviceState,
  NoteTiming,
  ParameterDescriptor,
  ParameterValue,
} from "@audio-ui/core/device";
import { autoPanDevice } from "@/registry-audio/bases/base/lib/auto-pan-device";
import { createAutoPanEngine } from "@/registry-audio/bases/base/lib/auto-pan-engine";
import { channelEqDevice } from "@/registry-audio/bases/base/lib/channel-eq-device";
import { createChannelEqEngine } from "@/registry-audio/bases/base/lib/channel-eq-engine";
import { chorusDevice } from "@/registry-audio/bases/base/lib/chorus-device";
import { createChorusEngine } from "@/registry-audio/bases/base/lib/chorus-engine";
import { compressorDevice } from "@/registry-audio/bases/base/lib/compressor-device";
import { createCompressorEngine } from "@/registry-audio/bases/base/lib/compressor-engine";
import { deesserDevice } from "@/registry-audio/bases/base/lib/deesser-device";
import { createDeesserEngine } from "@/registry-audio/bases/base/lib/deesser-engine";
import { delayDevice } from "@/registry-audio/bases/base/lib/delay-device";
import { createDelayEngine } from "@/registry-audio/bases/base/lib/delay-engine";
import { distortionDevice } from "@/registry-audio/bases/base/lib/distortion-device";
import { createDistortionEngine } from "@/registry-audio/bases/base/lib/distortion-engine";
import { electricPianoDevice } from "@/registry-audio/bases/base/lib/electric-piano-device";
import { createElectricPianoEngine } from "@/registry-audio/bases/base/lib/electric-piano-engine";
import { equalizerDevice } from "@/registry-audio/bases/base/lib/equalizer-device";
import { createEqualizerEngine } from "@/registry-audio/bases/base/lib/equalizer-engine";
import { filterDevice } from "@/registry-audio/bases/base/lib/filter-device";
import { createFilterEngine } from "@/registry-audio/bases/base/lib/filter-engine";
import { fmSynthDevice } from "@/registry-audio/bases/base/lib/fm-synth-device";
import { createFmSynthEngine } from "@/registry-audio/bases/base/lib/fm-synth-engine";
import { gateDevice } from "@/registry-audio/bases/base/lib/gate-device";
import { createGateEngine } from "@/registry-audio/bases/base/lib/gate-engine";
import { limiterDevice } from "@/registry-audio/bases/base/lib/limiter-device";
import { createLimiterEngine } from "@/registry-audio/bases/base/lib/limiter-engine";
import { midSideDevice } from "@/registry-audio/bases/base/lib/mid-side-device";
import { createMidSideEngine } from "@/registry-audio/bases/base/lib/mid-side-engine";
import { monoSynthDevice } from "@/registry-audio/bases/base/lib/mono-synth-device";
import { createMonoSynthEngine } from "@/registry-audio/bases/base/lib/mono-synth-engine";
import { multibandDevice } from "@/registry-audio/bases/base/lib/multiband-device";
import { createMultibandEngine } from "@/registry-audio/bases/base/lib/multiband-engine";
import { organDevice } from "@/registry-audio/bases/base/lib/organ-device";
import { createOrganEngine } from "@/registry-audio/bases/base/lib/organ-engine";
import { overdriveDevice } from "@/registry-audio/bases/base/lib/overdrive-device";
import { createOverdriveEngine } from "@/registry-audio/bases/base/lib/overdrive-engine";
import { phaserDevice } from "@/registry-audio/bases/base/lib/phaser-device";
import { createPhaserEngine } from "@/registry-audio/bases/base/lib/phaser-engine";
import { pocketSynthDevice } from "@/registry-audio/bases/base/lib/pocket-synth-device";
import { createPocketSynthEngine } from "@/registry-audio/bases/base/lib/pocket-synth-engine";
import { polySynthDevice } from "@/registry-audio/bases/base/lib/poly-synth-device";
import { createPolySynthEngine } from "@/registry-audio/bases/base/lib/poly-synth-engine";
import { reduxDevice } from "@/registry-audio/bases/base/lib/redux-device";
import { createReduxEngine } from "@/registry-audio/bases/base/lib/redux-engine";
import { reverbDevice } from "@/registry-audio/bases/base/lib/reverb-device";
import { createReverbEngine } from "@/registry-audio/bases/base/lib/reverb-engine";
import { samplerDevice } from "@/registry-audio/bases/base/lib/sampler-device";
import { createSamplerEngine } from "@/registry-audio/bases/base/lib/sampler-engine";
import { saturatorDevice } from "@/registry-audio/bases/base/lib/saturator-device";
import { createSaturatorEngine } from "@/registry-audio/bases/base/lib/saturator-engine";
import { stringMachineDevice } from "@/registry-audio/bases/base/lib/string-machine-device";
import { createStringMachineEngine } from "@/registry-audio/bases/base/lib/string-machine-engine";
import { tapeKeysDevice } from "@/registry-audio/bases/base/lib/tape-keys-device";
import { createTapeKeysEngine } from "@/registry-audio/bases/base/lib/tape-keys-engine";
import { transientDevice } from "@/registry-audio/bases/base/lib/transient-device";
import { createTransientEngine } from "@/registry-audio/bases/base/lib/transient-engine";
import { utilityDevice } from "@/registry-audio/bases/base/lib/utility-device";
import { createUtilityEngine } from "@/registry-audio/bases/base/lib/utility-engine";
import { waveShaperDevice } from "@/registry-audio/bases/base/lib/wave-shaper-device";
import { createWaveShaperEngine } from "@/registry-audio/bases/base/lib/wave-shaper-engine";

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
  entry(stringMachineDevice, createStringMachineEngine, "Instruments"),
  entry(tapeKeysDevice, createTapeKeysEngine, "Instruments"),
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
