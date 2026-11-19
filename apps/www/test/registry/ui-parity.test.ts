import { expect, test } from "bun:test";
import { ui as base } from "@/registry/bases/base/ui/_registry";
import { ui as uiSdk } from "@/registry/bases/ui-sdk/ui/_registry";

// shadcn's toast is sonner: ui-sdk has its own toast.
const OWN = new Set(["sonner", "toast"]);
const shared = (items: { name: string }[]) =>
  items.map((item) => item.name).filter((name) => !OWN.has(name));

test("both bases publish the same ui components", () => {
  expect(shared(base).sort()).toEqual(shared(uiSdk).sort());
});
