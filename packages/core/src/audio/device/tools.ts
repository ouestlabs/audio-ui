import {
  type Device,
  defineDevice,
  type ParameterDescriptor,
  type ParameterValue,
} from "./define.ts";

/** The subset of JSON Schema the tools use: what OpenAI, Anthropic, MCP and the AI SDK all accept as an input schema. */
export interface JsonSchema {
  additionalProperties?: boolean;
  description?: string;
  items?: JsonSchema;
  maximum?: number;
  minimum?: number;
  minProperties?: number;
  multipleOf?: number;
  properties?: Record<string, JsonSchema>;
  type: "array" | "boolean" | "number" | "object" | "string";
  [key: string]: unknown;
}

/** How long a note lasts when a call does not say, and the shortest and longest it may ask for, in seconds. */
export const NOTE_DURATION = { default: 0.5, max: 30, min: 0.05 } as const;

export interface DeviceToolResult<State> {
  /** How long the note lasts, in seconds, for the call of a `<id>_play` tool. The host gives it to `playNote`. */
  duration?: number;
  /** The note to play, for the call of a `<id>_play` tool: its parts by id, in bounds. The host gives it to `noteOn`. */
  note?: Record<string, number>;
  /** The state after the call. The host stores it and drives its engine and view from it. */
  state: State;
  /** What happened, in a sentence a model can read back: the new values, what was adjusted, what was refused and why. */
  summary: string;
}

/** A tool a model can call to drive a device: agent-agnostic, with no SDK in it. */
export interface DeviceTool<State> {
  description: string;
  /** JSON Schema of the input. */
  inputSchema: JsonSchema;
  /** A valid tool name: letters, digits, underscore and hyphen. */
  name: string;
  /** Runs the call on `state`. Never throws on a model's input: a bad value is reported in the summary. */
  run: (state: State, input: unknown) => DeviceToolResult<State>;
}

const slug = (id: string) =>
  id.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");

function describeParameter(parameter: ParameterDescriptor): JsonSchema {
  if (parameter.kind === "toggle") {
    return {
      description: `${parameter.label}. true or false, ${parameter.default ? "on" : "off"} by default.`,
      type: "boolean",
    };
  }
  if (parameter.kind === "choice") {
    const values = parameter.options
      .map((option) => `"${option.value}" (${option.label})`)
      .join(", ");
    return {
      description: `${parameter.label}, one of ${values}, "${parameter.default}" by default.`,
      enum: parameter.options.map((option) => option.value),
      type: "string",
    };
  }
  const unit = parameter.unit ? ` ${parameter.unit}` : "";
  return {
    description: `${parameter.label}, from ${parameter.min}${unit} to ${parameter.max}${unit}, ${parameter.default}${unit} by default${
      parameter.scale === "log" ? ", on a log scale" : ""
    }.`,
    maximum: parameter.max,
    minimum: parameter.min,
    type: "number",
    ...(parameter.step ? { multipleOf: parameter.step } : {}),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The tools that drive a device, derived from its parameters: `<id>_set` takes
 * any of its parameters by id, `<id>_reset` puts some or all back to their
 * defaults. The ranges a model is told are the ones the device enforces, so a
 * hallucinated value is clamped and reported, not applied and not fatal, and
 * a parameter the device does not have is refused by name. Nothing here knows
 * which agent calls it.
 */
export function deviceTools<
  const Parameters extends readonly ParameterDescriptor[],
>(device: Device<Parameters>): DeviceTool<Record<string, ParameterValue>>[] {
  type State = Record<string, ParameterValue>;
  const base = slug(device.id);
  const properties = Object.fromEntries(
    device.parameters.map((parameter) => [
      parameter.id,
      describeParameter(parameter),
    ])
  );
  const label = (id: string) =>
    device.parameters.find((parameter) => parameter.id === id)?.label ?? id;
  const show = (id: string, value: ParameterValue) =>
    device.format(id as never, value);

  const set: DeviceTool<State> = {
    description: `Set parameters of the ${device.name}: ${device.description} Give only the parameters to change.`,
    inputSchema: {
      additionalProperties: false,
      minProperties: 1,
      properties,
      type: "object",
    },
    name: `${base}_set`,
    run: (state, input) => {
      if (!isRecord(input)) {
        return {
          state,
          summary: "Nothing changed: give an object of parameter values.",
        };
      }
      const result = device.apply(state as never, input);
      const parts = [
        ...result.changes.map(
          (change) =>
            `${label(change.id)}: ${show(change.id, change.from)} to ${show(change.id, change.to)}${
              change.adjusted ? " (brought into range)" : ""
            }`
        ),
        ...result.rejected.map(
          (rejection) => `${rejection.id}: refused, ${rejection.reason}`
        ),
      ];
      return {
        state: result.state as State,
        summary: parts.length ? parts.join("; ") : "Nothing changed.",
      };
    },
  };

  const reset: DeviceTool<State> = {
    description: `Put parameters of the ${device.name} back to their defaults. Give the ids to reset, or none for all of them.`,
    inputSchema: {
      additionalProperties: false,
      properties: {
        ids: {
          description:
            "The ids of the parameters to reset. Leave it out to reset all.",
          items: { type: "string" },
          type: "array",
        },
      },
      type: "object",
    },
    name: `${base}_reset`,
    run: (state, input) => {
      const defaults = device.defaults() as State;
      const asked =
        isRecord(input) && Array.isArray(input.ids)
          ? input.ids.filter((id): id is string => typeof id === "string")
          : Object.keys(defaults);
      const changes = Object.fromEntries(
        asked.filter((id) => id in defaults).map((id) => [id, defaults[id]])
      );
      const result = device.apply(state as never, changes);
      const unknown = asked.filter((id) => !(id in defaults));
      const parts = [
        ...result.changes.map(
          (change) =>
            `${label(change.id)}: back to ${show(change.id, change.to)}`
        ),
        ...unknown.map((id) => `${id}: refused, unknown parameter`),
      ];
      return {
        state: result.state as State,
        summary: parts.length ? parts.join("; ") : "Already at the defaults.",
      };
    },
  };
  if (device.note.length === 0) {
    return [set, reset];
  }
  return [set, reset, playTool(device, base)];
}

/** `<id>_play`: the call that plays a note, from the descriptors of the instrument's note. */
function playTool<const Parameters extends readonly ParameterDescriptor[]>(
  device: Device<Parameters>,
  base: string
): DeviceTool<Record<string, ParameterValue>> {
  // The note is checked as any set of parameters is: in bounds, refused by name.
  const noteDevice = defineDevice({
    description: device.description,
    id: `${device.id}.note`,
    kind: "instrument",
    name: `${device.name} note`,
    parameters: device.note,
  });
  const properties: Record<string, JsonSchema> = {
    ...Object.fromEntries(
      device.note.map((part) => [part.id, describeParameter(part)])
    ),
    duration: {
      description: `How long the note lasts, in seconds, from ${NOTE_DURATION.min} to ${NOTE_DURATION.max}, ${NOTE_DURATION.default} by default.`,
      maximum: NOTE_DURATION.max,
      minimum: NOTE_DURATION.min,
      type: "number",
    },
  };
  return {
    description: `Play a note on the ${device.name} with the sound it has now. Give the parts of the note you want: the others take their defaults. It sounds for the duration, then lets go.`,
    inputSchema: {
      additionalProperties: false,
      properties,
      type: "object",
    },
    name: `${base}_play`,
    run: (state, input) => {
      const asked = isRecord(input) ? input : {};
      const { duration: askedDuration, ...parts } = asked;
      const applied = noteDevice.apply(noteDevice.defaults(), parts);
      const notes = [
        ...applied.changes.map(
          (change) =>
            `${noteDevice.parameters.find((part) => part.id === change.id)?.label ?? change.id}: ${noteDevice.format(change.id as never, change.to)}${
              change.adjusted ? " (brought into range)" : ""
            }`
        ),
        ...applied.rejected.map(
          (rejection) => `${rejection.id}: refused, ${rejection.reason}`
        ),
      ];
      let duration: number = NOTE_DURATION.default;
      if (askedDuration !== undefined) {
        if (
          typeof askedDuration === "number" &&
          Number.isFinite(askedDuration)
        ) {
          duration = Math.min(
            NOTE_DURATION.max,
            Math.max(NOTE_DURATION.min, askedDuration)
          );
          if (duration !== askedDuration) {
            notes.push(`duration: ${duration} s (brought into range)`);
          }
        } else {
          notes.push("duration: refused, not a number");
        }
      }
      return {
        duration,
        note: { ...applied.state } as Record<string, number>,
        state,
        summary: `Playing for ${duration} s${notes.length ? `: ${notes.join("; ")}` : "."}`,
      };
    },
  };
}
