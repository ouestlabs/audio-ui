import { clamp } from "../../shared/math.ts";
import { type ParameterScaleProp, resolveScale } from "../../value/scale.ts";

/**
 * A device: an effect or an instrument as a set of named parameters, with no
 * interface and no audio in it. The same description feeds a panel (its knobs
 * and their ranges), an engine adapter (what to set on a node) and an agent
 * (which values it may ask for), so none of the three redefines a range.
 *
 * The state of a device is a plain object keyed by parameter id: numbers for
 * a continuous parameter, booleans for a toggle, the value of the picked
 * option for a choice. It is a value, never an
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

/** One entry of a choice: the `value` that goes in the state and the `label` a panel shows. */
export interface ChoiceOption {
  label: string;
  value: string;
}

/** A pick from a short list: a waveform, a filter type, a mode. */
export interface ChoiceParameter {
  /** One of the `value`s of `options`. */
  default: string;
  id: string;
  kind: "choice";
  label: string;
  /** At least two, with distinct values. */
  options: readonly ChoiceOption[];
}

export type ParameterDescriptor =
  | NumberParameter
  | ToggleParameter
  | ChoiceParameter;

/** What a parameter holds: a number, a boolean or the value of a choice. */
export type ParameterValue = boolean | number | string;

/** The state of a device: each parameter's id to its value. */
export type DeviceState<
  Parameters extends
    readonly ParameterDescriptor[] = readonly ParameterDescriptor[],
> = {
  [Parameter in Parameters[number] as Parameter["id"]]: Parameter extends ToggleParameter
    ? boolean
    : Parameter extends ChoiceParameter
      ? Parameter["options"][number]["value"]
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
  /**
   * What a note of this instrument is made of, as numbers with a range: a pitch
   * in hertz, a filter cutoff. An instrument that has them is played by a host
   * through `noteOn(note)` and by an agent through the `<id>_play` tool, which
   * is derived from them. Only an instrument has notes. `duration` is reserved.
   */
  note?: readonly NumberParameter[];
  parameters: Parameters;
}

/** A parameter as an agent or a catalog reads it: JSON-safe, with no function in it. */
export interface ParameterDescription {
  default: ParameterValue;
  id: string;
  label: string;
  max?: number;
  min?: number;
  /** The values a choice takes. */
  options?: ChoiceOption[];
  /** `"custom"` for a scale given as functions: the range alone does not say how it travels. */
  scale?: "custom" | "linear" | "log";
  step?: number;
  type: "boolean" | "number" | "string";
  unit?: string;
}

/** A device as an agent or a catalog reads it. */
export interface DeviceDescription {
  description: string;
  id: string;
  kind: "effect" | "instrument";
  name: string;
  /** The numbers a note is made of, for an instrument that is played. */
  note?: ParameterDescription[];
  parameters: ParameterDescription[];
}

/** One parameter `apply` changed. */
export interface DeviceChange {
  /** `true` when the value asked for was outside the range or off the grid and was brought in. */
  adjusted: boolean;
  from: ParameterValue;
  id: string;
  to: ParameterValue;
}

/** One parameter `apply` did not change, and why. */
export interface DeviceRejection {
  id: string;
  reason:
    | "not a boolean"
    | "not a number"
    | "not one of the options"
    | "unknown parameter";
}

export interface DeviceApplied<State> {
  /** What changed, in the order asked. A value equal to the current one is not a change. */
  changes: DeviceChange[];
  rejected: DeviceRejection[];
  state: State;
}

/**
 * What a host gives a device to drive: an engine, a view, a store. The device
 * knows nothing of it. `update` is called with each new state and must be cheap
 * to repeat; `dispose` releases what it holds.
 */
export interface DeviceBinding<State> {
  dispose: () => void;
  update: (state: State) => void;
}

export interface Device<Parameters extends readonly ParameterDescriptor[]> {
  /**
   * Applies several changes at once and says what happened to each: the
   * answer a model can act on. A value out of range is brought in and marked
   * `adjusted`; an id the device does not have, or a value of the wrong type
   * (a string where a number goes), is `rejected` and the parameter is left
   * as it was, instead of being silently replaced by its default.
   */
  apply: (
    state: DeviceState<Parameters>,
    changes: Partial<Record<string, unknown>>
  ) => DeviceApplied<DeviceState<Parameters>>;
  /** `value` brought into the device's own bounds, snapped to the steps: what `set` stores. */
  clampValue: (id: Parameters[number]["id"], value: unknown) => ParameterValue;
  /** A state of the device's own defaults. A new object each time. */
  defaults: () => DeviceState<Parameters>;
  /** The inverse of `normalize`: the value at a position along the travel, snapped and clamped. */
  denormalize: (
    id: Parameters[number]["id"],
    position: number
  ) => ParameterValue;
  /** The device as JSON: what a catalog lists and an agent is told. */
  describe: () => DeviceDescription;
  readonly description: string;
  /** Prints a parameter's value for a readout, with its unit. */
  format: (id: Parameters[number]["id"], value: ParameterValue) => string;
  readonly id: string;
  readonly kind: "effect" | "instrument";
  readonly name: string;
  /** Where a value sits along its parameter's travel, from 0 to 1, on its scale. A toggle is 0 or 1, a choice its place in the list. */
  normalize: (id: Parameters[number]["id"], value: ParameterValue) => number;
  /** What a note of the instrument is made of. Empty for an effect, and for an instrument that is not played by notes. */
  readonly note: readonly NumberParameter[];
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

function checkChoice(parameter: ChoiceParameter, where: string) {
  const values = parameter.options.map((option) => option.value);
  if (values.length < 2) {
    throw new DeviceDefinitionError(
      `${where}: a choice needs at least two options.`
    );
  }
  if (new Set(values).size !== values.length) {
    throw new DeviceDefinitionError(
      `${where}: two options have the same value.`
    );
  }
  if (!values.includes(parameter.default)) {
    throw new DeviceDefinitionError(
      `${where}: the default is not one of the options.`
    );
  }
}

function checkNumber(parameter: NumberParameter, where: string) {
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
  } else if (parameter.kind === "choice") {
    checkChoice(parameter, where);
  } else {
    checkNumber(parameter, where);
  }
}

/** Why a value cannot go in a parameter, or `undefined` when it can (it may still be brought into range). */
function refusal(
  parameter: ParameterDescriptor,
  asked: unknown
): DeviceRejection["reason"] | undefined {
  if (parameter.kind === "toggle") {
    return typeof asked === "boolean" ? undefined : "not a boolean";
  }
  if (parameter.kind === "choice") {
    return parameter.options.some((option) => option.value === asked)
      ? undefined
      : "not one of the options";
  }
  return isNumber(asked) ? undefined : "not a number";
}

/** Decimals a step prints: 0.1 is one, 0.25 is two, 1 is none. */
function decimalsOf(step: number | undefined) {
  if (!step || Number.isInteger(step)) {
    return 0;
  }
  return Math.min(6, (String(step).split(".")[1] ?? "").length);
}

/** A parameter as an agent or a catalog reads it. */
function describeParameter(
  parameter: ParameterDescriptor
): ParameterDescription {
  if (parameter.kind === "toggle") {
    return {
      default: parameter.default,
      id: parameter.id,
      label: parameter.label,
      type: "boolean",
    };
  }
  if (parameter.kind === "choice") {
    return {
      default: parameter.default,
      id: parameter.id,
      label: parameter.label,
      options: parameter.options.map(({ label, value }) => ({
        label,
        value,
      })),
      type: "string",
    };
  }
  const scale = parameter.scale ?? "linear";
  return {
    default: parameter.default,
    id: parameter.id,
    label: parameter.label,
    max: parameter.max,
    min: parameter.min,
    scale: typeof scale === "string" ? scale : "custom",
    step: parameter.step,
    type: "number",
    unit: parameter.unit,
  };
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
  const note = definition.note ?? [];
  if (note.length > 0 && definition.kind !== "instrument") {
    throw new DeviceDefinitionError(
      `${definition.id}: only an instrument has notes.`
    );
  }
  const noteIds = new Set<string>();
  for (const part of note) {
    check(part, `${definition.id}.note`);
    if (part.id === "duration") {
      throw new DeviceDefinitionError(
        `${definition.id}.note.duration: this id is reserved for how long a note lasts.`
      );
    }
    if (noteIds.has(part.id)) {
      throw new DeviceDefinitionError(
        `${definition.id}.note.${part.id}: two parts of a note have this id.`
      );
    }
    noteIds.add(part.id);
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

  const clampValue = (id: string, value: unknown): ParameterValue => {
    const parameter = byId.get(id);
    if (!parameter) {
      return Number.NaN;
    }
    if (parameter.kind === "toggle") {
      return typeof value === "boolean" ? value : parameter.default;
    }
    if (parameter.kind === "choice") {
      return parameter.options.some((option) => option.value === value)
        ? (value as string)
        : parameter.default;
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
      if (parameter.kind === "choice") {
        const last = parameter.options.length - 1;
        const index = Math.round(
          clamp(isNumber(position) ? position : 0, 0, 1) * last
        );
        return parameter.options[index]?.value ?? parameter.default;
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
      if (parameter.kind === "choice") {
        return (
          parameter.options.find((option) => option.value === value)?.label ??
          ""
        );
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
      if (parameter.kind === "choice") {
        const index = parameter.options.findIndex(
          (option) => option.value === value
        );
        return index < 0 ? 0 : index / (parameter.options.length - 1);
      }
      return resolveScale(parameter.scale ?? "linear").toPosition(
        isNumber(value) ? value : parameter.default,
        parameter.min,
        parameter.max
      );
    },
    note,
    parameters,
    apply: (state, changes) => {
      const applied: DeviceChange[] = [];
      const rejected: DeviceRejection[] = [];
      let next = { ...state } as Record<string, ParameterValue>;
      for (const [id, asked] of Object.entries(changes)) {
        const parameter = byId.get(id);
        if (!parameter) {
          rejected.push({ id, reason: "unknown parameter" });
          continue;
        }
        const reason = refusal(parameter, asked);
        if (reason) {
          rejected.push({ id, reason });
          continue;
        }
        const to = clampValue(id, asked);
        const from = next[id] ?? parameter.default;
        if (to !== from) {
          applied.push({ adjusted: to !== asked, from, id, to });
          next = { ...next, [id]: to };
        }
      }
      return {
        changes: applied,
        rejected,
        state: next as DeviceState<Parameters>,
      };
    },
    describe: () => ({
      description: definition.description,
      id: definition.id,
      kind: definition.kind ?? "effect",
      name: definition.name,
      note: note.length > 0 ? note.map(describeParameter) : undefined,
      parameters: parameters.map(describeParameter),
    }),
    sanitize: (state) => {
      const next = defaults() as Record<string, ParameterValue>;
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
