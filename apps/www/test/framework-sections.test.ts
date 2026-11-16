import { expect, test } from "bun:test";
import { menuSections, needsReact } from "@/lib/docs/content/frameworks";

test("registry listed for all", () => {
  for (const fw of ["react", "vue", "svelte", "web", null] as const) {
    expect(menuSections(fw, "registry").map((s) => s.id)).toContain("registry");
  }
  expect(needsReact("registry")).toBe(false);
  expect(needsReact("react")).toBe(true);
});
