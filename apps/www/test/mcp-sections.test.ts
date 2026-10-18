import { describe, expect, test } from "bun:test";
import {
  pickSection,
  sectionNames,
  sectionSlug,
} from "@/lib/agents/doc-sections";

const PAGE = [
  "# Knob",
  "",
  "Intro text.",
  "",
  "## Installation",
  "",
  "```bash",
  "## not a heading, a shell comment",
  "```",
  "",
  "## API reference",
  "",
  "### Root",
  "",
  "Root props.",
  "",
  "## Examples",
  "",
  "Examples text.",
].join("\n");

describe("sectionSlug", () => {
  test("turns a heading into a section name", () => {
    expect(sectionSlug("API reference")).toBe("api-reference");
    expect(sectionSlug("  Installation ")).toBe("installation");
    expect(sectionSlug("Rail, anchor, and range")).toBe(
      "rail-anchor-and-range"
    );
  });
});

describe("sectionNames", () => {
  test("lists the h2 sections in order, skipping fenced code", () => {
    expect(sectionNames(PAGE)).toEqual([
      "installation",
      "api-reference",
      "examples",
    ]);
  });
});

describe("pickSection", () => {
  test("returns a section with its h3 subsections, up to the next h2", () => {
    expect(pickSection(PAGE, "api-reference")).toBe(
      ["## API reference", "", "### Root", "", "Root props."].join("\n")
    );
  });

  test("keeps a fenced line that starts with ## inside its section", () => {
    expect(pickSection(PAGE, "installation")).toBe(
      [
        "## Installation",
        "",
        "```bash",
        "## not a heading, a shell comment",
        "```",
      ].join("\n")
    );
  });

  test("returns the last section to the end of the page", () => {
    expect(pickSection(PAGE, "examples")).toBe("## Examples\n\nExamples text.");
  });

  test("returns nothing for a section the page does not have", () => {
    expect(pickSection(PAGE, "accessibility")).toBeUndefined();
  });
});
