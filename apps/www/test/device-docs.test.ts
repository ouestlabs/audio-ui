import { describe, expect, test } from "bun:test";
import {
  DEVICE_DOCS,
  type DeviceDocName,
  deviceControlRows,
  expandDeviceControls,
} from "@/lib/device-docs";

const DOCS = `${import.meta.dir}/../src/content/docs`;
const names = Object.keys(DEVICE_DOCS) as DeviceDocName[];

function page(name: string) {
  return Bun.file(`${DOCS}/components/base/${name}.mdx`).text();
}

function documented(source: string) {
  return [...source.matchAll(/<Control id="([^"]+)">/g)].map((m) => m[1]);
}

describe("the device pages", () => {
  for (const name of names) {
    test(`${name} says what each of its controls does, and only its controls`, async () => {
      const source = await page(name);
      expect(source).toContain(`<DeviceControls device="${name}">`);
      const ids = deviceControlRows(name)
        .map((row) => row.id)
        .filter((id) => id !== "enabled");
      expect(documented(source).sort()).toEqual([...ids].sort());
    });
  }

  test("every device has a page in the sidebar, under one group", async () => {
    const meta = JSON.parse(
      await Bun.file(`${DOCS}/components/base/meta.json`).text()
    );
    const pages: string[] = meta.pages;
    const start = pages.indexOf("---Dynamics---");
    for (const name of names) {
      expect(pages.indexOf(name)).toBeGreaterThan(start);
    }
  });

  test("the plain-text pages get a table, not the component", async () => {
    const text = expandDeviceControls(await page("gate"));
    expect(text).not.toContain("<DeviceControls");
    expect(text).toContain("| Control | Range | Default | What it does |");
    expect(text).toContain("| Hold | 0 ms to 500 ms | 30 ms |");
    expect(text).toContain("| Threshold | -70 dB to 0 dB | -36 dB |");
  });
});

describe("the catalog sidebar", () => {
  test("puts every category in one section, and only categories", async () => {
    const { categories, categoryGroups } = await import(
      "@/registry-audio/bases/categories"
    );
    const grouped = categoryGroups.flatMap((group) => group.names);
    expect([...grouped].sort()).toEqual(
      categories.map((category) => category.name).sort()
    );
    expect(new Set(grouped).size).toBe(grouped.length);
  });
});
