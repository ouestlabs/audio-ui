import type { Device, ParameterDescriptor } from "./define";

/** The units the audio.js processor contract names. Any other is left out. */
const CONTRACT_UNITS = [
  "dB",
  "Hz",
  "s",
  "ms",
  "st",
  "cents",
  "oct",
  "deg",
  "rad",
  "m",
  "bpm",
  "LUFS",
  "dB/oct",
] as const;

/** A parameter as the audio.js processor contract 1.0 declares it in a processor's `params`. */
export type ContractParameter =
  | {
      curve?: "log";
      default: number;
      max: number;
      min: number;
      step?: number;
      type: "number";
      unit?: (typeof CONTRACT_UNITS)[number];
    }
  | { default: boolean; type: "bool" }
  | { default: string; type: "enum"; values: string[] };

/** Whether a range is a whole number of steps, which the contract asks of a `step`. */
function dividesRange(step: number, range: number) {
  const steps = range / step;
  return Math.abs(steps - Math.round(steps)) < 1e-6;
}

function contractParameter(parameter: ParameterDescriptor): ContractParameter {
  if (parameter.kind === "toggle") {
    return { default: parameter.default, type: "bool" };
  }
  if (parameter.kind === "choice") {
    return {
      default: parameter.default,
      type: "enum",
      values: parameter.options.map((option) => option.value),
    };
  }
  const { max, min, scale, step } = parameter;
  const unit = CONTRACT_UNITS.find((known) => known === parameter.unit);
  return {
    default: parameter.default,
    max,
    min,
    type: "number",
    ...(scale === "log" && { curve: "log" }),
    ...(step && dividesRange(step, max - min) && { step }),
    ...(unit && { unit }),
  };
}

/**
 * A device's parameters as the `params` of an audio.js processor, by parameter
 * id, in the order the device declares them: what a plugin host or an
 * `AudioWorklet` adapter reads, with no range written a second time.
 *
 * The contract has no labels, groups or formats, so they are left out, as are
 * a custom scale, a unit it does not name and a step that does not divide its
 * range.
 */
export function contractParams(
  device: Pick<Device<readonly ParameterDescriptor[]>, "parameters">
): Record<string, ContractParameter> {
  return Object.fromEntries(
    device.parameters.map((parameter) => [
      parameter.id,
      contractParameter(parameter),
    ])
  );
}
