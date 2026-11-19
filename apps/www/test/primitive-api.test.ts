import { expect, test } from "bun:test";
import { join } from "node:path";
import { build, MANIFEST } from "../scripts/build-primitive-api.ts";

const DOCS = join(import.meta.dir, "../src/content/docs/components/base");

/** The page of each primitive: the timeline's is the arrangement's. */
const PAGES: Record<string, string> = {
  envelope: "(elements)/envelope.mdx",
  fader: "(elements)/fader.mdx",
  knob: "(elements)/knob.mdx",
  meter: "(elements)/meter.mdx",
  pad: "(elements)/pad.mdx",
  piano: "(elements)/piano.mdx",
  "piano-roll": "(workstation)/piano-roll.mdx",
  plot: "(elements)/plot.mdx",
  sequencer: "(workstation)/sequencer.mdx",
  timeline: "(workstation)/arrangement.mdx",
  waveform: "(elements)/waveform.mdx",
  xypad: "(elements)/xypad.mdx",
};

// What an adapter exports, and each name in it.
const EXPORTED_OBJECT = /export const \w+ = \{([\s\S]*?)\};/;
const EXPORTED_NAME = /(?:^|,)\s*(\w+)/g;

const ADAPTERS = join(import.meta.dir, "../src/registry/primitives");

const apis = await build();

test("the API manifest is what the sources say: run registry:build when it is stale", async () => {
  const current = await Bun.file(MANIFEST).text();
  expect(current).toBe(`${JSON.stringify(apis, null, 2)}\n`);
});

test("every primitive has a page, and its page draws the parts, the tags and the events", async () => {
  const pages = await Promise.all(
    apis.map(async (api) => {
      const path = PAGES[api.name];
      expect(path, `${api.name} has no page in this test`).toBeDefined();
      return { api, page: await Bun.file(join(DOCS, path ?? "")).text() };
    })
  );
  for (const { api, page } of pages) {
    for (const tag of ["PrimitiveParts", "PrimitiveTags", "PrimitiveEvents"]) {
      expect(page, `${api.name}: ${tag}`).toContain(
        `<${tag} name="${api.name}" />`
      );
    }
  }
});

test("every option of a primitive is in the Options of its page", async () => {
  const missing: string[] = [];
  const pages = await Promise.all(
    apis.map(async (api) => ({
      api,
      page: await Bun.file(join(DOCS, PAGES[api.name] ?? "")).text(),
    }))
  );
  for (const { api, page } of pages) {
    for (const option of api.options) {
      if (!page.includes(`\`${option.name}\``)) {
        missing.push(`${api.name}: ${option.name}`);
      }
    }
  }
  expect(missing).toEqual([]);
});

test("the three adapters of a primitive export the same parts", async () => {
  const exportsOf = (text: string) =>
    [...(EXPORTED_OBJECT.exec(text)?.[1] ?? "").matchAll(EXPORTED_NAME)]
      .map((match) => match[1])
      .sort();
  const adapters = await Promise.all(
    apis.map(async (api) => {
      const read = async (path: string) =>
        exportsOf(await Bun.file(join(ADAPTERS, api.name, path)).text());
      return {
        name: api.name,
        react: await read("react/index.tsx"),
        svelte: await read("svelte/index.ts"),
        vue: await read("vue/index.ts"),
      };
    })
  );
  for (const { name, react, svelte, vue } of adapters) {
    expect(react, `${name}: React`).toEqual(vue);
    expect(svelte, `${name}: Svelte`).toEqual(vue);
  }
});
