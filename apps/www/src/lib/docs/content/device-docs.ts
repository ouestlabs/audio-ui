import { autoPanDevice } from "@/registry-audio/bases/base/devices/auto-pan/device";
import { bassEnhancerDevice } from "@/registry-audio/bases/base/devices/bass-enhancer/device";
import { channelEqDevice } from "@/registry-audio/bases/base/devices/channel-eq/device";
import { chorusDevice } from "@/registry-audio/bases/base/devices/chorus/device";
import { compressorDevice } from "@/registry-audio/bases/base/devices/compressor/device";
import { deesserDevice } from "@/registry-audio/bases/base/devices/deesser/device";
import { delayDevice } from "@/registry-audio/bases/base/devices/delay/device";
import { distortionDevice } from "@/registry-audio/bases/base/devices/distortion/device";
import { drumSynthDevice } from "@/registry-audio/bases/base/devices/drum-synth/device";
import { electricPianoDevice } from "@/registry-audio/bases/base/devices/electric-piano/device";
import { equalizerDevice } from "@/registry-audio/bases/base/devices/equalizer/device";
import { exciterDevice } from "@/registry-audio/bases/base/devices/exciter/device";
import { filterDevice } from "@/registry-audio/bases/base/devices/filter/device";
import { fmSynthDevice } from "@/registry-audio/bases/base/devices/fm-synth/device";
import { frequencyShifterDevice } from "@/registry-audio/bases/base/devices/frequency-shifter/device";
import { gateDevice } from "@/registry-audio/bases/base/devices/gate/device";
import { graphicEqDevice } from "@/registry-audio/bases/base/devices/graphic-eq/device";
import { guitarDevice } from "@/registry-audio/bases/base/devices/guitar/device";
import { limiterDevice } from "@/registry-audio/bases/base/devices/limiter/device";
import { lofiDevice } from "@/registry-audio/bases/base/devices/lofi/device";
import { midSideDevice } from "@/registry-audio/bases/base/devices/mid-side/device";
import { monoSynthDevice } from "@/registry-audio/bases/base/devices/mono-synth/device";
import { multibandDevice } from "@/registry-audio/bases/base/devices/multiband/device";
import { organDevice } from "@/registry-audio/bases/base/devices/organ/device";
import { overdriveDevice } from "@/registry-audio/bases/base/devices/overdrive/device";
import { phaserDevice } from "@/registry-audio/bases/base/devices/phaser/device";
import { pocketSynthDevice } from "@/registry-audio/bases/base/devices/pocket-synth/device";
import { polySynthDevice } from "@/registry-audio/bases/base/devices/poly-synth/device";
import { reduxDevice } from "@/registry-audio/bases/base/devices/redux/device";
import { reverbDevice } from "@/registry-audio/bases/base/devices/reverb/device";
import { samplerDevice } from "@/registry-audio/bases/base/devices/sampler/device";
import { saturatorDevice } from "@/registry-audio/bases/base/devices/saturator/device";
import { stringMachineDevice } from "@/registry-audio/bases/base/devices/string-machine/device";
import { tapeKeysDevice } from "@/registry-audio/bases/base/devices/tape-keys/device";
import { tiltEqDevice } from "@/registry-audio/bases/base/devices/tilt-eq/device";
import { transientDevice } from "@/registry-audio/bases/base/devices/transient/device";
import { utilityDevice } from "@/registry-audio/bases/base/devices/utility/device";
import { vibeDevice } from "@/registry-audio/bases/base/devices/vibe/device";
import { wahDevice } from "@/registry-audio/bases/base/devices/wah/device";
import { waveShaperDevice } from "@/registry-audio/bases/base/devices/wave-shaper/device";

/** The devices the docs describe, by the slug of their page. */
export const DEVICE_DOCS = {
  "auto-pan": autoPanDevice,
  "channel-eq": channelEqDevice,
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
