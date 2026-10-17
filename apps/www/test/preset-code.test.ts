import { describe, expect, test } from "bun:test";
import {
  DEFAULT_PRESET_CODE,
  getPresetCode,
  parsePresetInput,
  readPresetCode,
} from "@/lib/design-system/preset-code";
import { serializeDesignSystemSearchParams } from "@/lib/design-system/search-params";

const rhea = {
  baseColor: "neutral",
  chartColor: "red",
  font: "instrument-sans",
  fontHeading: "inherit",
  iconLibrary: "phosphor",
  menuAccent: "subtle",
  menuColor: "default",
  radius: "medium",
  style: "rhea",
  theme: "blue",
} as const;

describe("preset code", () => {
  test("a design reads back as it was written", () => {
    expect(readPresetCode(getPresetCode(rhea))).toEqual(rhea);
  });

  test("what is left out is the default design", () => {
    expect(getPresetCode({})).toBe(DEFAULT_PRESET_CODE);
    expect(getPresetCode({ style: "rhea" })).not.toBe(DEFAULT_PRESET_CODE);
  });

  test("a code is read bare or with the flag of the command", () => {
    const code = getPresetCode(rhea);
    expect(parsePresetInput(code)).toBe(code);
    expect(parsePresetInput(`  --preset ${code} `)).toBe(code);
  });

  test("what is no code is refused", () => {
    expect(parsePresetInput("")).toBeNull();
    expect(parsePresetInput("not a code")).toBeNull();
    expect(readPresetCode("zzzzzz")).toBeNull();
  });
});

describe("a link's design", () => {
  test("is one preset code, beside what else the params hold", () => {
    const query = serializeDesignSystemSearchParams("/components", {
      item: "knob",
      style: "rhea",
      theme: "blue",
    });
    expect(query.startsWith("/components?")).toBe(true);
    const search = new URLSearchParams(query.split("?")[1]);
    expect(search.get("item")).toBe("knob");
    expect(search.get("preset")).toBe(
      getPresetCode({ style: "rhea", theme: "blue" })
    );
    expect(search.has("style")).toBe(false);
    expect(search.has("theme")).toBe(false);
  });

  test("is nothing when it is the default design", () => {
    expect(serializeDesignSystemSearchParams("/components", {})).toBe(
      "/components"
    );
    expect(
      serializeDesignSystemSearchParams("/components", { style: "nova" })
    ).toBe("/components");
  });
});
