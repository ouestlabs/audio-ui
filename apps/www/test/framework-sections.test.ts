import { expect, test } from "bun:test";
import { menuSections } from "@/lib/docs/content/frameworks";

test("the switcher lists the docs, the core, the registry and the icons", () => {
  expect(menuSections().map((section) => section.id)).toEqual([
    "docs",
    "core",
    "registry",
    "icons",
  ]);
});
