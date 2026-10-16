import { describe, expect, test } from "bun:test";
import { defineDevice, deviceTools } from "./index.ts";

/** A name every model API accepts. */
const TOOL_NAME = /^[a-zA-Z0-9_-]{1,64}$/;

const device = defineDevice({
  description: "Brings loud parts down.",
  id: "audioui.compressor",
  name: "Compressor",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: -18,
      id: "thresholdDb",
      label: "Threshold",
      max: 0,
      min: -60,
      step: 0.5,
      unit: "dB",
    },
    { default: 4, id: "ratio", label: "Ratio", max: 20, min: 1, step: 0.1 },
    {
      default: 80,
      id: "release",
      label: "Release",
      max: 1000,
      min: 10,
      scale: "log",
      unit: "ms",
    },
  ],
});

describe("describe", () => {
  test("is JSON: what a catalog lists and an agent is told", () => {
    const description = device.describe();
    expect(JSON.parse(JSON.stringify(description))).toEqual(description);
    expect(description).toMatchObject({
      id: "audioui.compressor",
      kind: "effect",
      name: "Compressor",
    });
    expect(description.parameters).toEqual([
      { default: true, id: "enabled", label: "On", type: "boolean" },
      {
        default: -18,
        id: "thresholdDb",
        label: "Threshold",
        max: 0,
        min: -60,
        scale: "linear",
        step: 0.5,
        type: "number",
        unit: "dB",
      },
      {
        default: 4,
        id: "ratio",
        label: "Ratio",
        max: 20,
        min: 1,
        scale: "linear",
        step: 0.1,
        type: "number",
        unit: undefined,
      },
      {
        default: 80,
        id: "release",
        label: "Release",
        max: 1000,
        min: 10,
        scale: "log",
        step: undefined,
        type: "number",
        unit: "ms",
      },
    ]);
  });

  test("calls a scale given as functions custom: the range alone does not say how it travels", () => {
    const custom = defineDevice({
      description: "x",
      id: "audioui.c",
      name: "C",
      parameters: [
        {
          default: 0.5,
          id: "a",
          label: "A",
          max: 1,
          min: 0,
          scale: { toPosition: (v) => v, toValue: (p) => p },
        },
      ],
    });
    expect(custom.describe().parameters[0]?.scale).toBe("custom");
  });
});

describe("apply", () => {
  test("changes what was asked and says from what to what", () => {
    const state = device.defaults();
    const result = device.apply(state, { ratio: 8, thresholdDb: -24 });
    expect(result.state).toMatchObject({ ratio: 8, thresholdDb: -24 });
    expect(result.changes).toEqual([
      { adjusted: false, from: 4, id: "ratio", to: 8 },
      { adjusted: false, from: -18, id: "thresholdDb", to: -24 },
    ]);
    expect(result.rejected).toEqual([]);
  });

  test("brings a value into range and marks it adjusted", () => {
    const result = device.apply(device.defaults(), {
      ratio: 400,
      thresholdDb: -17.8,
    });
    expect(result.state).toMatchObject({ ratio: 20, thresholdDb: -18 });
    // -17.8 snaps to -18, which is where it already was: no change.
    expect(result.changes).toEqual([
      { adjusted: true, from: 4, id: "ratio", to: 20 },
    ]);
  });

  test("refuses what it cannot read instead of replacing it with a default", () => {
    const state = device.set(device.defaults(), "ratio", 10);
    const result = device.apply(state, {
      enabled: "yes",
      ratio: "high",
      reverb: 1,
      thresholdDb: Number.NaN,
    });
    expect(result.state).toEqual(state);
    expect(result.changes).toEqual([]);
    expect(result.rejected).toEqual([
      { id: "enabled", reason: "not a boolean" },
      { id: "ratio", reason: "not a number" },
      { id: "reverb", reason: "unknown parameter" },
      { id: "thresholdDb", reason: "not a number" },
    ]);
  });

  test("a value equal to the current one is not a change", () => {
    const result = device.apply(device.defaults(), { ratio: 4 });
    expect(result.changes).toEqual([]);
  });

  test("applies the valid part of a mixed request and leaves the state it was given", () => {
    const state = device.defaults();
    const result = device.apply(state, { ratio: 2, reverb: 1 });
    expect(result.state.ratio).toBe(2);
    expect(result.rejected).toHaveLength(1);
    expect(state.ratio).toBe(4);
  });

  test("a toggle changes", () => {
    const result = device.apply(device.defaults(), { enabled: false });
    expect(result.state.enabled).toBe(false);
    expect(result.changes).toEqual([
      { adjusted: false, from: true, id: "enabled", to: false },
    ]);
  });
});

describe("deviceTools", () => {
  const [set, reset] = deviceTools(device);

  test("are named so a model API accepts them", () => {
    expect(set?.name).toBe("audioui_compressor_set");
    expect(reset?.name).toBe("audioui_compressor_reset");
    for (const tool of [set, reset]) {
      expect(tool?.name).toMatch(TOOL_NAME);
      expect(tool?.description.length).toBeGreaterThan(10);
    }
  });

  test("tell the model the ranges the device enforces, as JSON Schema", () => {
    const schema = set?.inputSchema as {
      properties: Record<string, Record<string, unknown>>;
    };
    expect(JSON.parse(JSON.stringify(schema))).toEqual(schema);
    expect(schema.properties.thresholdDb).toMatchObject({
      maximum: 0,
      minimum: -60,
      multipleOf: 0.5,
      type: "number",
    });
    expect(schema.properties.enabled).toMatchObject({ type: "boolean" });
    const release = schema.properties.release as { description: string };
    expect(release.description).toContain("log scale");
  });

  test("set changes the state and reports it in a sentence", () => {
    const result = set?.run(device.defaults(), { ratio: 8, thresholdDb: -300 });
    expect(result?.state).toMatchObject({ ratio: 8, thresholdDb: -60 });
    expect(result?.summary).toContain("Ratio: 4.0 to 8.0");
    expect(result?.summary).toContain(
      "Threshold: -18.0 dB to -60.0 dB (brought into range)"
    );
  });

  test("set refuses what is not a parameter, by name", () => {
    const result = set?.run(device.defaults(), { reverb: 1 });
    expect(result?.summary).toBe("reverb: refused, unknown parameter");
  });

  test("never throws on what a model sends", () => {
    for (const input of [null, undefined, "loud", 12, [], { ratio: {} }]) {
      expect(() => set?.run(device.defaults(), input)).not.toThrow();
      expect(() => reset?.run(device.defaults(), input)).not.toThrow();
    }
    expect(set?.run(device.defaults(), "loud")?.summary).toContain(
      "give an object"
    );
  });

  test("reset puts all back, or the ones named", () => {
    const moved = device.apply(device.defaults(), {
      ratio: 10,
      thresholdDb: -40,
    }).state;
    expect(reset?.run(moved, {})?.state).toEqual(device.defaults());
    const some = reset?.run(moved, { ids: ["ratio"] });
    expect(some?.state).toMatchObject({ ratio: 4, thresholdDb: -40 });
    expect(some?.summary).toBe("Ratio: back to 4.0");
  });

  test("reset names an id it does not have and says when there is nothing to do", () => {
    expect(reset?.run(device.defaults(), { ids: ["reverb"] })?.summary).toBe(
      "reverb: refused, unknown parameter"
    );
    expect(reset?.run(device.defaults(), {})?.summary).toBe(
      "Already at the defaults."
    );
  });
});
