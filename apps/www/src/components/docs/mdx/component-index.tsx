import { useFumadocsLoader } from "fumadocs-core/source/client";
import { LinkCard, LinkCards } from "@/components/docs/mdx/link-cards";
import { useSidebarGroups } from "@/hooks/use-sidebar-groups";
import { COMPONENTS_INDEX } from "@/lib/docs/content/framework-paths";
import { nodeText } from "@/lib/docs/content/page-tree";
import { Route as SiteRoute } from "@/routes/_site";

/**
 * Every component, as the sidebar groups them (Elements, Workstation,
 * Devices) and for the reader's framework: a card each, with its title and
 * what it is for.
 */
export function ComponentIndex() {
  const { pageTree } = useFumadocsLoader(SiteRoute.useLoaderData());
  const { groups } = useSidebarGroups(pageTree);
  return (
    <>
      {groups.map((group) => (
        <section className="mt-10" key={group.title ?? group.folder}>
          {group.title ? (
            <h2 className="font-semibold text-xl">{group.title}</h2>
          ) : null}
          {group.sections.map((section) => {
            const pages = section.pages.filter(
              (page) => page.url !== COMPONENTS_INDEX
            );
            return pages.length > 0 ? (
              <div className="mt-6" key={section.title ?? pages[0]?.url}>
                {section.title ? (
                  <h3 className="font-medium text-muted-foreground text-sm">
                    {section.title}
                  </h3>
                ) : null}
                <LinkCards>
                  {pages.map((page) => (
                    <LinkCard
                      href={page.url}
                      key={page.url}
                      title={nodeText(page.name)}
                    >
                      {nodeText(page.description)}
                    </LinkCard>
                  ))}
                </LinkCards>
              </div>
            ) : null;
          })}
        </section>
      ))}
    </>
  );
}
