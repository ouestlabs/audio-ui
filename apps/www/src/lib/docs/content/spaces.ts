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

const COMPONENTS = "/docs/components/";
const GUIDES = "/docs/guides";

/** What the home lists: the spaces of components (Elements, Workstation, Devices), and the guides' pages. */
export function getHomeIndex() {
  const spaces = getDocsSpaces();
  return {
    guides: spaces
      .flatMap((space) => space.sections.flatMap((section) => section.pages))
      .filter((page) => page.url.startsWith(GUIDES)),
    spaces: spaces.filter((space) =>
      space.sections.some((section) =>
        section.pages.some((page) => page.url.startsWith(COMPONENTS))
      )
    ),
  };
}

export type HomeIndex = ReturnType<typeof getHomeIndex>;
