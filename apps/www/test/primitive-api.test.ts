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

const apis = await build();

test("the API manifest is what the sources say: run registry:build when it is stale", async () => {
  const current = await Bun.file(MANIFEST).text();
  expect(current).toBe(`${JSON.stringify(apis, null, 2)}\n`);
});

test("every primitive has a page, and its page draws the parts, the tags and the events", async () => {
  for (const api of apis) {
    const path = PAGES[api.name];
    expect(path, `${api.name} has no page in this test`).toBeDefined();
    const page = await Bun.file(join(DOCS, path ?? "")).text();
    for (const tag of ["PrimitiveParts", "PrimitiveTags", "PrimitiveEvents"]) {
      expect(page, `${api.name}: ${tag}`).toContain(
        `<${tag} name="${api.name}" />`
      );
    }
  }
});

test("every option of a primitive is in the Options of its page", async () => {
  const missing: string[] = [];
  for (const api of apis) {
    const page = await Bun.file(join(DOCS, PAGES[api.name] ?? "")).text();
    for (const option of api.options) {
      if (!page.includes(`\`${option.name}\``)) {
        missing.push(`${api.name}: ${option.name}`);
      }
    }
  }
  expect(missing).toEqual([]);
});

test("the three adapters of a primitive export the same parts", async () => {
  const ADAPTERS = join(
    import.meta.dir,
    "../src/registry-audio/bases/base/primitives"
  );
  const exportsOf = (text: string) =>
    [
      ...(/export const \w+ = \{([\s\S]*?)\};/.exec(text)?.[1] ?? "").matchAll(
        /(?:^|,)\s*(\w+)/g
      ),
    ]
      .map((match) => match[1])
      .sort();
  for (const api of apis) {
    const vue = exportsOf(
      await Bun.file(join(ADAPTERS, api.name, "vue/index.ts")).text()
    );
    const react = exportsOf(
      await Bun.file(join(ADAPTERS, api.name, "react/index.tsx")).text()
    );
    const svelte = exportsOf(
      await Bun.file(join(ADAPTERS, api.name, "svelte/index.ts")).text()
    );
    expect(react, `${api.name}: React`).toEqual(vue);
    expect(svelte, `${api.name}: Svelte`).toEqual(vue);
  }
});
