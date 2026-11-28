import { describe, expect, test } from "bun:test";
import { contractParams, defineDevice } from "./index";

const device = defineDevice({
  description: "One parameter of each kind.",
  id: "test.contract",
  name: "Contract",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: "soft",
      id: "mode",
      kind: "choice",
      label: "Mode",
      options: [
        { label: "Soft", value: "soft" },
        { label: "Hard", value: "hard" },
      ],
    },
    {
      default: 1000,
      id: "cutoff",
      label: "Cutoff",
      max: 20_000,
      min: 20,
      scale: "log",
      step: 1,
      unit: "Hz",
    },
    {
      default: 50,
      id: "mix",
      label: "Mix",
      max: 100,
      min: 0,
      step: 3,
      unit: "%",
    },
  ],
});

describe("contractParams", () => {
  test("declares each kind of parameter, in the device's order", () => {
    const params = contractParams(device);
    expect(Object.keys(params)).toEqual(["enabled", "mode", "cutoff", "mix"]);
    expect(params.enabled).toEqual({ default: true, type: "bool" });
    expect(params.mode).toEqual({
      default: "soft",
      type: "enum",
      values: ["soft", "hard"],
    });
    expect(params.cutoff).toEqual({
      curve: "log",
      default: 1000,
      max: 20_000,
      min: 20,
      step: 1,
      type: "number",
      unit: "Hz",
    });
  });

  test("leaves out a unit the contract does not name and a step that does not divide the range", () => {
    expect(contractParams(device).mix).toEqual({
      default: 50,
      max: 100,
      min: 0,
      type: "number",
    });
  });
});
