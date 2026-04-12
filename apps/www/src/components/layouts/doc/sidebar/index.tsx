"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PAGES_NEW } from "@/lib/docs";
import type { source } from "@/lib/source";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/registry/default/ui/sidebar";

function DocsSidebar({
  tree,
  ...props
}: React.ComponentProps<typeof Sidebar> & { tree: typeof source.pageTree }) {
  const pathname = usePathname();

  return (
    <Sidebar
      className="sticky top-(--header-height) z-30 hidden h-[calc(100svh-var(--header-height))] bg-transparent lg:flex"
      collapsible="none"
      {...props}
    >
      <SidebarContent className="no-scrollbar px-4 py-2">
        {tree.children.map((item) => (
          <SidebarGroup className="gap-1" key={item.$id}>
            <SidebarGroupLabel className="h-7 px-0 text-sidebar-accent-foreground">
              {item.name}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              {item.type === "folder" && (
                <SidebarMenu className="gap-0.5">
                  {item.children.map((i) => {
                    if (i.type === "page") {
                      return (
                        <SidebarMenuItem key={i.url}>
                          <SidebarMenuButton
                            isActive={i.url === pathname}
                            render={
                              <Link
                                className="flex items-center justify-between gap-2"
                                href={i.url}
                              />
                            }
                          >
                            {i.name}
                            {PAGES_NEW.includes(i.url) && (
                              <span
                                className="flex size-2 rounded-full bg-primary"
                                title="New"
                              />
                            )}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    }
                    if (i.type === "folder") {
                      return (
                        <SidebarGroup className="gap-1 pl-4" key={i.$id}>
                          <SidebarGroupLabel className="h-6 px-0 text-sidebar-accent-foreground text-xs">
                            {i.name}
                          </SidebarGroupLabel>
                          <SidebarGroupContent>
                            <SidebarMenu className="gap-0.5">
                              {i.children.map(
                                (child) =>
                                  child.type === "page" && (
                                    <SidebarMenuItem key={child.url}>
                                      <SidebarMenuButton
                                        className="after:-inset-y-1 relative h-[30px] 3xl:fixed:w-full w-fit 3xl:fixed:max-w-48 overflow-visible border border-transparent font-medium text-[0.8rem] after:absolute after:inset-x-0 after:z-0 after:rounded-md data-[active=true]:border-accent data-[active=true]:bg-accent"
                                        isActive={child.url === pathname}
                                        render={
                                          <Link
                                            className="flex items-center justify-between gap-2"
                                            href={child.url}
                                          />
                                        }
                                      >
                                        {child.name}
                                        {PAGES_NEW.includes(child.url) && (
                                          <span
                                            className="flex size-2 rounded-full bg-primary"
                                            title="New"
                                          />
                                        )}
                                      </SidebarMenuButton>
                                    </SidebarMenuItem>
                                  )
                              )}
                            </SidebarMenu>
                          </SidebarGroupContent>
                        </SidebarGroup>
                      );
                    }
                    return null;
                  })}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

export { DocsSidebar };
