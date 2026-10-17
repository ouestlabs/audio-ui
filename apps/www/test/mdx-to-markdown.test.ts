import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { expandDeviceControls } from "@/lib/docs/content/device-docs";
import {
  mdxToMarkdown,
  replaceFrontmatter,
} from "@/lib/docs/content/mdx-to-markdown";

const LEFTOVER_REGEX =
  /<\/?(?:TypeTable|TypeRow|KeyTable|KeyRow|Steps?|CodeTabs|Tabs|TabsList|TabsTrigger|TabsContent|Icons\.\w+)\b/;

const FENCE_REGEX = /^```[^\n]*\n[\s\S]*?^```[ \t]*$/m;

const outsideFences = (text: string) => text.split(FENCE_REGEX).join("");

describe("mdxToMarkdown", () => {
  test("a reference table is a Markdown table, pipes escaped", () => {
    const out = mdxToMarkdown(
      [
        "<TypeTable>",
        '<TypeRow name={"mode"} type={"\\"a\\" | \\"b\\""} default={"\\"a\\""}>Which one.</TypeRow>',
        '<TypeRow name={"onChange"} type={"(v: number) => void"}></TypeRow>',
        "</TypeTable>",
      ].join("\n")
    );
    expect(out).toBe(
      [
        "| Prop | Type | Default | Description |",
        "| --- | --- | --- | --- |",
        '| `mode` | `"a" \\| "b"` | `"a"` | Which one. |',
        "| `onChange` | `(v: number) => void` |  |  |",
      ].join("\n")
    );
  });

  test("rows without a type are a two-column table under their title", () => {
    const out = mdxToMarkdown(
      '<TypeTable title="Data attributes">\n<TypeRow name={"data-disabled"}>Present when disabled.</TypeRow>\n</TypeTable>'
    );
    expect(out).toContain("**Data attributes**");
    expect(out).toContain("| Attribute | Description |");
    expect(out).toContain("| `data-disabled` | Present when disabled. |");
  });

  test("steps are numbered, tabs are labelled, code is left alone", () => {
    const out = mdxToMarkdown(
      [
        "<Steps>",
        "<Step>One</Step>",
        "<Step>Two</Step>",
        "</Steps>",
        '<CodeTabs>\n\n<TabsList>\n  <TabsTrigger value="cli"><Icons.x /> CLI</TabsTrigger>\n</TabsList>\n\n<TabsContent value="cli">\n\n```bash component\n<Step>kept</Step>\n\n\n\nx\n```\n\n</TabsContent>\n\n</CodeTabs>',
      ].join("\n")
    );
    expect(out).toContain("**1. One**");
    expect(out).toContain("**2. Two**");
    expect(out).toContain("**CLI**");
    expect(out).toContain("```bash\n<Step>kept</Step>\n\n\n\nx\n```");
  });

  test("every docs page leaves no custom component outside a code fence", async () => {
    const glob = new Glob("src/content/docs/**/*.mdx");
    for await (const path of glob.scan(".")) {
      const text = await Bun.file(path).text();
      const out = mdxToMarkdown(expandDeviceControls(replaceFrontmatter(text)));
      expect(
        outsideFences(out).match(LEFTOVER_REGEX)?.[0],
        path
      ).toBeUndefined();
    }
  });
});
