import { z } from "zod";

/**
 * The AI-native surface for a drum machine: `createDrumMachineTools` builds a
 * set of typed, agent-agnostic tools an LLM can call to write beats from
 * natural-language instructions ("give me a boom-bap groove with a busy
 * hi-hat at 90 BPM"). It is parameterized by the consumer's own kit — any
 * number of instruments, addressed by whatever names they choose, on a grid of
 * any width — so it fits a 3-voice starter or a 12-pad 808, not a hard-coded
 * kick/snare/hihat. Each tool bundles a description, a zod schema for its
 * arguments, and a pure `apply(state, args)` reducer, so the same edits a human
 * makes by clicking are the edits the model makes by calling.
 *
 * @example Wiring to the Vercel AI SDK
 * ```ts
 * import { tool } from "ai";
 * import { createDrumMachineTools } from "@/lib/drum-machine-tools";
 *
 * // Declare YOUR kit — as many instruments as you like, in row order.
 * const drum = createDrumMachineTools({
 *   instruments: ["kick", "snare", "hihat", "clap", "openhat"],
 *   stepCount: 16,
 * });
 *
 * const tools = Object.fromEntries(
 *   Object.entries(drum).map(([name, t]) => [
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

/** A drum pattern: one boolean row per instrument (in the kit's declared order), each `stepCount` long. `true` = the step fires. */
export type DrumPattern = boolean[][];

/** What the tools read and write — the pattern grid plus the tempo. */
export interface DrumMachineState {
  bpm: number;
  pattern: DrumPattern;
}

const DEFAULT_STEP_COUNT = 16;
const DEFAULT_MIN_BPM = 20;
const DEFAULT_MAX_BPM = 200;

// --- Pure, index-based grid operations (framework- and kit-agnostic) ---

/** An empty grid: `rowCount` silent instruments across `stepCount` steps. */
export function clearPattern(rowCount: number, stepCount: number): DrumPattern {
  return Array.from({ length: rowCount }, () =>
    new Array<boolean>(stepCount).fill(false)
  );
}

/** Replaces one row (by index), leaving the others untouched. No-op if `row` is out of range. */
export function setRowAt(
  pattern: DrumPattern,
  row: number,
  steps: boolean[]
): DrumPattern {
  return pattern.map((current, index) =>
    index === row ? [...steps] : current
  );
}

/** Flips a single cell on or off. No-op if `row` or `step` is out of range. */
export function toggleStepAt(
  pattern: DrumPattern,
  row: number,
  step: number
): DrumPattern {
  return pattern.map((current, index) =>
    index === row
      ? current.map((on, position) => (position === step ? !on : on))
      : current
  );
}

export interface DrumMachineToolsConfig<
  Instruments extends readonly [string, ...string[]],
> {
  /** The kit's instruments, in row order — the names the model addresses. Any length. */
  instruments: Instruments;
  /** Upper tempo bound in BPM (default 200). */
  maxBpm?: number;
  /** Lower tempo bound in BPM (default 60). */
  minBpm?: number;
  /** Steps per bar / grid width (default 16). */
  stepCount?: number;
}

interface DrumTool<Schema extends z.ZodType> {
  apply: (state: DrumMachineState, args: z.infer<Schema>) => DrumMachineState;
  description: string;
  schema: Schema;
}

/**
 * Builds the tool set for a specific kit. `instruments` and `stepCount` are
 * baked into the schemas (a `z.enum` of the kit's names, rows of exactly
 * `stepCount` booleans), so the model can only ever produce valid edits.
 */
export function createDrumMachineTools<
  const Instruments extends readonly [string, ...string[]],
>(config: DrumMachineToolsConfig<Instruments>) {
  const {
    instruments,
    stepCount = DEFAULT_STEP_COUNT,
    minBpm = DEFAULT_MIN_BPM,
    maxBpm = DEFAULT_MAX_BPM,
  } = config;

  const rowOf = (instrument: Instruments[number]): number =>
    instruments.indexOf(instrument);
  const clamped = (bpm: number): number =>
    Math.min(maxBpm, Math.max(minBpm, Math.round(bpm)));

  const instrumentSchema = z
    .enum(instruments)
    .describe(`Which instrument to edit: ${instruments.join(", ")}.`);
  const stepRowSchema = z
    .array(z.boolean())
    .length(stepCount)
    .describe(`Exactly ${stepCount} steps; true = the step fires.`);
  const stepIndexSchema = z
    .number()
    .int()
    .min(0)
    .max(stepCount - 1)
    .describe(`Step index, 0 to ${stepCount - 1}.`);

  const setPatternSchema = z.object({
    rows: z
      .array(z.object({ instrument: instrumentSchema, steps: stepRowSchema }))
      .describe(
        "One entry per instrument to set; any instrument omitted is cleared."
      ),
  });
  const setInstrumentSchema = z.object({
    instrument: instrumentSchema,
    steps: stepRowSchema,
  });
  const toggleStepSchema = z.object({
    instrument: instrumentSchema,
    step: stepIndexSchema,
  });
  const clearSchema = z.object({});
  const setTempoSchema = z.object({
    bpm: z
      .number()
      .min(minBpm)
      .max(maxBpm)
      .describe(`Tempo in BPM, ${minBpm} to ${maxBpm}.`),
  });

  const empty = (): DrumPattern => clearPattern(instruments.length, stepCount);

  const defineTool = <Schema extends z.ZodType>(
    tool: DrumTool<Schema>
  ): DrumTool<Schema> => tool;

  return {
    clear: defineTool({
      apply: (state) => ({ ...state, pattern: empty() }),
      description:
        "Clear the whole grid — silence every instrument on every step.",
      schema: clearSchema,
    }),
    setInstrument: defineTool({
      apply: (state, { instrument, steps }) => ({
        ...state,
        pattern: setRowAt(state.pattern, rowOf(instrument), steps),
      }),
      description:
        "Replace one instrument's row — use for 'change the hi-hats' style edits.",
      schema: setInstrumentSchema,
    }),
    setPattern: defineTool({
      apply: (state, { rows }) => ({
        ...state,
        pattern: rows.reduce(
          (pattern, { instrument, steps }) =>
            setRowAt(pattern, rowOf(instrument), steps),
          empty()
        ),
      }),
      description:
        "Replace the entire pattern at once — the primary way to lay down a full beat.",
      schema: setPatternSchema,
    }),
    setTempo: defineTool({
      apply: (state, { bpm }) => ({ ...state, bpm: clamped(bpm) }),
      description: "Set the tempo in BPM.",
      schema: setTempoSchema,
    }),
    toggleStep: defineTool({
      apply: (state, { instrument, step }) => ({
        ...state,
        pattern: toggleStepAt(state.pattern, rowOf(instrument), step),
      }),
      description:
        "Flip a single step on or off — for incremental edits like 'add a kick on step 4'.",
      schema: toggleStepSchema,
    }),
  };
}

export type DrumMachineTools = ReturnType<typeof createDrumMachineTools>;
