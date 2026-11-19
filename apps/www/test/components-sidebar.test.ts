import { expect, test } from "bun:test";
import {
  getCurrentBase,
  getGroupsFromFolder,
  type PageTreeFolder,
} from "@/lib/docs/content/page-tree";

const page = (name: string, url: string) => ({ name, type: "page", url });

/** The components folder of the page tree, as the content builds it: its own page, and the folder of the components' pages with a folder per space. */
const components = {
  $id: "components",
  children: [
    page("Components", "/docs/components"),
    {
      $id: "base",
      children: [
        {
          $id: "base/(elements)",
          children: [page("Knob", "/docs/components/base/knob")],
          name: "Elements",
          type: "folder",
        },
        {
          $id: "base/(workstation)",
          children: [page("Mixer", "/docs/components/base/mixer")],
          name: "Workstation",
          type: "folder",
        },
      ],
      name: "Base UI",
      root: true,
      type: "folder",
    },
  ],
  index: page("Components", "/docs/components"),
  name: "Components",
  type: "folder",
} as unknown as PageTreeFolder;

test("an address with no base in it reads the folder of the components' pages", () => {
  expect(getCurrentBase("/docs/components")).toBe("base");
  expect(getCurrentBase("/docs/components/base/knob")).toBe("base");
  expect(getCurrentBase("/docs/guides/output")).toBe("base");
});

test("the components section lists its own page first, as Overview, then its spaces", () => {
  const [first, ...spaces] = getGroupsFromFolder(
    components,
    getCurrentBase("/docs/components")
  );
  expect(first?.collapsible).toBe(false);
  expect(first?.sections.flatMap((section) => section.pages)).toEqual([
    expect.objectContaining({ name: "Overview", url: "/docs/components" }),
  ]);
  expect(spaces.map((space) => space.title)).toEqual([
    "Elements",
    "Workstation",
  ]);
  // The spaces hold the components, not the list of them.
  const urls = spaces.flatMap((space) =>
    space.sections.flatMap((section) => section.pages.map((each) => each.url))
  );
  expect(urls).toEqual([
    "/docs/components/base/knob",
    "/docs/components/base/mixer",
  ]);
});

test("a folder with no space is one group, as before", () => {
  const guides = {
    $id: "guides",
    children: [page("Output", "/docs/guides/output")],
    name: "Guides",
    type: "folder",
  } as unknown as PageTreeFolder;
  const groups = getGroupsFromFolder(guides, "base");
  expect(groups).toHaveLength(1);
  expect(groups[0]?.title).toBe("Guides");
});
