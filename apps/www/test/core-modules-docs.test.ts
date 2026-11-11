import { expect, test } from "bun:test";
import coreModules from "@/lib/docs/content/core-modules.generated.json";

const CORE = `${import.meta.dir}/../src/content/docs/core`;
/** The root's page is the Core overview; every other module has a page of its own. */
const pageOf = (name: string) => (name === "core" ? "index" : name);

test("every module of @audio-ui/core has its own page, headed by its entry", async () => {
  const wrong = await Promise.all(
    coreModules.map(async (each) => {
      const file = Bun.file(`${CORE}/${pageOf(each.name)}.mdx`);
      if (!(await file.exists())) {
        return `${each.name}: no page`;
      }
      return (await file.text()).includes(`<CoreModule name="${each.name}" />`)
        ? null
        : `${each.name}: no <CoreModule name="${each.name}" />`;
    })
  );
  expect(wrong.filter(Boolean)).toEqual([]);
});

test("the Core sidebar lists every module once, beside its guides", async () => {
  const meta = await Bun.file(`${CORE}/meta.json`).json();
  const listed = (meta.pages as string[]).filter(
    (page) => !page.startsWith("---")
  );
  const guides = ["controllers"];
  const expected = [...coreModules.map((each) => pageOf(each.name)), ...guides];
  expect(listed.toSorted()).toEqual(expected.toSorted());
  const pages = [...new Bun.Glob("*.mdx").scanSync(CORE)].map((file) =>
    file.replace(".mdx", "")
  );
  expect(pages.toSorted()).toEqual(expected.toSorted());
});
