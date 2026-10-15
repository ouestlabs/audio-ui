import { clamp } from "../../shared/math.ts";
import { type ParameterScaleProp, resolveScale } from "../../value/scale.ts";

/**
 * A device: an effect or an instrument as a set of named parameters, with no
 * interface and no audio in it. The same description feeds a panel (its knobs
 * and their ranges), an engine adapter (what to set on a node) and an agent
 * (which values it may ask for), so none of the three redefines a range.
 *
 * The state of a device is a plain object keyed by parameter id: numbers for
 * a continuous parameter, booleans for a toggle. It is a value, never an
 * instance: a host stores it, saves it and sends it as it likes.
 */

/** A continuous parameter: a number in a range, on a scale, in steps. */
export interface NumberParameter {
  /** The value that reads as the neutral or centre, for bipolar controls (a pan, a detune). */
  anchor?: number;
  default: number;
  /** Prints a value for a readout. Defaults to the value with the unit and as many decimals as `step` has. */
  format?: (value: number) => string;
  id: string;
  kind?: "number";
  label: string;
  max: number;
  min: number;
  /** How the range maps onto a control's travel. `"log"` needs a positive `min`. @default "linear" */
  scale?: ParameterScaleProp;
  /** The grid values snap to, from `min`. Leave it out for a continuous parameter. */
  step?: number;
  /** The unit a value is in: `"dB"`, `"Hz"`, `"ms"`, `"%"`... shown after it. */
  unit?: string;
}

/** An on or off parameter: a bypass, a mode, an auto switch. */
export interface ToggleParameter {
  default: boolean;
  id: string;
  kind: "toggle";
  label: string;
}

export type ParameterDescriptor = NumberParameter | ToggleParameter;

/** The state of a device: each parameter's id to its value. */
export type DeviceState<
  Parameters extends
    readonly ParameterDescriptor[] = readonly ParameterDescriptor[],
> = {
  [Parameter in Parameters[number] as Parameter["id"]]: Parameter extends ToggleParameter
    ? boolean
    : number;
};

export interface DeviceDefinition<
  Parameters extends readonly ParameterDescriptor[],
> {
  /** What it does, in a line: what a catalog or an agent shows. */
  description: string;
  /** A stable reverse-DNS id, such as `audioui.compressor`: a saved project stores this, not the panel that draws it. */
  id: string;
  /** Whether it processes sound or makes it. @default "effect" */
  kind?: "effect" | "instrument";
  name: string;
  parameters: Parameters;
}

export interface Device<Parameters extends readonly ParameterDescriptor[]> {
  /** `value` brought into the device's own bounds, snapped to the steps: what `set` stores. */
  clampValue: (
    id: Parameters[number]["id"],
    value: unknown
  ) => number | boolean;
  /** A state of the device's own defaults. A new object each time. */
  defaults: () => DeviceState<Parameters>;
  /** The inverse of `normalize`: the value at a position along the travel, snapped and clamped. */
  denormalize: (
    id: Parameters[number]["id"],
    position: number
  ) => number | boolean;
  readonly description: string;
  /** Prints a parameter's value for a readout, with its unit. */
  format: (id: Parameters[number]["id"], value: number | boolean) => string;
  readonly id: string;
  readonly kind: "effect" | "instrument";
  readonly name: string;
  /** Where a value sits along its parameter's travel, from 0 to 1, on its scale. A toggle is 0 or 1. */
  normalize: (id: Parameters[number]["id"], value: number | boolean) => number;
  readonly parameters: Parameters;
  /** A state with every value in bounds: unknown ids dropped, missing ones defaulted, `NaN` replaced. */
  sanitize: (
    state: Partial<Record<string, unknown>>
  ) => DeviceState<Parameters>;
  /** A copy of `state` with one parameter changed to `value`, clamped. An id the device does not have returns `state` unchanged. */
  set: (
    state: DeviceState<Parameters>,
    id: string,
    value: unknown
  ) => DeviceState<Parameters>;
}

/** Raised when a device is defined with parameters that cannot work. */
export class DeviceDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeviceDefinitionError";
  }
}

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function check(parameter: ParameterDescriptor, device: string) {
  const where = `${device}.${parameter.id || "(no id)"}`;
  if (!parameter.id.trim()) {
    throw new DeviceDefinitionError(`${device}: a parameter has no id.`);
  }
  if (!parameter.label.trim()) {
    throw new DeviceDefinitionError(`${where}: it has no label.`);
  }
  if (parameter.kind === "toggle") {
    if (typeof parameter.default !== "boolean") {
      throw new DeviceDefinitionError(
        `${where}: a toggle's default is true or false.`
      );
    }
    return;
  }
  if (
    !(
      isNumber(parameter.min) &&
      isNumber(parameter.max) &&
      parameter.min < parameter.max
    )
  ) {
    throw new DeviceDefinitionError(
      `${where}: min must be below max, both finite.`
    );
  }
  if (
    !(
      isNumber(parameter.default) &&
      parameter.default >= parameter.min &&
      parameter.default <= parameter.max
    )
  ) {
    throw new DeviceDefinitionError(
      `${where}: the default is not within min and max.`
    );
  }
  if (
    parameter.step !== undefined &&
    !(isNumber(parameter.step) && parameter.step > 0)
  ) {
    throw new DeviceDefinitionError(`${where}: step must be above 0.`);
  }
  if (parameter.scale === "log" && parameter.min <= 0) {
    throw new DeviceDefinitionError(
      `${where}: a log scale needs a min above 0.`
    );
  }
}

/** Decimals a step prints: 0.1 is one, 0.25 is two, 1 is none. */
function decimalsOf(step: number | undefined) {
  if (!step || Number.isInteger(step)) {
    return 0;
  }
  return Math.min(6, (String(step).split(".")[1] ?? "").length);
}

/**
 * Defines a device from its parameters. The definition is checked once, here:
 * a duplicate id, a default outside its range or a log scale from zero throws
 * a `DeviceDefinitionError` that names the parameter, so a broken device never
 * reaches a panel or an agent.
 */
export function defineDevice<
  const Parameters extends readonly ParameterDescriptor[],
>(definition: DeviceDefinition<Parameters>): Device<Parameters> {
  const { parameters } = definition;
  if (!definition.id.trim()) {
    throw new DeviceDefinitionError("A device needs an id.");
  }
  const byId = new Map<string, ParameterDescriptor>();
  for (const parameter of parameters) {
    check(parameter, definition.id);
    if (byId.has(parameter.id)) {
      throw new DeviceDefinitionError(
        `${definition.id}.${parameter.id}: two parameters have this id.`
      );
    }
    byId.set(parameter.id, parameter);
  }

  const clampValue = (id: string, value: unknown): number | boolean => {
    const parameter = byId.get(id);
    if (!parameter) {
      return Number.NaN;
    }
    if (parameter.kind === "toggle") {
      return typeof value === "boolean" ? value : parameter.default;
    }
    if (!isNumber(value)) {
      return parameter.default;
    }
    let next = clamp(value, parameter.min, parameter.max);
    if (parameter.step) {
      // The last step of the grid that is still within max: a grid that does
      // not end on max still ends inside it, on a step.
      const last = Math.floor(
        (parameter.max - parameter.min) / parameter.step + 1e-9
      );
      const steps = Math.min(
        last,
        Math.round((next - parameter.min) / parameter.step)
      );
      // Undo the float drift of `0.1 * 3`.
      next = Number(
        (parameter.min + steps * parameter.step).toFixed(
          decimalsOf(parameter.step) + 2
        )
      );
    }
    return next;
  };

  const defaults = () =>
    Object.fromEntries(
      parameters.map((parameter) => [parameter.id, parameter.default])
    ) as DeviceState<Parameters>;

  return {
    clampValue,
    defaults,
    description: definition.description,
    denormalize: (id, position) => {
      const parameter = byId.get(id);
      if (!parameter) {
        return Number.NaN;
      }
      if (parameter.kind === "toggle") {
        return position >= 0.5;
      }
      const raw = resolveScale(parameter.scale ?? "linear").toValue(
        isNumber(position) ? position : 0,
        parameter.min,
        parameter.max
      );
      return clampValue(id, raw);
    },
    format: (id, value) => {
      const parameter = byId.get(id);
      if (!parameter) {
        return "";
      }
      if (parameter.kind === "toggle") {
        return value ? "On" : "Off";
      }
      if (!isNumber(value)) {
        return "";
      }
      if (parameter.format) {
        return parameter.format(value);
      }
      const text = value.toFixed(decimalsOf(parameter.step));
      return parameter.unit ? `${text} ${parameter.unit}` : text;
    },
    id: definition.id,
    kind: definition.kind ?? "effect",
    name: definition.name,
    normalize: (id, value) => {
      const parameter = byId.get(id);
      if (!parameter) {
        return Number.NaN;
      }
      if (parameter.kind === "toggle") {
        return value ? 1 : 0;
      }
      return resolveScale(parameter.scale ?? "linear").toPosition(
        isNumber(value) ? value : parameter.default,
        parameter.min,
        parameter.max
      );
    },
    parameters,
    sanitize: (state) => {
      const next = defaults() as Record<string, number | boolean>;
      for (const parameter of parameters) {
        if (parameter.id in state) {
          next[parameter.id] = clampValue(parameter.id, state[parameter.id]);
        }
      }
      return next as DeviceState<Parameters>;
    },
    set: (state, id, value) => {
      if (!byId.has(id)) {
        return state;
      }
      return { ...state, [id]: clampValue(id, value) };
    },
  };
}
