import { getGroupsFromFolder } from "@/lib/docs/content/page-tree";
import { source } from "@/lib/docs/content/source";

export interface SpacePage {
  description: string;
  title: string;
  url: string;
}

/**
 * The docs by space (Elements, Workstation, Devices, Audio engine), as the
 * sidebar groups them, each page with its title, description and address:
 * the map llms.txt lists for agents and the home lists for people.
 */
export function getDocsSpaces() {
  const byUrl = new Map(source.getPages().map((page) => [page.url, page]));
  return source
    .getPageTree()
    .children.flatMap((folder) =>
      folder.type === "folder"
        ? getGroupsFromFolder(folder, "base").filter(
            (group) => group.collapsible
          )
        : []
    )
    .map((space) => ({
      sections: space.sections.map((section) => ({
        pages: section.pages.flatMap((node): SpacePage[] => {
          const page = byUrl.get(node.url);
          return page
            ? [
                {
                  description: page.data.description ?? "",
                  title: page.data.title,
                  url: page.url,
                },
              ]
            : [];
        }),
        title: section.title,
      })),
      title: space.title ?? "",
    }));
}
