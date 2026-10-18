import { describe, expect, test } from "bun:test";
import { sync } from "../scripts/api-reference.ts";

describe("API reference", () => {
  test("every description of a component page is the JSDoc of its prop", async () => {
    const { mismatches } = await sync(false);
    expect(
      mismatches.map((item) => `${item.page} / ${item.section} / ${item.name}`)
    ).toEqual([]);
  });
});
