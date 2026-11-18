import { autoPanDevice } from "@/registry/bases/shared/devices/auto-pan/device";
import { bassEnhancerDevice } from "@/registry/bases/shared/devices/bass-enhancer/device";
import { binauralPannerDevice } from "@/registry/bases/shared/devices/binaural-panner/device";
import { channelEqDevice } from "@/registry/bases/shared/devices/channel-eq/device";
import { chorusDevice } from "@/registry/bases/shared/devices/chorus/device";
import { companderDevice } from "@/registry/bases/shared/devices/compander/device";
import { compressorDevice } from "@/registry/bases/shared/devices/compressor/device";
import { deesserDevice } from "@/registry/bases/shared/devices/deesser/device";
import { delayDevice } from "@/registry/bases/shared/devices/delay/device";
import { distortionDevice } from "@/registry/bases/shared/devices/distortion/device";
import { drumSynthDevice } from "@/registry/bases/shared/devices/drum-synth/device";
import { duckerDevice } from "@/registry/bases/shared/devices/ducker/device";
import { electricPianoDevice } from "@/registry/bases/shared/devices/electric-piano/device";
import { equalizerDevice } from "@/registry/bases/shared/devices/equalizer/device";
import { exciterDevice } from "@/registry/bases/shared/devices/exciter/device";
import { expanderDevice } from "@/registry/bases/shared/devices/expander/device";
import { filterDevice } from "@/registry/bases/shared/devices/filter/device";
import { fmSynthDevice } from "@/registry/bases/shared/devices/fm-synth/device";
import { frequencyShifterDevice } from "@/registry/bases/shared/devices/frequency-shifter/device";
import { gateDevice } from "@/registry/bases/shared/devices/gate/device";
import { graphicEqDevice } from "@/registry/bases/shared/devices/graphic-eq/device";
import { guitarDevice } from "@/registry/bases/shared/devices/guitar/device";
import { limiterDevice } from "@/registry/bases/shared/devices/limiter/device";
import { lofiDevice } from "@/registry/bases/shared/devices/lofi/device";
import { midSideDevice } from "@/registry/bases/shared/devices/mid-side/device";
import { monoSynthDevice } from "@/registry/bases/shared/devices/mono-synth/device";
import { multibandDevice } from "@/registry/bases/shared/devices/multiband/device";
import { organDevice } from "@/registry/bases/shared/devices/organ/device";
import { overdriveDevice } from "@/registry/bases/shared/devices/overdrive/device";
import { phaserDevice } from "@/registry/bases/shared/devices/phaser/device";
import { pocketSynthDevice } from "@/registry/bases/shared/devices/pocket-synth/device";
import { polySynthDevice } from "@/registry/bases/shared/devices/poly-synth/device";
import { reduxDevice } from "@/registry/bases/shared/devices/redux/device";
import { reverbDevice } from "@/registry/bases/shared/devices/reverb/device";
import { rotaryDevice } from "@/registry/bases/shared/devices/rotary/device";
import { samplerDevice } from "@/registry/bases/shared/devices/sampler/device";
import { saturatorDevice } from "@/registry/bases/shared/devices/saturator/device";
import { stringMachineDevice } from "@/registry/bases/shared/devices/string-machine/device";
import { stutterDevice } from "@/registry/bases/shared/devices/stutter/device";
import { tapeKeysDevice } from "@/registry/bases/shared/devices/tape-keys/device";
import { tiltEqDevice } from "@/registry/bases/shared/devices/tilt-eq/device";
import { transientDevice } from "@/registry/bases/shared/devices/transient/device";
import { unlimiterDevice } from "@/registry/bases/shared/devices/unlimiter/device";
import { utilityDevice } from "@/registry/bases/shared/devices/utility/device";
import { vibeDevice } from "@/registry/bases/shared/devices/vibe/device";
import { wahDevice } from "@/registry/bases/shared/devices/wah/device";
import { waveShaperDevice } from "@/registry/bases/shared/devices/wave-shaper/device";

/** The devices the docs describe, by the slug of their page. */
export const DEVICE_DOCS = {
  "auto-pan": autoPanDevice,
  "channel-eq": channelEqDevice,
  unlimiter: unlimiterDevice,
  compander: companderDevice,
  ducker: duckerDevice,
  expander: expanderDevice,
  "binaural-panner": binauralPannerDevice,
  stutter: stutterDevice,
  rotary: rotaryDevice,
  "bass-enhancer": bassEnhancerDevice,
  exciter: exciterDevice,
  "frequency-shifter": frequencyShifterDevice,
  wah: wahDevice,
  "graphic-eq": graphicEqDevice,
  "tilt-eq": tiltEqDevice,
  chorus: chorusDevice,
  compressor: compressorDevice,
  deesser: deesserDevice,
  delay: delayDevice,
  distortion: distortionDevice,
  equalizer: equalizerDevice,
  filter: filterDevice,
  gate: gateDevice,
  limiter: limiterDevice,
  "mid-side": midSideDevice,
  multiband: multibandDevice,
  overdrive: overdriveDevice,
  phaser: phaserDevice,
  "pocket-synth": pocketSynthDevice,
  "poly-synth": polySynthDevice,
  "electric-piano": electricPianoDevice,
  "fm-synth": fmSynthDevice,
  "mono-synth": monoSynthDevice,
  organ: organDevice,
  "string-machine": stringMachineDevice,
  "tape-keys": tapeKeysDevice,
  guitar: guitarDevice,
  "drum-synth": drumSynthDevice,
  sampler: samplerDevice,
  redux: reduxDevice,
  lofi: lofiDevice,
  reverb: reverbDevice,
  saturator: saturatorDevice,
  transient: transientDevice,
  utility: utilityDevice,
  vibe: vibeDevice,
  "wave-shaper": waveShaperDevice,
} as const;

export type DeviceDocName = keyof typeof DEVICE_DOCS;

export interface ControlRow {
  default: string;
  id: string;
  label: string;
  /** What it takes: a range with its unit, the options, or on and off. */
  range: string;
}

/** What a switch that every effect has does, so a page only writes it when it differs. */
export const ENABLED_TEXT =
  "Turns the device on. Off, the signal passes through unchanged.";

/** The controls of a device, as the device itself describes them: the docs cannot drift from the ranges and defaults in the code. */
export function deviceControlRows(name: DeviceDocName): ControlRow[] {
  const device = DEVICE_DOCS[name];
  return device.describe().parameters.map((parameter) => {
    // A reading in a table has no trailing zero: "-70 dB", not "-70.0 dB".
    const format = (value: number | string | boolean) =>
      device.format(parameter.id as never, value).replace(/\.0(?!\d)/g, "");
    let range = "On or off";
    if (parameter.type === "string") {
      range = (parameter.options ?? [])
        .map((option) => option.label)
        .join(", ");
    } else if (
      parameter.type === "number" &&
      parameter.min !== undefined &&
      parameter.max !== undefined
    ) {
      range = `${format(parameter.min)} to ${format(parameter.max)}`;
    }
    return {
      default: format(parameter.default),
      id: parameter.id,
      label: parameter.label,
      range,
    };
  });
}

const DEVICE_CONTROLS_REGEX =
  /<DeviceControls\s+device="([^"]+)"\s*>([\s\S]*?)<\/DeviceControls>/g;
const CONTROL_REGEX = /<Control\s+id="([^"]+)"\s*>([\s\S]*?)<\/Control>/g;

/** The same table in Markdown, for the pages served as plain text. */
export function expandDeviceControls(content: string) {
  return content.replace(DEVICE_CONTROLS_REGEX, (match, name, body) => {
    if (!(name in DEVICE_DOCS)) {
      return match;
    }
    const texts = new Map<string, string>();
    for (const [, id, text] of body.matchAll(CONTROL_REGEX)) {
      texts.set(id, text.trim().replaceAll("\n", " "));
    }
    const rows = deviceControlRows(name as DeviceDocName).map(
      (row) =>
        `| ${row.label} | ${row.range} | ${row.default} | ${
          texts.get(row.id) ?? (row.id === "enabled" ? ENABLED_TEXT : "")
        } |`
    );
    return [
      "| Control | Range | Default | What it does |",
      "| --- | --- | --- | --- |",
      ...rows,
    ].join("\n");
  });
}
