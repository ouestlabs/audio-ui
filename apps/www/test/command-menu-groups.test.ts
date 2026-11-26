import { expect, test } from "bun:test";
import { deserializePageTree } from "fumadocs-core/source/client";
import { buildCommandMenuGroups } from "@/lib/docs/content/command-groups";

test("the command menu names its groups and pages from a tree the loader serialized", () => {
  // What the layout's loader sends: every name rendered to HTML, which the client turns back into a span holding it.
  const tree = deserializePageTree({
    $fumadocs_loader: "page-tree",
    data: {
      children: [
        {
          children: [
            { name: "Introduction", type: "page", url: "/docs" },
            { name: "Drag &amp; drop", type: "page", url: "/docs/drag" },
          ],
          name: "Get started",
          type: "folder",
        },
      ],
      name: "Docs",
    },
  } as unknown as Parameters<typeof deserializePageTree>[0]);

  const [group] = buildCommandMenuGroups(tree.children);

  expect(group?.name).toBe("Get started");
  expect(group?.pages.map((page) => page.name)).toEqual([
    "Introduction",
    "Drag & drop",
  ]);
});
