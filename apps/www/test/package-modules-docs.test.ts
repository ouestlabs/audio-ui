import { expect, test } from "bun:test";
import packageModules from "@/lib/docs/content/package-modules.generated.json";

const DOCS = `${import.meta.dir}/../src/content/docs`;

/** Each package's docs folder, and the guides that live there beside its modules. */
const SECTIONS = [
  { folder: "core", guides: ["controllers"], package: "@audio-ui/core" },
  { folder: "engine", guides: [], package: "@audio-ui/engine" },
  { folder: "elements", guides: [], package: "@audio-ui/elements" },
  { folder: "react", guides: ["headless-styling"], package: "@audio-ui/react" },
] as const;

/** A module's page in its folder: a package's root is the folder's overview. */
const pageOf = (from: string, pkg: string) =>
  from === pkg ? "index" : from.slice(pkg.length + 1);

test("every module of the packages has its own page, headed by its entry", async () => {
  const wrong = await Promise.all(
    packageModules.map(async (each) => {
      const section = SECTIONS.find((one) => one.package === each.package);
      if (!section) {
        return `${each.from}: no docs section for ${each.package}`;
      }
      const file = Bun.file(
        `${DOCS}/${section.folder}/${pageOf(each.from, each.package)}.mdx`
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
          .filter((each) => each.package === section.package)
          .map((each) => pageOf(each.from, each.package))
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
