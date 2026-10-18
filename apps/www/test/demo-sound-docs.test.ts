import { describe, expect, test } from "bun:test";
import {
  demoSoundsTable,
  expandDemoSounds,
} from "@/lib/docs/content/demo-sound-docs";
import { DEMO_SOURCES } from "@/registry-audio/bases/base/lib/demo-sound";

describe("expandDemoSounds", () => {
  test("turns the tag into a table with every sound of the library", () => {
    const table = demoSoundsTable();
    for (const [name, source] of Object.entries(DEMO_SOURCES)) {
      expect(table).toContain(`\`${name}\``);
      expect(table).toContain(source.title);
      expect(table).toContain(source.about);
    }
  });

  test("replaces the tag and leaves the rest of the page", () => {
    const page = "Before\n\n<DemoSounds />\n\nAfter";
    const result = expandDemoSounds(page);
    expect(result).not.toContain("<DemoSounds");
    expect(result.startsWith("Before")).toBe(true);
    expect(result.endsWith("After")).toBe(true);
  });
});
