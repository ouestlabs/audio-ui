import { expect, test } from "bun:test";

test("the template types match the elements' attributes, properties and events", async () => {
  // In a process of its own: it registers the elements in a window of its own.
  const check =
    await Bun.$`bun ${import.meta.dir}/../scripts/templates.ts --check`
      .nothrow()
      .quiet();
  expect(check.stderr.toString()).toBe("");
  expect(check.exitCode).toBe(0);
});
