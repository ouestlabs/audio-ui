import { describe, expect, test } from "bun:test";
import { AXES, AXIS_ORDER, lookDeclarations } from "@/lib/design-system/look";

describe("the Look", () => {
  test("lists every axis, the material first", () => {
    expect<string[]>([...AXIS_ORDER].sort()).toEqual(Object.keys(AXES).sort());
    expect(AXIS_ORDER[0]).toBe("--audio-shade");
  });

  test("sets only the axes the reader chose, as CSS declarations", () => {
    expect(
      lookDeclarations({ "--audio-depth": "0", "--audio-shade": "bronze" })
    ).toEqual(["--audio-shade: oklch(0.62 0.06 60);", "--audio-depth: 0;"]);
  });

  test("ignores a value it does not offer", () => {
    expect(lookDeclarations({ "--audio-accent": "red; } * {" })).toEqual([]);
  });
});
