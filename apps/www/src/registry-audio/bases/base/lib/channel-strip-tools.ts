import { z } from "zod";

/**
 * The AI-native surface for a channel strip — really, for any set of named
 * audio parameters. `createChannelStripTools` builds typed, agent-agnostic
 * tools an LLM calls to move a mix from natural-language instructions ("bring
 * the vocal up 3 dB, pan it slightly left, mute the reverb send"). It is
 * parameterized by the channel's own controls — any number of continuous
 * params (gain, pan, sends, EQ, filter cutoff…) with their own ranges and
 * units, plus boolean toggles (mute, solo) — so it is not hard-coded to
 * gain/pan/mute. Every edit is clamped into the declared range, so the model
 * can only ever produce valid settings.
 *
 * @example Wiring to the Vercel AI SDK
 * ```ts
 * import { tool } from "ai";
 * import { createChannelStripTools } from "@/lib/channel-strip-tools";
 *
 * const strip = createChannelStripTools({
 *   params: [
 *     { name: "gain", min: -60, max: 6, unit: "dB", default: 0 },
 *     { name: "pan", min: -1, max: 1, default: 0 },
 *     { name: "reverbSend", min: -60, max: 0, unit: "dB", default: -60 },
 *     { name: "mute", type: "toggle" },
 *   ],
 * });
 * const tools = Object.fromEntries(
 *   Object.entries(strip).map(([name, t]) => [
 *     name,
 *     tool({
 *       description: t.description,
 *       inputSchema: t.schema,
 *       execute: (args) => {
 *         setState((prev) => t.apply(prev, args as never));
 *         return `applied ${name}`;
 *       },
 *     }),
 *   ])
 * );
 * ```
 */

/** A continuous control — a value bounded by `[min, max]`, optionally snapped to `step`. */
export interface ContinuousParam {
  default?: number;
  max: number;
  min: number;
  name: string;
  step?: number;
  /** Shown to the model so it reasons in the right units (e.g. "dB", "%"). */
  unit?: string;
}

/** An on/off control (mute, solo, bypass). */
export interface ToggleParam {
  default?: boolean;
  name: string;
  type: "toggle";
}

export type ChannelParam = ContinuousParam | ToggleParam;

/** The strip's current settings — one entry per param, keyed by name. */
export type ChannelStripState = Record<string, number | boolean>;

function isToggle(param: ChannelParam): param is ToggleParam {
  return "type" in param && param.type === "toggle";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The default settings for a param set — `default` if given, else `min` (continuous) or `false` (toggle). */
export function channelStripDefaults(
  params: readonly ChannelParam[]
): ChannelStripState {
  return Object.fromEntries(
    params.map((param) => [
      param.name,
      isToggle(param) ? (param.default ?? false) : (param.default ?? param.min),
    ])
  );
}

interface ChannelStripTool<Schema extends z.ZodType> {
  apply: (state: ChannelStripState, args: z.infer<Schema>) => ChannelStripState;
  description: string;
  schema: Schema;
}

/** Builds the tool set for a specific param list. Requires at least one param. */
export function createChannelStripTools(config: {
  params: readonly ChannelParam[];
}) {
  const { params } = config;
  const byName = new Map(params.map((param) => [param.name, param]));
  const names = params.map((param) => param.name) as [string, ...string[]];

  const coerce = (name: string, value: number | boolean): number | boolean => {
    const param = byName.get(name);
    if (!param || isToggle(param)) {
      return Boolean(value);
    }
    const clamped = clamp(Number(value), param.min, param.max);
    return param.step ? Math.round(clamped / param.step) * param.step : clamped;
  };

  const describeParam = (param: ChannelParam): string =>
    isToggle(param)
      ? `${param.name} (on/off)`
      : `${param.name} (${param.min} to ${param.max}${param.unit ? ` ${param.unit}` : ""})`;

  const paramSchema = z
    .enum(names)
    .describe(`Which control to set: ${params.map(describeParam).join(", ")}.`);
  const valueSchema = z
    .union([z.number(), z.boolean()])
    .describe(
      "A number for continuous params (clamped to range), or true/false for toggles."
    );

  const setParamSchema = z.object({ param: paramSchema, value: valueSchema });
  const setParamsSchema = z.object({
    changes: z
      .array(setParamSchema)
      .describe("Several controls to set at once."),
  });
  const resetSchema = z.object({});

  const defineTool = <Schema extends z.ZodType>(
    tool: ChannelStripTool<Schema>
  ): ChannelStripTool<Schema> => tool;

  return {
    reset: defineTool({
      apply: () => channelStripDefaults(params),
      description: "Reset every control to its default.",
      schema: resetSchema,
    }),
    setParam: defineTool({
      apply: (state, { param, value }) => ({
        ...state,
        [param]: coerce(param, value),
      }),
      description:
        "Set one control — a number for a continuous param (gain, pan, a send), or true/false for a toggle (mute, solo).",
      schema: setParamSchema,
    }),
    setParams: defineTool({
      apply: (state, { changes }) => {
        const next: ChannelStripState = { ...state };
        for (const { param, value } of changes) {
          next[param] = coerce(param, value);
        }
        return next;
      },
      description:
        "Set several controls at once — the efficient way to dial in a whole channel.",
      schema: setParamsSchema,
    }),
  };
}

export type ChannelStripTools = ReturnType<typeof createChannelStripTools>;
