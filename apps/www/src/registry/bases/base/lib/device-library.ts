import type {
  Device,
  DeviceState,
  EffectEngine,
  EngineFactory,
  InstrumentEngine,
  ParameterDescriptor,
  ParameterValue,
} from "@/engine/device";
import { autoPanDevice } from "@/registry/bases/base/devices/auto-pan/device";
import { createAutoPanEngine } from "@/registry/bases/base/devices/auto-pan/engine";
import { bassEnhancerDevice } from "@/registry/bases/base/devices/bass-enhancer/device";
import { createBassEnhancerEngine } from "@/registry/bases/base/devices/bass-enhancer/engine";
import { binauralPannerDevice } from "@/registry/bases/base/devices/binaural-panner/device";
import { createBinauralPannerEngine } from "@/registry/bases/base/devices/binaural-panner/engine";
import { channelEqDevice } from "@/registry/bases/base/devices/channel-eq/device";
import { createChannelEqEngine } from "@/registry/bases/base/devices/channel-eq/engine";
import { chorusDevice } from "@/registry/bases/base/devices/chorus/device";
import { createChorusEngine } from "@/registry/bases/base/devices/chorus/engine";
import { companderDevice } from "@/registry/bases/base/devices/compander/device";
import { createCompanderEngine } from "@/registry/bases/base/devices/compander/engine";
import { compressorDevice } from "@/registry/bases/base/devices/compressor/device";
import { createCompressorEngine } from "@/registry/bases/base/devices/compressor/engine";
import { deesserDevice } from "@/registry/bases/base/devices/deesser/device";
import { createDeesserEngine } from "@/registry/bases/base/devices/deesser/engine";
import { delayDevice } from "@/registry/bases/base/devices/delay/device";
import { createDelayEngine } from "@/registry/bases/base/devices/delay/engine";
import { distortionDevice } from "@/registry/bases/base/devices/distortion/device";
import { createDistortionEngine } from "@/registry/bases/base/devices/distortion/engine";
import { drumSynthDevice } from "@/registry/bases/base/devices/drum-synth/device";
import { createDrumSynthEngine } from "@/registry/bases/base/devices/drum-synth/engine";
import { duckerDevice } from "@/registry/bases/base/devices/ducker/device";
import { createDuckerEngine } from "@/registry/bases/base/devices/ducker/engine";
import { electricPianoDevice } from "@/registry/bases/base/devices/electric-piano/device";
import { createElectricPianoEngine } from "@/registry/bases/base/devices/electric-piano/engine";
import { equalizerDevice } from "@/registry/bases/base/devices/equalizer/device";
import { createEqualizerEngine } from "@/registry/bases/base/devices/equalizer/engine";
import { exciterDevice } from "@/registry/bases/base/devices/exciter/device";
import { createExciterEngine } from "@/registry/bases/base/devices/exciter/engine";
import { expanderDevice } from "@/registry/bases/base/devices/expander/device";
import { createExpanderEngine } from "@/registry/bases/base/devices/expander/engine";
import { filterDevice } from "@/registry/bases/base/devices/filter/device";
import { createFilterEngine } from "@/registry/bases/base/devices/filter/engine";
import { fmSynthDevice } from "@/registry/bases/base/devices/fm-synth/device";
import { createFmSynthEngine } from "@/registry/bases/base/devices/fm-synth/engine";
import { frequencyShifterDevice } from "@/registry/bases/base/devices/frequency-shifter/device";
import { createFrequencyShifterEngine } from "@/registry/bases/base/devices/frequency-shifter/engine";
import { gateDevice } from "@/registry/bases/base/devices/gate/device";
import { createGateEngine } from "@/registry/bases/base/devices/gate/engine";
import { graphicEqDevice } from "@/registry/bases/base/devices/graphic-eq/device";
import { createGraphicEqEngine } from "@/registry/bases/base/devices/graphic-eq/engine";
import { guitarDevice } from "@/registry/bases/base/devices/guitar/device";
import { createGuitarEngine } from "@/registry/bases/base/devices/guitar/engine";
import { limiterDevice } from "@/registry/bases/base/devices/limiter/device";
import { createLimiterEngine } from "@/registry/bases/base/devices/limiter/engine";
import { lofiDevice } from "@/registry/bases/base/devices/lofi/device";
import { createLofiEngine } from "@/registry/bases/base/devices/lofi/engine";
import { midSideDevice } from "@/registry/bases/base/devices/mid-side/device";
import { createMidSideEngine } from "@/registry/bases/base/devices/mid-side/engine";
import { monoSynthDevice } from "@/registry/bases/base/devices/mono-synth/device";
import { createMonoSynthEngine } from "@/registry/bases/base/devices/mono-synth/engine";
import { multibandDevice } from "@/registry/bases/base/devices/multiband/device";
import { createMultibandEngine } from "@/registry/bases/base/devices/multiband/engine";
import { organDevice } from "@/registry/bases/base/devices/organ/device";
import { createOrganEngine } from "@/registry/bases/base/devices/organ/engine";
import { overdriveDevice } from "@/registry/bases/base/devices/overdrive/device";
import { createOverdriveEngine } from "@/registry/bases/base/devices/overdrive/engine";
import { phaserDevice } from "@/registry/bases/base/devices/phaser/device";
import { createPhaserEngine } from "@/registry/bases/base/devices/phaser/engine";
import { pocketSynthDevice } from "@/registry/bases/base/devices/pocket-synth/device";
import { createPocketSynthEngine } from "@/registry/bases/base/devices/pocket-synth/engine";
import { polySynthDevice } from "@/registry/bases/base/devices/poly-synth/device";
import { createPolySynthEngine } from "@/registry/bases/base/devices/poly-synth/engine";
import { reduxDevice } from "@/registry/bases/base/devices/redux/device";
import { createReduxEngine } from "@/registry/bases/base/devices/redux/engine";
import { reverbDevice } from "@/registry/bases/base/devices/reverb/device";
import { createReverbEngine } from "@/registry/bases/base/devices/reverb/engine";
import { rotaryDevice } from "@/registry/bases/base/devices/rotary/device";
import { createRotaryEngine } from "@/registry/bases/base/devices/rotary/engine";
import { samplerDevice } from "@/registry/bases/base/devices/sampler/device";
import { createSamplerEngine } from "@/registry/bases/base/devices/sampler/engine";
import { saturatorDevice } from "@/registry/bases/base/devices/saturator/device";
import { createSaturatorEngine } from "@/registry/bases/base/devices/saturator/engine";
import { stringMachineDevice } from "@/registry/bases/base/devices/string-machine/device";
import { createStringMachineEngine } from "@/registry/bases/base/devices/string-machine/engine";
import { stutterDevice } from "@/registry/bases/base/devices/stutter/device";
import { createStutterEngine } from "@/registry/bases/base/devices/stutter/engine";
import { tapeKeysDevice } from "@/registry/bases/base/devices/tape-keys/device";
import { createTapeKeysEngine } from "@/registry/bases/base/devices/tape-keys/engine";
import { tiltEqDevice } from "@/registry/bases/base/devices/tilt-eq/device";
import { createTiltEqEngine } from "@/registry/bases/base/devices/tilt-eq/engine";
import { transientDevice } from "@/registry/bases/base/devices/transient/device";
import { createTransientEngine } from "@/registry/bases/base/devices/transient/engine";
import { unlimiterDevice } from "@/registry/bases/base/devices/unlimiter/device";
import { createUnlimiterEngine } from "@/registry/bases/base/devices/unlimiter/engine";
import { utilityDevice } from "@/registry/bases/base/devices/utility/device";
import { createUtilityEngine } from "@/registry/bases/base/devices/utility/engine";
import { vibeDevice } from "@/registry/bases/base/devices/vibe/device";
import { createVibeEngine } from "@/registry/bases/base/devices/vibe/engine";
import { wahDevice } from "@/registry/bases/base/devices/wah/device";
import { createWahEngine } from "@/registry/bases/base/devices/wah/engine";
import { waveShaperDevice } from "@/registry/bases/base/devices/wave-shaper/device";
import { createWaveShaperEngine } from "@/registry/bases/base/devices/wave-shaper/engine";

/** A device's state as a host keeps it: a value for each parameter id. */
export type AnyDeviceState = Readonly<Record<string, ParameterValue>>;

/**
 * Any engine of the library, an effect's or an instrument's, as a host holds
 * them side by side on a track: what both contracts share, an effect's input
 * and key where it has them, an instrument's notes where it has them, its
 * note as the parameters its `note` descriptors name.
 */
export type LibraryEngine = Omit<
  EffectEngine<AnyDeviceState>,
  "input" | "sidechain"
> &
  Partial<Pick<EffectEngine<AnyDeviceState>, "input" | "sidechain">> &
  Partial<
    Pick<
      InstrumentEngine<AnyDeviceState, Record<string, number>>,
      "noteOff" | "noteOn"
    >
  >;

/** A device of the library: its description, how to make its engine, and the shelf it sits on. */
export interface LibraryDevice {
  create: EngineFactory<AnyDeviceState, LibraryEngine>;
  device: Device<readonly ParameterDescriptor[]>;
  /** An instrument whose engine is the whole of it, one note at a time: a host makes one and gives it every note, as it glides from one to the next. */
  mono?: boolean;
  shelf: string;
}

/** Pairs a device with its engine, checked against each other, for a list that holds them all. */
function entry<const Parameters extends readonly ParameterDescriptor[]>(
  device: Device<Parameters>,
  create: EngineFactory<
    DeviceState<Parameters>,
    | EffectEngine<DeviceState<Parameters>>
    | InstrumentEngine<DeviceState<Parameters>, never>
  >,
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
  entry(guitarDevice, createGuitarEngine, "Instruments"),
  entry(drumSynthDevice, createDrumSynthEngine, "Instruments", {
    mono: true,
  }),
  entry(fmSynthDevice, createFmSynthEngine, "Instruments"),
  entry(samplerDevice, createSamplerEngine, "Instruments"),
  entry(pocketSynthDevice, createPocketSynthEngine, "Instruments"),
  entry(waveShaperDevice, createWaveShaperEngine, "Instruments"),
  // Dynamics
  entry(compressorDevice, createCompressorEngine, "Dynamics"),
  entry(limiterDevice, createLimiterEngine, "Dynamics"),
  entry(gateDevice, createGateEngine, "Dynamics"),
  entry(expanderDevice, createExpanderEngine, "Dynamics"),
  entry(duckerDevice, createDuckerEngine, "Dynamics"),
  entry(companderDevice, createCompanderEngine, "Dynamics"),
  entry(unlimiterDevice, createUnlimiterEngine, "Dynamics"),
  entry(multibandDevice, createMultibandEngine, "Dynamics"),
  entry(transientDevice, createTransientEngine, "Dynamics"),
  entry(deesserDevice, createDeesserEngine, "Dynamics"),
  // Tone
  entry(equalizerDevice, createEqualizerEngine, "Tone"),
  entry(channelEqDevice, createChannelEqEngine, "Tone"),
  entry(graphicEqDevice, createGraphicEqEngine, "Tone"),
  entry(tiltEqDevice, createTiltEqEngine, "Tone"),
  entry(exciterDevice, createExciterEngine, "Tone"),
  entry(bassEnhancerDevice, createBassEnhancerEngine, "Tone"),
  entry(filterDevice, createFilterEngine, "Tone"),
  // Distortion
  entry(saturatorDevice, createSaturatorEngine, "Distortion"),
  entry(overdriveDevice, createOverdriveEngine, "Distortion"),
  entry(distortionDevice, createDistortionEngine, "Distortion"),
  entry(reduxDevice, createReduxEngine, "Distortion"),
  entry(lofiDevice, createLofiEngine, "Distortion"),
  // Space
  entry(delayDevice, createDelayEngine, "Space"),
  entry(reverbDevice, createReverbEngine, "Space"),
  entry(chorusDevice, createChorusEngine, "Space"),
  // Motion
  entry(phaserDevice, createPhaserEngine, "Motion"),
  entry(autoPanDevice, createAutoPanEngine, "Motion"),
  entry(vibeDevice, createVibeEngine, "Motion"),
  entry(wahDevice, createWahEngine, "Motion"),
  entry(frequencyShifterDevice, createFrequencyShifterEngine, "Motion"),
  entry(rotaryDevice, createRotaryEngine, "Motion"),
  entry(stutterDevice, createStutterEngine, "Motion"),
  // Utility
  entry(utilityDevice, createUtilityEngine, "Utility"),
  entry(midSideDevice, createMidSideEngine, "Utility"),
  entry(binauralPannerDevice, createBinauralPannerEngine, "Utility"),
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
