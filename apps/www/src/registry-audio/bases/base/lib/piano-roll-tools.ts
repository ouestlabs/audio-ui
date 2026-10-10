import { z } from "zod";

/**
 * The AI-native surface for a piano roll: `createPianoRollTools` builds typed,
 * agent-agnostic tools an LLM calls to compose from natural-language
 * instructions ("write a walking bassline in C minor", "transpose up an
 * octave", "make it staccato"). Unlike a drum grid, the state is a list of
 * pitched notes — so this proves the AI-native pattern scales past boolean
 * cells to real musical data. It is parameterized by the roll's pitch range
 * and grid, and every tool re-clamps the model's output into that domain (the
 * same normalization the PianoRoll primitive applies), so an agent can only
 * ever produce valid, grid-snapped notes.
 *
 * @example Wiring to the Vercel AI SDK
 * ```ts
 * import { tool } from "ai";
 * import { createPianoRollTools } from "@/lib/piano-roll-tools";
 *
 * const roll = createPianoRollTools({ minPitch: 48, maxPitch: 72, stepCount: 16 });
 * const tools = Object.fromEntries(
 *   Object.entries(roll).map(([name, t]) => [
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

/** A grid-snapped, pitched note. Start and length are whole steps; real-world timing (BPM, seconds) is the consumer's concern. Structurally matches the PianoRoll primitive's `Note` on a timeline counted in steps. */
export interface PianoRollNote {
  id: number | string;
  length: number;
  pitch: number;
  start: number;
  velocity: number;
}

/** A note as the model supplies it — no id (the tools assign one), length/velocity optional. */
export interface NoteInput {
  length?: number;
  pitch: number;
  start: number;
  velocity?: number;
}

/** What the tools read and write — the notes plus the tempo. */
export interface PianoRollState {
  bpm: number;
  notes: PianoRollNote[];
}

const DEFAULTS = {
  maxBpm: 200,
  maxPitch: 72,
  minBpm: 20,
  minLength: 1,
  minPitch: 48,
  stepCount: 16,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

interface Domain {
  maxPitch: number;
  minLength: number;
  minPitch: number;
  stepCount: number;
}

/** Normalizes a model-supplied note into the roll's domain — the same clamping the primitive does on its controlled value. */
export function clampNoteToDomain(
  input: NoteInput,
  id: number | string,
  domain: Domain
): PianoRollNote {
  const length = clamp(
    Math.round(input.length ?? domain.minLength),
    domain.minLength,
    domain.stepCount
  );
  const start = clamp(Math.round(input.start), 0, domain.stepCount - length);
  const pitch = clamp(
    Math.round(input.pitch),
    domain.minPitch,
    domain.maxPitch
  );
  return {
    id,
    length,
    pitch,
    start,
    velocity: clampUnit(input.velocity ?? 1),
  };
}

/** The next free numeric id, one past the highest numeric id already in use (string ids are left alone). */
function nextId(notes: PianoRollNote[]): number {
  return (
    1 +
    notes.reduce(
      (max, note) =>
        typeof note.id === "number" && note.id > max ? note.id : max,
      -1
    )
  );
}

export interface PianoRollToolsConfig {
  /** Upper tempo bound in BPM (default 200). */
  maxBpm?: number;
  /** Highest MIDI pitch the roll shows (default 72, C5). */
  maxPitch?: number;
  /** Lower tempo bound in BPM (default 20). */
  minBpm?: number;
  /** Shortest note in steps (default 1). */
  minLength?: number;
  /** Lowest MIDI pitch the roll shows (default 48, C3). */
  minPitch?: number;
  /** Steps per bar / grid width (default 16). */
  stepCount?: number;
}

interface PianoRollTool<Schema extends z.ZodType> {
  apply: (state: PianoRollState, args: z.infer<Schema>) => PianoRollState;
  description: string;
  schema: Schema;
}

/** Builds the tool set for a specific roll. Pitch range and grid are baked into the schemas, and every edit is re-clamped into the domain. */
export function createPianoRollTools(config: PianoRollToolsConfig = {}) {
  const {
    minPitch = DEFAULTS.minPitch,
    maxPitch = DEFAULTS.maxPitch,
    stepCount = DEFAULTS.stepCount,
    minLength = DEFAULTS.minLength,
    minBpm = DEFAULTS.minBpm,
    maxBpm = DEFAULTS.maxBpm,
  } = config;
  const domain: Domain = { maxPitch, minLength, minPitch, stepCount };

  const noteInputSchema = z.object({
    length: z
      .number()
      .int()
      .min(minLength)
      .max(stepCount)
      .optional()
      .describe(`Length in steps (default ${minLength}).`),
    pitch: z
      .number()
      .int()
      .min(minPitch)
      .max(maxPitch)
      .describe("MIDI pitch (60 = middle C)."),
    start: z
      .number()
      .int()
      .min(0)
      .max(stepCount - 1)
      .describe(`Start step, 0 to ${stepCount - 1}.`),
    velocity: z.number().min(0).max(1).optional().describe("0-1, default 1."),
  });
  const idSchema = z.union([z.number(), z.string()]);

  const setNotesSchema = z.object({
    notes: z
      .array(noteInputSchema)
      .describe("The complete set of notes — replaces everything on the roll."),
  });
  const addNotesSchema = z.object({
    notes: z.array(noteInputSchema).describe("Notes to add to the roll."),
  });
  const removeNotesSchema = z.object({
    ids: z.array(idSchema).describe("Ids of the notes to remove."),
  });
  const transposeSchema = z.object({
    ids: z
      .array(idSchema)
      .optional()
      .describe("Notes to transpose; omit to transpose everything."),
    semitones: z
      .number()
      .int()
      .describe(
        "Shift in semitones; +12 = up an octave, -1 = down a semitone."
      ),
  });
  const clearSchema = z.object({});
  const setTempoSchema = z.object({
    bpm: z
      .number()
      .min(minBpm)
      .max(maxBpm)
      .describe(`Tempo in BPM, ${minBpm} to ${maxBpm}.`),
  });

  const defineTool = <Schema extends z.ZodType>(
    tool: PianoRollTool<Schema>
  ): PianoRollTool<Schema> => tool;

  return {
    addNotes: defineTool({
      apply: (state, { notes }) => {
        const base = nextId(state.notes);
        return {
          ...state,
          notes: [
            ...state.notes,
            ...notes.map((note, index) =>
              clampNoteToDomain(note, base + index, domain)
            ),
          ],
        };
      },
      description:
        "Add notes to what's already on the roll — for 'layer a harmony on top' style edits.",
      schema: addNotesSchema,
    }),
    clear: defineTool({
      apply: (state) => ({ ...state, notes: [] }),
      description: "Remove every note from the roll.",
      schema: clearSchema,
    }),
    removeNotes: defineTool({
      apply: (state, { ids }) => ({
        ...state,
        notes: state.notes.filter((note) => !ids.includes(note.id)),
      }),
      description:
        "Remove specific notes by id (read the current notes first to choose them).",
      schema: removeNotesSchema,
    }),
    setNotes: defineTool({
      apply: (state, { notes }) => ({
        ...state,
        notes: notes.map((note, index) =>
          clampNoteToDomain(note, index, domain)
        ),
      }),
      description:
        "Replace the entire roll — the primary way to write a melody, bassline, or chord progression.",
      schema: setNotesSchema,
    }),
    setTempo: defineTool({
      apply: (state, { bpm }) => ({
        ...state,
        bpm: clamp(Math.round(bpm), minBpm, maxBpm),
      }),
      description: "Set the tempo in BPM.",
      schema: setTempoSchema,
    }),
    transpose: defineTool({
      apply: (state, { ids, semitones }) => ({
        ...state,
        notes: state.notes.map((note) =>
          ids && !ids.includes(note.id)
            ? note
            : {
                ...note,
                pitch: clamp(note.pitch + semitones, minPitch, maxPitch),
              }
        ),
      }),
      description:
        "Shift note pitches by a number of semitones — all notes, or only the given ids.",
      schema: transposeSchema,
    }),
  };
}

export type PianoRollTools = ReturnType<typeof createPianoRollTools>;
