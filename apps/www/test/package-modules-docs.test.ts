import { expect, test } from "bun:test";
import packageModules from "@/lib/docs/content/package-modules.generated.json";

const DOCS = `${import.meta.dir}/../src/content/docs`;

/** Each docs folder, the guides that live there beside its modules, and what its modules are imported from. */
const SECTIONS = [
  { folder: "engine", from: "@/lib/engine", guides: [] },
  { folder: "webgl", from: "@/lib/webgl", guides: [] },
] as const;

/** The section a module is in, by what it is imported from. */
const sectionOf = (from: string) =>
  SECTIONS.find((one) => from === one.from || from.startsWith(`${one.from}/`));

/** A module's page in its folder: a package's root is the folder's overview. */
const pageOf = (from: string, root: string) =>
  from === root ? "index" : from.slice(root.length + 1);

test("every module of the packages has its own page, headed by its entry", async () => {
  const wrong = await Promise.all(
    packageModules.map(async (each) => {
      const section = sectionOf(each.from);
      if (!section) {
        return `${each.from}: no docs section`;
      }
      const file = Bun.file(
        `${DOCS}/${section.folder}/${pageOf(each.from, section.from)}.mdx`
      );
      if (!(await file.exists())) {
        return `${each.from}: no page`;
      }
      return (await file.text()).includes(`<Module from="${each.from}" />`)
        ? null
        : `${each.from}: no <Module from="${each.from}" />`;
    })
  );
  expect(wrong.filter(Boolean)).toEqual([]);
});

test("each package's sidebar lists every module once, beside its guides and overview", async () => {
  const listed = await Promise.all(
    SECTIONS.map(async (section) => {
      const meta = await Bun.file(`${DOCS}/${section.folder}/meta.json`).json();
      const pages = (meta.pages as string[]).filter(
        (page) => !page.startsWith("---")
      );
      const files = [
        ...new Bun.Glob("*.mdx").scanSync(`${DOCS}/${section.folder}`),
      ].map((file) => file.replace(".mdx", ""));
      const expected = [
        "index",
        ...packageModules
          .filter((each) => sectionOf(each.from) === section)
          .map((each) => pageOf(each.from, section.from))
          .filter((page) => page !== "index"),
        ...section.guides,
      ];
      return { expected, files, pages };
    })
  );
  for (const { expected, files, pages } of listed) {
    expect(pages.toSorted()).toEqual(expected.toSorted());
    expect(files.toSorted()).toEqual(expected.toSorted());
  }
});
