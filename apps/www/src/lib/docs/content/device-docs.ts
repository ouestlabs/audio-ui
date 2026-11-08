import { autoPanDevice } from "@/registry-audio/bases/base/lib/auto-pan-device";
import { channelEqDevice } from "@/registry-audio/bases/base/lib/channel-eq-device";
import { chorusDevice } from "@/registry-audio/bases/base/lib/chorus-device";
import { compressorDevice } from "@/registry-audio/bases/base/lib/compressor-device";
import { deesserDevice } from "@/registry-audio/bases/base/lib/deesser-device";
import { delayDevice } from "@/registry-audio/bases/base/lib/delay-device";
import { distortionDevice } from "@/registry-audio/bases/base/lib/distortion-device";
import { drumSynthDevice } from "@/registry-audio/bases/base/lib/drum-synth-device";
import { electricPianoDevice } from "@/registry-audio/bases/base/lib/electric-piano-device";
import { equalizerDevice } from "@/registry-audio/bases/base/lib/equalizer-device";
import { filterDevice } from "@/registry-audio/bases/base/lib/filter-device";
import { fmSynthDevice } from "@/registry-audio/bases/base/lib/fm-synth-device";
import { gateDevice } from "@/registry-audio/bases/base/lib/gate-device";
import { guitarDevice } from "@/registry-audio/bases/base/lib/guitar-device";
import { limiterDevice } from "@/registry-audio/bases/base/lib/limiter-device";
import { midSideDevice } from "@/registry-audio/bases/base/lib/mid-side-device";
import { monoSynthDevice } from "@/registry-audio/bases/base/lib/mono-synth-device";
import { multibandDevice } from "@/registry-audio/bases/base/lib/multiband-device";
import { organDevice } from "@/registry-audio/bases/base/lib/organ-device";
import { overdriveDevice } from "@/registry-audio/bases/base/lib/overdrive-device";
import { phaserDevice } from "@/registry-audio/bases/base/lib/phaser-device";
import { pocketSynthDevice } from "@/registry-audio/bases/base/lib/pocket-synth-device";
import { polySynthDevice } from "@/registry-audio/bases/base/lib/poly-synth-device";
import { reduxDevice } from "@/registry-audio/bases/base/lib/redux-device";
import { reverbDevice } from "@/registry-audio/bases/base/lib/reverb-device";
import { samplerDevice } from "@/registry-audio/bases/base/lib/sampler-device";
import { saturatorDevice } from "@/registry-audio/bases/base/lib/saturator-device";
import { stringMachineDevice } from "@/registry-audio/bases/base/lib/string-machine-device";
import { tapeKeysDevice } from "@/registry-audio/bases/base/lib/tape-keys-device";
import { transientDevice } from "@/registry-audio/bases/base/lib/transient-device";
import { utilityDevice } from "@/registry-audio/bases/base/lib/utility-device";
import { vibeDevice } from "@/registry-audio/bases/base/lib/vibe-device";
import { waveShaperDevice } from "@/registry-audio/bases/base/lib/wave-shaper-device";

/** The devices the docs describe, by the slug of their page. */
export const DEVICE_DOCS = {
  "auto-pan": autoPanDevice,
  "channel-eq": channelEqDevice,
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
