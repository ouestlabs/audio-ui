"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getDocsPageUpdateHint } from "@/lib/docs";
import { showMcpDocs } from "@/lib/flags";
import { getCurrentBase, getSectionsFromFolder } from "@/lib/page-tree";
import type { source } from "@/lib/source";

const EXCLUDED_SECTIONS = ["test"];
const EXCLUDED_PAGES = ["test"];

function DocsUpdateIndicator({ path }: { path: string }) {
  const hint = getDocsPageUpdateHint(path);

  if (!hint) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex shrink-0 cursor-help">
            <span className="sr-only">{hint}</span>
            <span
              aria-hidden="true"
              className="site-rounded-md flex size-2 bg-blue-500"
            />
          </span>
        }
      />
      <TooltipContent side="right" sideOffset={8}>
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}

export function DocsSidebar({
  tree,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  tree: ReturnType<typeof source.getPageTree>;
}) {
  const pathname = usePathname();
  const currentBase = getCurrentBase(pathname);

  return (
    <Sidebar
      className="docs-sidebar top-(--header-height) z-30 h-[calc(100svh-var(--header-height))] bg-transparent group-data-[side=left]:border-r-0 **:data-[slot=sidebar-inner]:bg-site-background"
      {...props}
    >
      <SidebarContent className="no-scrollbar scroll-fade-y overflow-x-hidden px-2 pb-12">
        <div className="h-(--top-spacing) shrink-0" />
        {tree.children.map((item) => {
          if (EXCLUDED_SECTIONS.includes(item.$id ?? "")) {
            return null;
          }

          return (
            <SidebarGroup key={item.$id}>
              <SidebarGroupLabel className="font-medium text-site-muted-foreground">
                {item.name}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                {item.type === "folder" &&
                  getSectionsFromFolder(item, currentBase).map((section) => (
                    <div
                      className="not-first:mt-3"
                      key={section.title ?? "untitled"}
                    >
                      {section.title ? (
                        <p className="px-2 pb-1 text-site-muted-foreground/70 text-xs">
                          {section.title}
                        </p>
                      ) : null}
                      <SidebarMenu className="gap-0.5">
                        {section.pages.map((page) => {
                          if (!showMcpDocs && page.url.includes("/mcp")) {
                            return null;
                          }

                          if (EXCLUDED_PAGES.includes(page.url)) {
                            return null;
                          }

                          return (
                            <SidebarMenuItem key={page.url}>
                              <SidebarMenuButton
                                className="after:site-rounded-md after:-inset-y-1 relative h-[30px] 3xl:fixed:w-full w-fit 3xl:fixed:max-w-48 overflow-visible border border-transparent font-medium text-[0.8rem] after:absolute after:inset-x-0 after:z-0 data-[active=true]:border-site-accent data-[active=true]:bg-site-accent"
                                isActive={page.url === pathname}
                                render={
                                  <Link href={page.url} prefetch={false}>
                                    <span className="pointer-events-none absolute inset-0 flex w-(--sidebar-width) bg-transparent" />
                                    <span className="relative z-10 inline-flex items-center gap-2">
                                      <span>{page.name}</span>
                                      <DocsUpdateIndicator path={page.url} />
                                    </span>
                                  </Link>
                                }
                              />
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </div>
                  ))}
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
