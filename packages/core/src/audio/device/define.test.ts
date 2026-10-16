import { describe, expect, test } from "bun:test";
import { DeviceDefinitionError, defineDevice } from "./index.ts";

const compressor = defineDevice({
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

describe("defineDevice", () => {
  test("carries what it is", () => {
    expect(compressor.id).toBe("audioui.compressor");
    expect(compressor.kind).toBe("effect");
    expect(compressor.parameters.map((parameter) => parameter.id)).toEqual([
      "enabled",
      "thresholdDb",
      "ratio",
      "release",
    ]);
  });

  test("has defaults, a new object each time, typed by its parameter ids", () => {
    const state = compressor.defaults();
    expect(state).toEqual({
      enabled: true,
      ratio: 4,
      release: 80,
      thresholdDb: -18,
    });
    // Typed: a number and a boolean, by id.
    const threshold: number = state.thresholdDb;
    const enabled: boolean = state.enabled;
    expect([threshold, enabled]).toEqual([-18, true]);
    expect(compressor.defaults()).not.toBe(state);
  });

  test("an instrument says so", () => {
    const synth = defineDevice({
      description: "A tone.",
      id: "audioui.tone",
      kind: "instrument",
      name: "Tone",
      parameters: [
        { default: 440, id: "hz", label: "Pitch", max: 2000, min: 20 },
      ],
    });
    expect(synth.kind).toBe("instrument");
  });
});

describe("definition errors", () => {
  const define = (
    parameters: Parameters<typeof defineDevice>[0]["parameters"]
  ) =>
    defineDevice({ description: "x", id: "audioui.x", name: "X", parameters });

  test("name the parameter", () => {
    expect(() =>
      define([{ default: 5, id: "gain", label: "Gain", max: 1, min: 0 }])
    ).toThrow("audioui.x.gain: the default is not within min and max.");
    expect(() =>
      define([{ default: 0, id: "gain", label: "Gain", max: 0, min: 0 }])
    ).toThrow("min must be below max");
    expect(() =>
      define([
        { default: 1, id: "hz", label: "Hz", max: 2, min: 0, scale: "log" },
      ])
    ).toThrow("a log scale needs a min above 0");
    expect(() =>
      define([{ default: 1, id: "a", label: "A", max: 2, min: 0, step: 0 }])
    ).toThrow("step must be above 0");
  });

  test("refuses a duplicate id, an empty id and an empty label", () => {
    expect(() =>
      define([
        { default: 0, id: "a", label: "A", max: 1, min: 0 },
        { default: 0, id: "a", label: "A2", max: 1, min: 0 },
      ])
    ).toThrow("two parameters have this id");
    expect(() =>
      define([{ default: 0, id: " ", label: "A", max: 1, min: 0 }])
    ).toThrow("has no id");
    expect(() =>
      define([{ default: 0, id: "a", label: "", max: 1, min: 0 }])
    ).toThrow("no label");
    expect(() =>
      defineDevice({ description: "x", id: "", name: "X", parameters: [] })
    ).toThrow("needs an id");
  });

  test("is a DeviceDefinitionError", () => {
    expect(() =>
      define([{ default: 2, id: "a", label: "A", max: 1, min: 0 }])
    ).toThrow(DeviceDefinitionError);
  });

  test("refuses a toggle whose default is not a boolean", () => {
    expect(() =>
      define([
        {
          default: 1 as unknown as boolean,
          id: "on",
          kind: "toggle",
          label: "On",
        },
      ])
    ).toThrow("true or false");
  });
});

describe("clampValue", () => {
  test("brings a number into bounds and onto its grid", () => {
    expect(compressor.clampValue("thresholdDb", -100)).toBe(-60);
    expect(compressor.clampValue("thresholdDb", 12)).toBe(0);
    expect(compressor.clampValue("thresholdDb", -17.8)).toBe(-18);
    expect(compressor.clampValue("ratio", 2.34)).toBe(2.3);
  });

  test("does not leave float drift on a grid", () => {
    expect(compressor.clampValue("ratio", 1.3)).toBe(1.3);
    expect(compressor.clampValue("ratio", 3 * 0.1 + 1)).toBe(1.3);
  });

  test("falls back to the default for what is not a number", () => {
    for (const bad of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "loud",
      null,
      undefined,
    ]) {
      expect(compressor.clampValue("thresholdDb", bad)).toBe(-18);
    }
  });

  test("a toggle takes a boolean and nothing else", () => {
    expect(compressor.clampValue("enabled", false)).toBe(false);
    expect(compressor.clampValue("enabled", 0)).toBe(true);
    expect(compressor.clampValue("enabled", "off")).toBe(true);
  });

  test("a grid that does not end on max still ends inside", () => {
    const odd = defineDevice({
      description: "x",
      id: "audioui.odd",
      name: "Odd",
      parameters: [
        { default: 0, id: "a", label: "A", max: 10, min: 0, step: 4 },
      ],
    });
    expect(odd.clampValue("a", 10)).toBe(8);
    expect(odd.clampValue("a", 9.5)).toBe(8);
  });
});

describe("set and sanitize", () => {
  test("set returns a new state, clamped, and leaves the old one", () => {
    const before = compressor.defaults();
    const after = compressor.set(before, "thresholdDb", -200);
    expect(after.thresholdDb).toBe(-60);
    expect(before.thresholdDb).toBe(-18);
    expect(after).not.toBe(before);
  });

  test("set ignores an id the device does not have", () => {
    const before = compressor.defaults();
    expect(compressor.set(before, "reverb", 1)).toBe(before);
  });

  test("sanitize drops unknown ids, defaults missing ones and repairs bad ones", () => {
    const state = compressor.sanitize({
      extra: 1,
      ratio: 999,
      release: Number.NaN,
      thresholdDb: "hot",
    });
    expect(state).toEqual({
      enabled: true,
      ratio: 20,
      release: 80,
      thresholdDb: -18,
    });
    expect("extra" in state).toBe(false);
  });

  test("sanitize reads a state a host loaded from a saved project", () => {
    const saved = JSON.parse(
      JSON.stringify({ enabled: false, thresholdDb: -30 })
    );
    expect(compressor.sanitize(saved)).toMatchObject({
      enabled: false,
      ratio: 4,
      thresholdDb: -30,
    });
  });
});

describe("normalize and denormalize", () => {
  test("are inverses on a linear scale", () => {
    expect(compressor.normalize("thresholdDb", -30)).toBeCloseTo(0.5, 12);
    expect(compressor.denormalize("thresholdDb", 0.5)).toBe(-30);
  });

  test("follow a log scale: the middle of the travel is the geometric mean", () => {
    expect(compressor.denormalize("release", 0.5)).toBeCloseTo(100, 0);
    expect(compressor.normalize("release", 100)).toBeCloseTo(0.5, 6);
  });

  test("a toggle is 0 or 1", () => {
    expect(compressor.normalize("enabled", true)).toBe(1);
    expect(compressor.normalize("enabled", false)).toBe(0);
    expect(compressor.denormalize("enabled", 0.7)).toBe(true);
    expect(compressor.denormalize("enabled", 0.2)).toBe(false);
  });

  test("a position outside the travel is clamped", () => {
    expect(compressor.denormalize("thresholdDb", 2)).toBe(0);
    expect(compressor.denormalize("thresholdDb", -1)).toBe(-60);
    expect(compressor.denormalize("thresholdDb", Number.NaN)).toBe(-60);
  });

  test("an unknown id is NaN, never a wrong value", () => {
    expect(compressor.normalize("reverb" as never, 1)).toBeNaN();
    expect(compressor.denormalize("reverb" as never, 0.5)).toBeNaN();
  });
});

describe("format", () => {
  test("prints a value with as many decimals as its step and its unit", () => {
    expect(compressor.format("thresholdDb", -18)).toBe("-18.0 dB");
    expect(compressor.format("ratio", 4)).toBe("4.0");
    expect(compressor.format("release", 80)).toBe("80 ms");
  });

  test("prints a toggle as On or Off", () => {
    expect(compressor.format("enabled", true)).toBe("On");
    expect(compressor.format("enabled", false)).toBe("Off");
  });

  test("uses a parameter's own formatter", () => {
    const device = defineDevice({
      description: "x",
      id: "audioui.f",
      name: "F",
      parameters: [
        {
          default: 1000,
          format: (hz) => (hz >= 1000 ? `${hz / 1000} kHz` : `${hz} Hz`),
          id: "hz",
          label: "Hz",
          max: 20_000,
          min: 20,
        },
      ],
    });
    expect(device.format("hz", 1000)).toBe("1 kHz");
  });

  test("is empty for an id it does not have", () => {
    expect(compressor.format("reverb" as never, 1)).toBe("");
  });
});
