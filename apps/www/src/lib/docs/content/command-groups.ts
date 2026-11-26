import type { CommandMenuGroup } from "@/components/site/navigation/command-menu";
import { nodeText, type PageTreeNode } from "@/lib/docs/content/page-tree";

function collectCommandMenuPages(
  items: PageTreeNode[],
  seen: Set<string>,
  pages: CommandMenuGroup["pages"]
) {
  for (const item of items) {
    if (item.type === "folder" && item.children) {
      collectCommandMenuPages(item.children, seen, pages);
      continue;
    }

    if (item.type !== "page") {
      continue;
    }

    const name = nodeText(item.name);
    const key = name || item.url;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    pages.push({
      isComponent: item.url.includes("/components/"),
      name,
      url: item.url,
    });
  }
}

function buildCommandMenuGroup(node: PageTreeNode): CommandMenuGroup | null {
  if (node.type !== "folder") {
    return null;
  }

  const pages: CommandMenuGroup["pages"] = [];
  collectCommandMenuPages(node.children, new Set<string>(), pages);

  if (pages.length === 0) {
    return null;
  }

  const groupName = nodeText(node.name);

  return {
    id: node.$id ?? groupName,
    name: groupName,
    pages,
  };
}

/** The command menu's groups: a top folder of the tree each, with the pages under it by name. Names are read with `nodeText`: the tree the loader sends holds them as elements. */
export function buildCommandMenuGroups(nodes: PageTreeNode[]) {
  return nodes.flatMap<CommandMenuGroup>((node) => {
    const group = buildCommandMenuGroup(node);
    return group ? [group] : [];
  });
}
