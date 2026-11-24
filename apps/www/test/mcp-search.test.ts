import { describe, expect, test } from "bun:test";
import { closest, nearest, searchDocs } from "@/lib/agents/doc-search";

const PAGES = [
  {
    markdown: [
      "# Knob",
      "",
      "## Usage",
      "",
      "A dial you turn.",
      "",
      "## Scale",
      "",
      "A log scale suits frequency: every decade gets the same share of the dial.",
      "",
      "```ts",
      "const scale = 'log';",
      "```",
    ].join("\n"),
    name: "knob",
  },
  {
    markdown: [
      "# Fader",
      "",
      "## Usage",
      "",
      "A slider for levels, in dB.",
      "",
      "## Scale",
      "",
      "Linear by default.",
    ].join("\n"),
    name: "fader",
  },
];

describe("searchDocs", () => {
  test("ranks the section that answers the question first", () => {
    const [top] = searchDocs(PAGES, "log scale frequency", 5);
    expect(top?.component).toBe("knob");
    expect(top?.section).toBe("scale");
  });

  test("names a hit by its component and its section slug", () => {
    const hits = searchDocs(PAGES, "slider", 5);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.component).toBe("fader");
    expect(hits[0]?.section).toBe("usage");
    expect(hits[0]?.snippet).toBe("A slider for levels, in dB.");
  });

  test("weighs a term in the heading and the page name", () => {
    const [top] = searchDocs(PAGES, "usage fader", 5);
    expect(top?.component).toBe("fader");
  });

  test("returns nothing for an empty or unmatched query", () => {
    expect(searchDocs(PAGES, "  ", 5)).toEqual([]);
    expect(searchDocs(PAGES, "reverb", 5)).toEqual([]);
  });

  test("stops at the limit", () => {
    expect(searchDocs(PAGES, "usage scale", 2)).toHaveLength(2);
  });
});

describe("closest", () => {
  const known = ["knob", "fader", "piano", "piano-roll", "xypad"];

  test("suggests a plural, a typo and a name inside another", () => {
    expect(closest("knobs", known)).toEqual(["knob"]);
    expect(closest("fadr", known)).toEqual(["fader"]);
    expect(closest("pianoroll", known)[0]).toBe("piano-roll");
  });

  test("suggests nothing when no name is close", () => {
    expect(closest("reverb", known)).toEqual([]);
  });
});

describe("nearest", () => {
  const known = [
    "auto-pan",
    "channel-eq",
    "gate",
    "knob",
    "lcd",
    "led",
    "pad",
    "piano",
    "piano-roll",
    "tape-keys",
    "tilt-eq",
    "wah",
    "xypad",
  ];

  test("answers the one name within two edits", () => {
    expect(nearest("knobb", known)).toBe("knob");
    expect(nearest("pianoroll", known)).toBe("piano-roll");
    expect(nearest("Piano Roll", known)).toBe("piano-roll");
    expect(nearest("xy-pad", known)).toBe("xypad");
    expect(nearest("gat", known)).toBe("gate");
  });

  test("answers nothing when two names are as near, or a longer name holds the query", () => {
    expect(nearest("lad", known)).toBeUndefined();
    expect(nearest("pan", known)).toBeUndefined();
    expect(nearest("eq", known)).toBeUndefined();
    expect(nearest("tape", known)).toBeUndefined();
  });

  test("answers nothing beyond two edits", () => {
    expect(nearest("knob-large", known)).toBeUndefined();
    expect(nearest("reverb", known)).toBeUndefined();
  });
});
