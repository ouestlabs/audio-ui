import { mock } from "bun:test";

/**
 * The docs source, the docs reader and the registry are built by Vite
 * (import.meta.glob), so the tests of what agents read stand them in with
 * these few pages and blocks. Module mocks hold for the whole test run:
 * every test file that needs them imports this one, so they all see the same.
 */

export const PAGES = [
  {
    data: { description: "Start here.", title: "Introduction" },
    path: "(root)/index.mdx",
    slugs: [],
    url: "/docs",
  },
  {
    data: { description: "A rotary control.", title: "Knob" },
    path: "components/base/(elements)/knob.mdx",
    slugs: ["components", "base", "knob"],
    url: "/docs/components/base/knob",
  },
  {
    data: { description: "Evens out the level.", title: "Compressor" },
    path: "components/base/(devices)/compressor.mdx",
    slugs: ["components", "base", "compressor"],
    url: "/docs/components/base/compressor",
  },
  {
    data: { description: "What makes the sound.", title: "Overview" },
    path: "engine/index.mdx",
    slugs: ["engine"],
    url: "/docs/engine",
  },
  {
    data: {
      description: "A clock that schedules notes ahead.",
      title: "Clock and time",
    },
    path: "engine/clock-and-time.mdx",
    slugs: ["engine", "clock-and-time"],
    url: "/docs/engine/clock-and-time",
  },
];

/** The sidebar's tree: one space, the Audio engine, its first page alone and the next under a separator. */
const PAGE_TREE = {
  children: [
    {
      children: [
        { name: "Overview", type: "page", url: "/docs/engine" },
        { name: "Time", type: "separator" },
        {
          name: "Clock and time",
          type: "page",
          url: "/docs/engine/clock-and-time",
        },
      ],
      name: "Audio engine",
      type: "folder",
    },
  ],
};

const DOCS: Record<string, string> = {
  "components/base/(devices)/compressor.mdx": [
    "# Compressor",
    "",
    "## Installation",
    "",
    "Add the device.",
    "",
    "## Usage",
    "",
    "Set the threshold and the ratio.",
  ].join("\n"),
  "components/base/(elements)/knob.mdx": [
    "# Knob",
    "",
    "## Installation",
    "",
    "Run the command.",
    "",
    "## API reference",
    "",
    "A log scale suits frequency: every decade gets the same share of the dial.",
  ].join("\n"),
};

export const CATALOG = [
  {
    categories: ["synth"],
    description: "A synth you can play.",
    name: "block-pocket-synth",
    title: "Pocket synth",
  },
  {
    categories: ["player"],
    description: "A waveform player.",
    name: "block-waveform-player",
    title: "Waveform player",
  },
];

mock.module("@/lib/docs/content/source", () => ({
  source: {
    getPages: () => PAGES,
    getPageTree: () => PAGE_TREE,
  },
}));
mock.module("@/lib/docs/content/docs-text", () => ({
  processMdxForLLMs: (raw: string) => Promise.resolve(raw),
  readRawDoc: (path: string) => Promise.resolve(DOCS[path] ?? ""),
}));
mock.module("@/lib/registry/core/registry", () => ({
  getAllCatalogItems: () => CATALOG,
  getCategoryDocsDescription: () => undefined,
  searchCatalog: (query: string) =>
    CATALOG.filter((item) => item.categories.includes(query.trim())),
}));
