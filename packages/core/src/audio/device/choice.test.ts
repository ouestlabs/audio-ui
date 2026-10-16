import { describe, expect, test } from "bun:test";
import { DeviceDefinitionError, defineDevice, deviceTools } from "./index.ts";

const WAVES = [
  { label: "Sine", value: "sine" },
  { label: "Square", value: "square" },
  { label: "Saw", value: "sawtooth" },
] as const;

const synth = defineDevice({
  description: "A voice with a waveform and a level.",
  id: "audioui.test-synth",
  kind: "instrument",
  name: "Synth",
  parameters: [
    {
      default: "square",
      id: "wave",
      kind: "choice",
      label: "Wave",
      options: WAVES,
    },
    { default: 0.5, id: "volume", label: "Volume", max: 1, min: 0 },
  ],
});

const [set] = deviceTools(synth);

describe("a choice parameter", () => {
  test("its state holds the value of the option", () => {
    const state = synth.defaults();
    expect(state.wave).toBe("square");
    // The state is typed by the options: this line only compiles with a real value.
    const next: typeof state = { ...state, wave: "sawtooth" };
    expect(next.wave).toBe("sawtooth");
  });

  test("clamps to an option and falls back to the default", () => {
    expect(synth.clampValue("wave", "sine")).toBe("sine");
    expect(synth.clampValue("wave", "triangle")).toBe("square");
    expect(synth.clampValue("wave", 3)).toBe("square");
    expect(synth.sanitize({ wave: "nope", volume: 2 })).toEqual({
      volume: 1,
      wave: "square",
    });
  });

  test("normalizes by place in the list and back", () => {
    expect(synth.normalize("wave", "sine")).toBe(0);
    expect(synth.normalize("wave", "square")).toBe(0.5);
    expect(synth.normalize("wave", "sawtooth")).toBe(1);
    expect(synth.denormalize("wave", 0.9)).toBe("sawtooth");
    expect(synth.denormalize("wave", -1)).toBe("sine");
  });

  test("prints the label of the option", () => {
    expect(synth.format("wave", "sawtooth")).toBe("Saw");
    expect(synth.format("wave", "nope")).toBe("");
  });

  test("apply changes it, and refuses a value that is not an option by name", () => {
    const changed = synth.apply(synth.defaults(), { wave: "sine" });
    expect(changed.state.wave).toBe("sine");
    expect(changed.changes).toEqual([
      { adjusted: false, from: "square", id: "wave", to: "sine" },
    ]);
    const refused = synth.apply(synth.defaults(), { wave: "triangle" });
    expect(refused.state.wave).toBe("square");
    expect(refused.rejected).toEqual([
      { id: "wave", reason: "not one of the options" },
    ]);
  });

  test("describes itself with its options, as JSON", () => {
    const [wave] = synth.describe().parameters;
    expect(wave).toEqual({
      default: "square",
      id: "wave",
      label: "Wave",
      options: [
        { label: "Sine", value: "sine" },
        { label: "Square", value: "square" },
        { label: "Saw", value: "sawtooth" },
      ],
      type: "string",
    });
    expect(synth.kind).toBe("instrument");
  });

  test("the tool tells a model the values it may send", () => {
    const wave = set?.inputSchema.properties?.wave;
    expect(wave?.type).toBe("string");
    expect(wave?.enum).toEqual(["sine", "square", "sawtooth"]);
    const result = set?.run(synth.defaults(), { wave: "sawtooth" });
    expect(result?.summary).toBe("Wave: Square to Saw");
    expect(set?.run(synth.defaults(), { wave: "fuzz" })?.summary).toBe(
      "wave: refused, not one of the options"
    );
  });

  test("a choice that cannot work is named when defined", () => {
    const define = (
      options: readonly { label: string; value: string }[],
      d: string
    ) =>
      defineDevice({
        description: "x",
        id: "audioui.bad",
        name: "Bad",
        parameters: [
          { default: d, id: "mode", kind: "choice", label: "Mode", options },
        ],
      });
    expect(() => define([{ label: "A", value: "a" }], "a")).toThrow(
      DeviceDefinitionError
    );
    expect(() =>
      define(
        [
          { label: "A", value: "a" },
          { label: "B", value: "a" },
        ],
        "a"
      )
    ).toThrow("audioui.bad.mode: two options have the same value.");
    expect(() =>
      define(
        [
          { label: "A", value: "a" },
          { label: "B", value: "b" },
        ],
        "c"
      )
    ).toThrow("the default is not one of the options");
  });
});
