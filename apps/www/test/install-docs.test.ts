import { describe, expect, test } from "bun:test";
import {
  expandInstall,
  installMdx,
  installPlan,
  parseInstallProps,
} from "@/lib/docs/content/install-docs";

const DOCS = `${import.meta.dir}/../src/content/docs`;
const BUILT = `${import.meta.dir}/../public/r/styles/base-nova`;
const INSTALL_TAG = /<Install\s+([^>]*?)\/>/g;

describe("installPlan", () => {
  test("a component installs by its name, and its source is shown as a file of the project", () => {
    const plan = installPlan({ name: "knob", packages: "@audio-ui/react cva" });
    expect(plan.cli).toEqual([
      { code: "npx shadcn@latest add @audio-ui/knob", type: "command" },
    ]);
    expect(plan.manual[0]?.parts).toEqual([
      { code: "npm install @audio-ui/react cva", type: "command" },
    ]);
    expect(plan.manual[1]?.parts).toEqual([
      { name: "knob", title: "components/audio-ui/knob.tsx", type: "source" },
    ]);
  });

  test("a device installs its three pieces, and shows its demo", () => {
    const plan = installPlan({ kind: "device", name: "delay" });
    expect(plan.manual[1]?.parts).toEqual([
      {
        code: "npx shadcn@latest add @audio-ui/delay-device @audio-ui/delay-panel @audio-ui/delay-engine",
        type: "command",
      },
    ]);
    expect(plan.manual[2]?.parts).toEqual([
      {
        name: "block-delay",
        title: "components/examples/block-delay.tsx",
        type: "source",
      },
    ]);
  });
});

describe("expandInstall", () => {
  test("a tag becomes the tabs the markdown pages read, and the rest of the page is left alone", () => {
    const out = expandInstall(
      'Before\n\n<Install name="fader" />\n\nAfter <Install />'
    );
    expect(out).toContain("<CodeTabs>");
    expect(out).toContain("npx shadcn@latest add @audio-ui/fader");
    expect(out).toContain('name="fader"');
    expect(out.startsWith("Before")).toBe(true);
    expect(out).toContain("After <Install />");
    expect(out).not.toContain('<Install name="fader"');
  });

  test("the props of a tag are read as written", () => {
    expect(
      parseInstallProps(
        'name="mixer" packages="@audio-ui/core" source="block-mixer" title="components/examples/block-mixer.tsx"'
      )
    ).toEqual({
      kind: undefined,
      name: "mixer",
      packages: "@audio-ui/core",
      source: "block-mixer",
      title: "components/examples/block-mixer.tsx",
    });
    expect(parseInstallProps('kind="device"')).toBeNull();
  });
});

test("every <Install /> of the docs names items the registry has", async () => {
  // The items as they install: one file of the built registry for each.
  const names = new Set(
    (await Array.fromAsync(new Bun.Glob("*.json").scan(BUILT))).map((file) =>
      file.replace(".json", "")
    )
  );
  const missing: string[] = [];
  let found = 0;
  for await (const file of new Bun.Glob("**/*.mdx").scan(DOCS)) {
    const text = await Bun.file(`${DOCS}/${file}`).text();
    for (const [, attrs = ""] of text.matchAll(INSTALL_TAG)) {
      found += 1;
      const props = parseInstallProps(attrs);
      if (!props) {
        missing.push(`${file}: no name`);
        continue;
      }
      const plan = installMdx(props);
      const used = [
        ...plan.matchAll(/npx shadcn@latest add ([^\n`]+)/g),
        ...plan.matchAll(/name="([\w-]+)"/g),
      ].flatMap((match) =>
        (match[1] ?? "")
          .split(" ")
          .map((item) => item.replace("@audio-ui/", ""))
      );
      for (const item of used) {
        if (item && !names.has(item)) {
          missing.push(`${file}: ${item}`);
        }
      }
    }
  }
  expect(found).toBeGreaterThan(30);
  expect(missing).toEqual([]);
});
