import { expect, test } from "bun:test";
import manifest from "@/lib/docs/content/entries.generated.json";

const DOCS = `${import.meta.dir}/../src/content/docs`;
const folderOf = (kind: string) => (kind === "hook" ? "hooks" : "lib");

test("every hook and lib has its own page, headed by its entry", async () => {
  const wrong = await Promise.all(
    manifest.map(async (entry) => {
      const file = Bun.file(
        `${DOCS}/${folderOf(entry.kind)}/${entry.name}.mdx`
      );
      if (!(await file.exists())) {
        return `${entry.name}: no page`;
      }
      return (await file.text()).includes(`<Entry name="${entry.name}" />`)
        ? null
        : `${entry.name}: no <Entry name="${entry.name}" />`;
    })
  );
  expect(wrong.filter(Boolean)).toEqual([]);
});

test("the Hooks and Libraries sidebars list every entry once, and nothing else", async () => {
  const metas = await Promise.all(
    ["hooks", "lib"].map(async (folder) => ({
      folder,
      meta: await Bun.file(`${DOCS}/${folder}/meta.json`).json(),
    }))
  );
  for (const { folder, meta } of metas) {
    const listed = (meta.pages as string[]).filter(
      (page) => !page.startsWith("---")
    );
    const expected = manifest
      .filter((entry) => folderOf(entry.kind) === folder)
      .map((entry) => entry.name);
    expect(listed.toSorted()).toEqual(expected.toSorted());
    const pages = [...new Bun.Glob("*.mdx").scanSync(`${DOCS}/${folder}`)].map(
      (file) => file.replace(".mdx", "")
    );
    expect(pages.toSorted()).toEqual(expected.toSorted());
  }
});
